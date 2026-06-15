"""
Production server: serves FastAPI API + static React frontend from a single process.
"""
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from api.main import app

# Serve frontend static files from /dist
frontend_dist = Path(__file__).parent / "frontend" / "dist"
if frontend_dist.exists():
    # Serve static assets
    app.mount("/assets", StaticFiles(directory=frontend_dist / "assets"), name="assets")

    # Serve index.html for all non-API routes (SPA fallback)
    from fastapi.responses import FileResponse

    @app.get("/{path:path}")
    async def serve_spa(path: str):
        file_path = frontend_dist / path
        if file_path.exists() and file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(frontend_dist / "index.html")
