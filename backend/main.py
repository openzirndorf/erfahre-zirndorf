import logging
import os
import sys
import traceback
from contextlib import asynccontextmanager
from pathlib import Path

# Logging zuerst initialisieren damit Fehler beim Import sichtbar sind
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    stream=sys.stderr,
)
logger = logging.getLogger(__name__)

try:
    from fastapi import FastAPI
    from fastapi.middleware.cors import CORSMiddleware
    from fastapi.responses import JSONResponse
    from fastapi.staticfiles import StaticFiles
    from slowapi import Limiter, _rate_limit_exceeded_handler
    from slowapi.errors import RateLimitExceeded
    from slowapi.util import get_remote_address

    from config import settings
    from database import init_db
    from routers import admin, auth, challenges, checkins, suggestions, survey, teams, users
except Exception:
    logger.critical("IMPORT FEHLGESCHLAGEN:\n%s", traceback.format_exc())
    sys.exit(1)

limiter = Limiter(key_func=get_remote_address)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initialisiere Datenbank …")
    try:
        await init_db()
        logger.info("Datenbank bereit.")
    except Exception as exc:
        logger.critical("Datenbank-Initialisierung fehlgeschlagen: %s", exc, exc_info=True)
        raise
    yield


def create_app() -> FastAPI:
    app = FastAPI(
        title="Erfahre Zirndorf API",
        version="1.0.0",
        docs_url="/api/docs",
        redoc_url="/api/redoc",
        openapi_url="/api/openapi.json",
        lifespan=lifespan,
    )

    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(auth.router)
    app.include_router(challenges.router)
    app.include_router(checkins.router)
    app.include_router(teams.router)
    app.include_router(survey.router)
    app.include_router(users.router)
    app.include_router(suggestions.router)
    app.include_router(admin.router)

    @app.get("/api/health")
    async def health() -> JSONResponse:
        return JSONResponse({
            "status": "ok",
            "service": "erfahre-zirndorf",
            "version": os.getenv("APP_VERSION", "dev"),
        })

    dist = Path(__file__).parent / "dist"
    if dist.is_dir():
        from fastapi.responses import FileResponse
        from starlette.requests import Request

        # Catch-all: API-Routen kommen zuerst (via include_router), dieser
        # Handler fängt alles andere ab. Existiert die Datei → direkt ausliefern,
        # sonst index.html (SPA mit HashRouter).
        @app.get("/{full_path:path}", include_in_schema=False)
        async def spa(request: Request, full_path: str) -> FileResponse:
            # Trailing slash von API-Pfaden abfangen (Browser/Widgets fügen manchmal / an)
            clean = full_path.rstrip("/")
            if clean != full_path and clean.startswith("api/"):
                from starlette.responses import RedirectResponse
                return RedirectResponse(url=f"/{clean}", status_code=307)
            f = dist / full_path
            return FileResponse(f if f.is_file() else dist / "index.html")

    return app


app = create_app()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
