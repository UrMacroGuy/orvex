from fastapi import APIRouter

from .auth import router as auth_router
from .health import router as health_router
from .keys import router as keys_router
from .providers import router as providers_router
from .queries import router as queries_router
from .financial import router as financial_router
from .research import router as research_router

router = APIRouter()
router.include_router(auth_router)
router.include_router(health_router)
router.include_router(providers_router)
router.include_router(keys_router)
router.include_router(queries_router)
router.include_router(financial_router)
router.include_router(research_router)

__all__ = ["router"]
