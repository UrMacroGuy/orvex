from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1 import router as v1_router
from app.core.config import get_settings
from app.core.errors import install_exception_handlers
from app.core.logging import setup_logging
from app.db.session import dispose


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    setup_logging(settings.log_level)
    yield
    await dispose()


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title="Orvex API",
        version="0.1.0",
        lifespan=lifespan,
    )

    # TEMP DEV CORS CONFIG
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:3000",
            "http://127.0.0.1:3000",
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    install_exception_handlers(app)

    app.include_router(v1_router, prefix="/api/v1")

    @app.get("/")
    async def root() -> dict[str, str]:
        return {"message": "Orvex backend running"}

    return app


app = create_app()