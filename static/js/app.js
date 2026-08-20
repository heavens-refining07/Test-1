/**
 * MovieMatch Main Frontend Application Logic
 */

// Sound FX via Web Audio API
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playTone(freq, type = "sine", duration = 0.15, gainVal = 0.1) {
  try {
    if (audioCtx.state === "suspended") {
      audioCtx.resume();
    }
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(gainVal, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  } catch (e) {}
}

function playLikeSound() {
  playTone(523.25, "sine", 0.1, 0.1);
  setTimeout(() => playTone(659.25, "sine", 0.15, 0.1), 80);
}

function playNopeSound() {
  playTone(300, "triangle", 0.1, 0.06);
  setTimeout(() => playTone(220, "triangle", 0.15, 0.06), 70);
}

function playWinnerSound() {
  const notes = [523.25, 659.25, 783.99, 1046.50];
  notes.forEach((freq, i) => {
    setTimeout(() => playTone(freq, "sine", 0.25, 0.12), i * 120);
  });
}

// Nicknames Generator
const NICKNAMES = [
  "Cinephile", "MovieLover", "ReelCritic", "FilmBuff", 
  "ScreenJunkie", "PopcornPro", "BingeMaster", "SceneStealer"
];

// App State
const state = {
  userId: localStorage.getItem("moviematch_uid") || "user_" + Math.random().toString(36).substring(2, 9),
  userName: localStorage.getItem("moviematch_name") || "",
  roomCode: "",
  isHost: false,
  ws: null,
  deck: [],
  totalCards: 0,
  swipedCount: 0,
  swipeController: null,
  filters: {
    region: "IN",
    provider_ids: [8, 119],
    genre_ids: [],
    min_rating: 6.0,
    year_from: null,
    year_to: null,
    card_count: 15
  },
  allGenres: [],
  allProviders: []
};

localStorage.setItem("moviematch_uid", state.userId);

// DOM Elements
const screens = {
  home: document.getElementById("screen-home"),
  lobby: document.getElementById("screen-lobby"),
  voting: document.getElementById("screen-voting"),
  results: document.getElementById("screen-results")
};

const modals = {
  filter: document.getElementById("modal-filters"),
  detail: document.getElementById("modal-detail")
};

function showScreen(screenKey) {
  Object.values(screens).forEach(s => s.classList.remove("active"));
  if (screens[screenKey]) {
    screens[screenKey].classList.add("active");
  }
}

function showToast(msg) {
  let toast = document.getElementById("app-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "app-toast";
    toast.style.cssText = `
      position: fixed; top: 16px; left: 50%; transform: translateX(-50%);
      background: var(--surface-overlay); color: var(--text-primary); padding: 10px 18px;
      border-radius: var(--radius-full); font-weight: 600; font-size: 0.8125rem; z-index: 1000;
      border: 1px solid var(--border-medium); box-shadow: var(--shadow-md);
      transition: all 0.25s ease; opacity: 0; pointer-events: none;
    `;
    document.body.appendChild(toast);
  }
  toast.innerText = msg;
  toast.style.opacity = "1";
  toast.style.transform = "translateX(-50%) translateY(0)";
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(-50%) translateY(-6px)";
  }, 2200);
}

// Confetti
function launchConfetti() {
  try {
    const colors = ["#7C3AED", "#10B981", "#F59E0B", "#06B6D4", "#F43F5E"];
    for (let i = 0; i < 45; i++) {
      const conf = document.createElement("div");
      conf.style.cssText = `
        position: fixed;
        width: ${Math.random() * 8 + 5}px;
        height: ${Math.random() * 8 + 5}px;
        background: ${colors[Math.floor(Math.random() * colors.length)]};
        top: -15px;
        left: ${Math.random() * 100}vw;
        border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
        z-index: 999;
        pointer-events: none;
        opacity: 0.9;
        transform: rotate(${Math.random() * 360}deg);
        transition: transform 2.2s ease-out, top 2.2s ease-out, opacity 2.2s ease-out;
      `;
      document.body.appendChild(conf);
      setTimeout(() => {
        conf.style.top = `${window.innerHeight + 20}px`;
        conf.style.transform = `rotate(${Math.random() * 720}deg) translateX(${Math.random() * 80 - 40}px)`;
        conf.style.opacity = "0";
      }, 40);
      setTimeout(() => conf.remove(), 2400);
    }
  } catch (e) {}
}

