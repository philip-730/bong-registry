import os
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://localhost/bong_test?host=/tmp")
os.environ.setdefault("ANTHROPIC_API_KEY", "test")

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy import text

TEST_DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql+asyncpg://localhost/bong_test?host=/tmp")


@pytest_asyncio.fixture(scope="session")
async def engine():
    eng = create_async_engine(TEST_DATABASE_URL)
    yield eng
    await eng.dispose()


@pytest_asyncio.fixture(autouse=True)
async def truncate_tables(engine):
    yield
    async with engine.begin() as conn:
        await conn.execute(text("TRUNCATE TABLE cosigns, bong_subjects, bongs, users CASCADE"))


@pytest_asyncio.fixture
async def client(engine):
    from app.main import app
    from app.db import get_db

    TestSession = async_sessionmaker(engine, expire_on_commit=False)

    async def override_get_db():
        async with TestSession() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def db(engine):
    async with async_sessionmaker(engine, expire_on_commit=False)() as session:
        yield session
