import os
import json
import asyncio
import logging
from typing import Optional
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Query
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.models import RoomFilter
from app.rooms import room_manager
import app.tmdb as tmdb

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("moviematch")

app = FastAPI(title="Collaborative Movie Selection Platform")

@app.on_event("startup")
async def startup_event():
    """Pre-warm the genre movie cache from TMDB at server boot."""
    asyncio.create_task(tmdb.warmup_cache())

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static directory
STATIC_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static")
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

@app.get("/")
async def serve_home():
    return FileResponse(os.path.join(STATIC_DIR, "index.html"))

@app.get("/api/genres")
async def get_genres():
    genres = await tmdb.get_genres()
    return [{"id": gid, "name": name} for gid, name in genres.items()]

@app.get("/api/providers")
async def get_providers(region: str = "IN"):
    return tmdb.get_popular_providers_for_region(region)

class CreateRoomRequest(BaseModel):
    host_name: str
    host_id: Optional[str] = None

@app.post("/api/rooms")
async def create_room(req: CreateRoomRequest):
    if not req.host_name.strip():
        raise HTTPException(status_code=400, detail="Host name is required.")
    room, host_id = room_manager.create_room(host_name=req.host_name.strip(), host_id=req.host_id)
    return {
        "room_code": room.code,
        "host_id": host_id,
        "state": room.state
    }

@app.get("/api/rooms/{code}")
async def check_room(code: str):
    room = room_manager.get_room(code)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found.")
    return {
        "room_code": room.code,
        "state": room.state,
        "is_locked": (room.state != "lobby"),
        "participants_count": len([p for p in room.participants.values() if p.is_connected])
    }

@app.websocket("/ws/{code}/{user_id}")
async def websocket_endpoint(websocket: WebSocket, code: str, user_id: str, name: Optional[str] = Query(None)):
    room = room_manager.get_room(code)
    if not room:
        await websocket.close(code=4004, reason="Room does not exist.")
        return

    # Check if locked for new participants
    if room.state != "lobby" and user_id not in room.participants:
        await websocket.close(code=4003, reason="Game in progress. Room is locked.")
        return

    await websocket.accept()
    room.add_connection(user_id=user_id, ws=websocket, name=name)

    # Broadcast updated lobby to all
    await room.broadcast("lobby_update", room.get_lobby_data())

    try:
        while True:
            data = await websocket.receive_json()
            event_type = data.get("type")
            payload = data.get("data", {})

            if event_type == "update_filters":
                if user_id == room.host_id and room.state == "lobby":
                    try:
                        room.filters = RoomFilter(**payload)
                        await room.broadcast("filters_updated", room.filters.dict())
                    except Exception as e:
                        logger.error(f"Error updating filters: {e}")

            elif event_type == "kick_player":
                if user_id == room.host_id:
                    target_id = payload.get("target_id")
                    if target_id:
                        kicked = await room.kick_participant(target_id)
                        if kicked:
                            await room.broadcast("lobby_update", room.get_lobby_data())

            elif event_type == "start_game":
                if user_id == room.host_id and room.state == "lobby":
                    # Fetch movies from TMDB with room filters
                    movies = await tmdb.discover_movies(room.filters)
                    room.start_game(movies)
                    await room.broadcast("game_started", {
                        "movies": [m.dict() for m in movies],
                        "total_cards": len(movies)
                    })

            elif event_type == "cast_vote":
                if room.state == "voting":
                    movie_id = payload.get("movie_id")
                    liked = bool(payload.get("liked"))
                    all_finished = room.cast_vote(user_id=user_id, movie_id=movie_id, liked=liked)

                    # Send progress update
                    await room.broadcast("progress_update", {
                        "participants": [p.dict() for p in room.participants.values()]
                    })

                    # If all players have finished their card decks, trigger results
                    if all_finished:
                        results = room.calculate_results()
                        await room.broadcast("game_results", results.dict())

            elif event_type == "end_session":
                # Host can end voting early
                if user_id == room.host_id and room.state == "voting":
                    results = room.calculate_results()
                    await room.broadcast("game_results", results.dict())

            elif event_type == "restart_game":
                if user_id == room.host_id:
                    room.restart_game()
                    await room.broadcast("game_restarted", room.get_lobby_data())

    except WebSocketDisconnect:
        room.remove_connection(user_id)
        if room.state == "lobby":
            await room.broadcast("lobby_update", room.get_lobby_data())
        elif room.state == "voting":
            # Check if remaining players are now all finished
            connected_players = [p for p in room.participants.values() if p.is_connected]
            if connected_players and all(p.has_finished for p in connected_players):
                results = room.calculate_results()
                await room.broadcast("game_results", results.dict())
            else:
                await room.broadcast("progress_update", {
                    "participants": [p.dict() for p in room.participants.values()]
                })
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        room.remove_connection(user_id)