// INITIALIZATION
document.addEventListener("DOMContentLoaded", async () => {
  const nameInput = document.getElementById("user-name-input");
  const randomNameBtn = document.getElementById("btn-random-name");
  
  if (state.userName) {
    nameInput.value = state.userName;
  } else {
    nameInput.value = NICKNAMES[Math.floor(Math.random() * NICKNAMES.length)];
    state.userName = nameInput.value;
  }

  randomNameBtn.addEventListener("click", () => {
    const randomNick = NICKNAMES[Math.floor(Math.random() * NICKNAMES.length)];
    nameInput.value = randomNick;
    state.userName = randomNick;
    localStorage.setItem("moviematch_name", randomNick);
    playTone(480, "sine", 0.06);
  });

  nameInput.addEventListener("input", (e) => {
    state.userName = e.target.value.trim();
    localStorage.setItem("moviematch_name", state.userName);
  });

  const urlParams = new URLSearchParams(window.location.search);
  const roomParam = urlParams.get("room");
  if (roomParam) {
    document.getElementById("join-code-input").value = roomParam;
  }

  await loadMetadata();
  setupEventHandlers();
});

async function loadMetadata() {
  try {
    const [genresRes, providersRes] = await Promise.all([
      fetch("/api/genres"),
      fetch(`/api/providers?region=${state.filters.region}`)
    ]);
    if (genresRes.ok) state.allGenres = await genresRes.json();
    if (providersRes.ok) state.allProviders = await providersRes.json();
    renderFilterOptions();
  } catch (e) {
    console.error("Error loading metadata:", e);
  }
}

function renderFilterOptions() {
  // Render Providers
  const provContainer = document.getElementById("filter-providers-list");
  provContainer.innerHTML = "";
  state.allProviders.forEach(p => {
    const pid = parseInt(p.id, 10);
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = `chip ${state.filters.provider_ids.includes(pid) ? 'active' : ''}`;
    chip.innerText = p.name;
    chip.dataset.id = pid;
    chip.addEventListener("click", (e) => {
      e.preventDefault();
      if (state.filters.provider_ids.includes(pid)) {
        state.filters.provider_ids = state.filters.provider_ids.filter(id => id !== pid);
        chip.classList.remove("active");
      } else {
        state.filters.provider_ids.push(pid);
        chip.classList.add("active");
      }
      playTone(400, "sine", 0.05);
    });
    provContainer.appendChild(chip);
  });

  // Render Genres
  const genresContainer = document.getElementById("filter-genres-list");
  genresContainer.innerHTML = "";
  state.allGenres.forEach(g => {
    const gid = parseInt(g.id, 10);
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = `chip ${state.filters.genre_ids.includes(gid) ? 'active' : ''}`;
    chip.innerText = g.name;
    chip.dataset.id = gid;
    chip.addEventListener("click", (e) => {
      e.preventDefault();
      if (state.filters.genre_ids.includes(gid)) {
        state.filters.genre_ids = state.filters.genre_ids.filter(id => id !== gid);
        chip.classList.remove("active");
      } else {
        state.filters.genre_ids.push(gid);
        chip.classList.add("active");
      }
      playTone(400, "sine", 0.05);
    });
    genresContainer.appendChild(chip);
  });
}

