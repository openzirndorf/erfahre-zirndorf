import ssl
from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from config import settings
from migrations import run_schema_migrations


def _normalize_url(url: str) -> str:
    """Normalisiert DB-URL auf postgresql+asyncpg:// und entfernt asyncpg-inkompatible Parameter."""
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql+asyncpg://", 1)
    elif url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+asyncpg://", 1)

    # sslmode ist ein psycopg2-Parameter – asyncpg versteht ihn nicht
    if "sslmode" in url:
        from urllib.parse import parse_qs, urlencode, urlparse, urlunparse
        p = urlparse(url)
        qs = {k: v[0] for k, v in parse_qs(p.query).items() if k != "sslmode"}
        url = urlunparse(p._replace(query=urlencode(qs)))

    return url


def _connect_args(url: str) -> dict:
    if "sqlite" in url:
        return {"check_same_thread": False}
    if "postgresql" in url:
        ca = Path(__file__).parent / "rdb-ca.pem"
        if ca.exists():
            ctx = ssl.create_default_context(cafile=str(ca))
        else:
            # Serverless SQL / lokale Dev-DB: Standard-CA-Store
            ctx = ssl.create_default_context()
        return {"ssl": ctx}
    return {}


_db_url = _normalize_url(settings.database_url)
_is_postgres = "postgresql" in _db_url

engine = create_async_engine(
    _db_url,
    echo=False,
    connect_args=_connect_args(_db_url),
    pool_pre_ping=True,
    # Pool-Parameter nur für PostgreSQL (SQLite unterstützt diese nicht)
    **({
        "pool_size": 2,
        "max_overflow": 3,
        "pool_timeout": 10,
        "pool_recycle": 300,
    } if _is_postgres else {}),
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    pass


async def init_db() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await run_schema_migrations(conn)


async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
