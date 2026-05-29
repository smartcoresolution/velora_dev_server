import os
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from app.routers import admin, consent, upload, analysis, results

app = FastAPI(
    title="VELORA API",
    description="Voice-based Early Cognitive Health Screening Service",
    version="1.0.0",
)

# Disable CORS. Do not remove this for full-stack development.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

app.include_router(consent.router, prefix="/api/consent", tags=["Consent & Governance"])
app.include_router(upload.router, prefix="/api/upload", tags=["Upload & Quality Check"])
app.include_router(analysis.router, prefix="/api/analysis", tags=["Analysis Pipeline"])
app.include_router(results.router, prefix="/api/results", tags=["Results & Guidance"])
app.include_router(admin.router, prefix="/api/admin", tags=["Admin Console"])


@app.get("/healthz")
async def healthz():
    return {"status": "ok"}


# Serve frontend static files
STATIC_DIR = Path(__file__).parent.parent / "static"
if STATIC_DIR.exists():
    app.mount("/assets", StaticFiles(directory=str(STATIC_DIR / "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_frontend(request: Request, full_path: str):
        file_path = STATIC_DIR / full_path
        if file_path.is_file():
            return FileResponse(str(file_path))
        return FileResponse(str(STATIC_DIR / "index.html"))