function setupEventHandlers() {
  document.getElementById("btn-create-room").addEventListener("click", () => {
    if (!validateName()) return;
    openFilterModal();
  });

  document.getElementById("btn-join-room").addEventListener("click", async () => {
    if (!validateName()) return;
    const code = document.getElementById("join-code-input").value.trim();
    if (!code || code.length !== 4) {
      showToast("Please enter a 4-digit room code");
      return;
    }
    await joinRoom(code);
  });

  document.getElementById("btn-confirm-filters").addEventListener("click", async () => {
    closeFilterModal();
    await createRoom();
  });

  document.querySelectorAll(".close-modal").forEach(btn => {
    btn.addEventListener("click", () => {
      Object.values(modals).forEach(m => m.classList.remove("active"));
    });
  });

  document.getElementById("btn-copy-code").addEventListener("click", () => {
    const shareUrl = `${window.location.origin}/?room=${state.roomCode}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl);
      showToast("Room link copied! 📋");
    } else {
      showToast(`Room Code: ${state.roomCode}`);
    }
  });

  document.getElementById("btn-share-room").addEventListener("click", () => {
    const shareUrl = `${window.location.origin}/?room=${state.roomCode}`;
    if (navigator.share) {
      navigator.share({
        title: "Join my MovieMatch Room!",
        text: `Let's pick a movie together! Room code: ${state.roomCode}`,
        url: shareUrl
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(shareUrl);
      showToast("Link copied to clipboard! 📋");
    }
  });

  document.getElementById("btn-start-game").addEventListener("click", () => {
    if (!state.isHost) return;
    if (state.ws && state.ws.readyState === WebSocket.OPEN) {
      document.getElementById("btn-start-game").innerText = "Fetching Deck...";
      document.getElementById("btn-start-game").disabled = true;
      state.ws.send(JSON.stringify({ type: "start_game" }));
    }
  });

  document.getElementById("btn-vote-nope").addEventListener("click", () => {
    if (state.swipeController) {
      playNopeSound();
      state.swipeController.swipeLeft();
    }
  });

  document.getElementById("btn-vote-like").addEventListener("click", () => {
    if (state.swipeController) {
      playLikeSound();
      state.swipeController.swipeRight();
    }
  });

  document.getElementById("btn-card-info").addEventListener("click", () => {
    if (state.swipeController) {
      const movie = state.swipeController.getCurrentMovie();
      if (movie) openDetailModal(movie);
    }
  });

  document.getElementById("btn-force-results").addEventListener("click", () => {
    if (state.isHost && state.ws) {
      state.ws.send(JSON.stringify({ type: "end_session" }));
    }
  });

  document.getElementById("btn-restart-game").addEventListener("click", () => {
    if (state.isHost && state.ws) {
      state.ws.send(JSON.stringify({ type: "restart_game" }));
    }
  });

  document.getElementById("btn-leave-room").addEventListener("click", () => {
    if (state.ws) state.ws.close();
    window.location.href = "/";
  });

  // Card Count Selector
  document.querySelectorAll(".card-count-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      document.querySelectorAll(".card-count-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      state.filters.card_count = parseInt(btn.dataset.count, 10);
      playTone(450, "sine", 0.06);
    });
  });

  // Rating Slider
  const ratingSlider = document.getElementById("filter-rating-slider");
  const ratingValDisplay = document.getElementById("filter-rating-val");
  if (ratingSlider && ratingValDisplay) {
    ratingSlider.addEventListener("input", (e) => {
      ratingValDisplay.innerText = `⭐ ${parseFloat(e.target.value).toFixed(1)}+`;
      state.filters.min_rating = parseFloat(e.target.value);
    });
  }

  // Region Selector
  const regionSelect = document.getElementById("filter-region-select");
  if (regionSelect) {
    regionSelect.addEventListener("change", async (e) => {
      state.filters.region = e.target.value;
      const providersRes = await fetch(`/api/providers?region=${state.filters.region}`);
      if (providersRes.ok) {
        state.allProviders = await providersRes.json();
        state.filters.provider_ids = state.allProviders.slice(0, 2).map(p => p.id);
        renderFilterOptions();
      }
    });
  }
}

