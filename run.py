import os
import sys
import uvicorn

if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    port = int(os.getenv("PORT", "8000"))
    is_prod = os.getenv("ENVIRONMENT", "").lower() == "production" or os.getenv("PORT") is not None

    print("\n=======================================================")
    print(f"  MovieMatch Platform is starting on port {port}")
    print("=======================================================\n")
    
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=port,
        reload=not is_prod
    )