function validateName() {
  const name = document.getElementById("user-name-input").value.trim();
  if (!name) {
    showToast("Please enter a nickname first!");
    return false;
  }
  state.userName = name;
  localStorage.setItem("moviematch_name", name);
  return true;
}

function openFilterModal() {
  modals.filter.classList.add("active");
}

function closeFilterModal() {
  modals.filter.classList.remove("active");
}

function openDetailModal(movie) {
  document.getElementById("detail-title").innerText = movie.title;
  document.getElementById("detail-year").innerText = movie.release_year || "Unknown";
  document.getElementById("detail-rating").innerText = `⭐ ${movie.vote_average.toFixed(1)} (${movie.vote_count} votes)`;
  document.getElementById("detail-genres").innerText = (movie.genres || []).join(", ") || "General";
  document.getElementById("detail-providers").innerText = (movie.providers || []).join(", ") || "Streaming";
  document.getElementById("detail-overview").innerText = movie.overview || "No overview available.";
  modals.detail.classList.add("active");
}

// CREATE ROOM
async function createRoom() {
  try {
    const res = await fetch("/api/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        host_name: state.userName,
        host_id: state.userId
      })
    });
    if (!res.ok) throw new Error("Failed to create room.");
    const data = await res.json();
    state.roomCode = data.room_code;
    state.isHost = true;
    connectWebSocket();
  } catch (e) {
    showToast("Error creating room. Please try again.");
    console.error(e);
  }
}

// JOIN ROOM
async function joinRoom(code) {
  try {
    const res = await fetch(`/api/rooms/${code}`);
    if (!res.ok) {
      showToast("Room not found. Check the code.");
      return;
    }
    const data = await res.json();
    if (data.is_locked) {
      showToast("Voting is already in progress in this room.");
      return;
    }
    state.roomCode = code;
    state.isHost = false;
    connectWebSocket();
  } catch (e) {
    showToast("Unable to connect to room.");
    console.error(e);
  }
}

// WEBSOCKET
function connectWebSocket() {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const wsUrl = `${protocol}//${window.location.host}/ws/${state.roomCode}/${state.userId}?name=${encodeURIComponent(state.userName)}`;
  
  state.ws = new WebSocket(wsUrl);

  state.ws.onopen = () => {
    showScreen("lobby");
    document.getElementById("lobby-room-code").innerText = state.roomCode.split("").join(" ");
    
    if (state.isHost) {
      state.ws.send(JSON.stringify({
        type: "update_filters",
        data: state.filters
      }));
    }
  };

  state.ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    handleServerEvent(msg.type, msg.data);
  };

  state.ws.onclose = (event) => {
    if (event.code === 4003) {
      showToast("Room is locked (game in progress)");
      showScreen("home");
    } else if (event.code === 4004) {
      showToast("Room does not exist.");
      showScreen("home");
    }
  };

  state.ws.onerror = (err) => {
    console.error("WS error:", err);
  };
}

function handleServerEvent(type, data) {
  switch (type) {
    case "lobby_update":
      renderLobby(data);
      break;

    case "filters_updated":
      updateLobbyFiltersSummary(data);
      break;

    case "game_started":
      initVotingArena(data.movies, data.total_cards);
      break;

    case "progress_update":
      updateProgressUI(data.participants);
      break;

    case "game_results":
      renderResults(data);
      break;

    case "game_restarted":
      showScreen("lobby");
      document.getElementById("waiting-box").style.display = "none";
      document.getElementById("card-stack-container").style.display = "flex";
      document.getElementById("action-buttons-bar").style.display = "flex";
      renderLobby(data);
      break;

    case "kicked":
      showToast("You were removed from the room by the host.");
      showScreen("home");
      break;
  }
}

// RENDER LOBBY
function renderLobby(data) {
  const playersList = document.getElementById("lobby-players-list");
  playersList.innerHTML = "";
  const participants = data.participants || [];

  document.getElementById("lobby-player-count").innerText = `${participants.length} connected`;

  participants.forEach(p => {
    const row = document.createElement("div");
    row.className = "player-item";
    const initial = p.name.charAt(0).toUpperCase();

    let kickHtml = "";
    if (state.isHost && p.id !== state.userId) {
      kickHtml = `<button class="btn-kick" type="button" onclick="kickPlayer('${p.id}')">Kick</button>`;
    }

    row.innerHTML = `
      <div class="player-meta">
        <div class="player-avatar" style="background-color: ${p.avatar_color || '#7C3AED'}">${initial}</div>
        <span class="player-name">${p.name} ${p.id === state.userId ? '<span class="text-caption" style="color: var(--text-muted);">(You)</span>' : ''}</span>
      </div>
      <div style="display: flex; align-items: center; gap: 8px;">
        ${p.is_host ? '<span class="badge badge--host">HOST</span>' : ''}
        ${kickHtml}
      </div>
    `;
    playersList.appendChild(row);
  });

  const startBtn = document.getElementById("btn-start-game");
  const waitingMsg = document.getElementById("lobby-waiting-msg");
  if (state.isHost) {
    startBtn.style.display = "flex";
    startBtn.disabled = false;
    startBtn.innerText = "Start Swiping";
    waitingMsg.style.display = "none";
  } else {
    startBtn.style.display = "none";
    waitingMsg.style.display = "block";
  }

  if (data.filters) {
    updateLobbyFiltersSummary(data.filters);
  }
}

function updateLobbyFiltersSummary(filters) {
  const box = document.getElementById("lobby-filter-summary");
  box.innerHTML = "";
  
  const countTag = document.createElement("span");
  countTag.className = "summary-tag";
  countTag.innerText = `🎬 ${filters.card_count} Cards`;
  box.appendChild(countTag);

  const ratingTag = document.createElement("span");
  ratingTag.className = "summary-tag";
  ratingTag.innerText = `⭐ Min ${filters.min_rating}+`;
  box.appendChild(ratingTag);

  // Show active genres
  if (filters.genre_ids && filters.genre_ids.length > 0) {
    const genreMap = {};
    (state.allGenres || []).forEach(g => { genreMap[g.id] = g.name; });
    const activeGenreNames = filters.genre_ids.map(id => genreMap[id] || (id === 16 ? "Animation" : id)).filter(Boolean);
    if (activeGenreNames.length > 0) {
      const gTag = document.createElement("span");
      gTag.className = "summary-tag";
      gTag.innerText = `🎭 ${activeGenreNames.join(", ")}`;
      box.appendChild(gTag);
    }
  }

  // Show active providers
  if (filters.provider_ids && filters.provider_ids.length > 0) {
    const provMap = {};
    (state.allProviders || []).forEach(p => { provMap[p.id] = p.name; });
    const activeProvNames = filters.provider_ids.map(id => provMap[id] || (id === 8 ? "Netflix" : id)).filter(Boolean);
    if (activeProvNames.length > 0) {
      const pTag = document.createElement("span");
      pTag.className = "summary-tag";
      pTag.innerText = `📺 ${activeProvNames.join(", ")}`;
      box.appendChild(pTag);
    }
  }
}

window.kickPlayer = function(targetId) {
  if (state.isHost && state.ws) {
    state.ws.send(JSON.stringify({
      type: "kick_player",
      data: { target_id: targetId }
    }));
  }
};

// INIT VOTING ARENA
function initVotingArena(movies, totalCards) {
  state.deck = [...movies];
  state.totalCards = totalCards;
  state.swipedCount = 0;

  showScreen("voting");
  document.getElementById("card-stack-container").style.display = "flex";
  document.getElementById("action-buttons-bar").style.display = "flex";
  document.getElementById("waiting-box").style.display = "none";

  updateProgressBadge();

  const container = document.getElementById("card-stack-container");
  state.swipeController = new CardSwipeController(container, (liked, movie) => {
    handleCardSwiped(liked, movie);
  });
  state.swipeController.init(state.deck);
}

function handleCardSwiped(liked, movie) {
  state.swipedCount++;
  updateProgressBadge();

  if (liked) playLikeSound();
  else playNopeSound();

  if (state.ws && state.ws.readyState === WebSocket.OPEN) {
    state.ws.send(JSON.stringify({
      type: "cast_vote",
      data: {
        movie_id: movie.id,
        liked: liked
      }
    }));
  }

  if (state.swipedCount >= state.totalCards) {
    document.getElementById("card-stack-container").style.display = "none";
    document.getElementById("action-buttons-bar").style.display = "none";
    document.getElementById("waiting-box").style.display = "flex";

    const forceBtn = document.getElementById("btn-force-results");
    if (state.isHost) {
      forceBtn.style.display = "flex";
    } else {
      forceBtn.style.display = "none";
    }
  }
}

function updateProgressBadge() {
  const current = Math.min(state.swipedCount + 1, state.totalCards);
  document.getElementById("deck-progress-badge").innerText = `Card ${current} / ${state.totalCards}`;
}

function updateProgressUI(participants) {
  const finished = participants.filter(p => p.has_finished).length;
  const total = participants.length;
  document.getElementById("friends-status-badge").innerText = `${finished}/${total} Finished`;
}

// RENDER RESULTS
function renderResults(result) {
  showScreen("results");
  playWinnerSound();
  launchConfetti();

  const winner = result.winner;
  const tieBadge = document.getElementById("winner-tie-badge");
  if (result.is_tie_break) {
    tieBadge.style.display = "inline-block";
    tieBadge.innerText = "🎲 Resolved by Random Tie-Breaker";
  } else {
    tieBadge.style.display = "none";
  }

  document.getElementById("winner-poster-img").src = winner.poster_path || "https://via.placeholder.com/500x750?text=No+Poster";
  document.getElementById("winner-movie-title").innerText = winner.title;
  document.getElementById("winner-movie-year").innerText = winner.release_year || "";
  document.getElementById("winner-movie-rating").innerText = `⭐ ${winner.vote_average.toFixed(1)}`;
  document.getElementById("winner-movie-overview").innerText = winner.overview || "No synopsis available.";
  document.getElementById("winner-genres").innerText = (winner.genres || []).join(" • ") || "Movie";

  const totalVoters = result.total_voters || 1;
  const matchPct = Math.round((result.max_likes / totalVoters) * 100);
  document.getElementById("winner-votes-stat").innerText = `Liked by ${result.max_likes} of ${totalVoters} friends (${matchPct}%) ♥`;

  const leaderboardList = document.getElementById("results-leaderboard-list");
  leaderboardList.innerHTML = "";
  
  (result.leaderboard || []).forEach((item, index) => {
    const row = document.createElement("div");
    row.className = "leaderboard-item";
    const medal = index === 0 ? "🥇" : (index === 1 ? "🥈" : (index === 2 ? "🥉" : `${index + 1}.`));
    
    row.innerHTML = `
      <span class="text-caption" style="font-weight: 700; width: 24px;">${medal}</span>
      <span class="player-name" style="flex: 1; padding: 0 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${item.movie.title}</span>
      <span class="badge badge--success">${item.likes} Likes (${item.percentage}%)</span>
    `;
    leaderboardList.appendChild(row);
  });

  const restartBtn = document.getElementById("btn-restart-game");
  if (state.isHost) {
    restartBtn.style.display = "flex";
  } else {
    restartBtn.style.display = "none";
  }
}
