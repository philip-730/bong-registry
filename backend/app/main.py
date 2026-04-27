from fastapi import FastAPI
from .routes import bongs, users, leaderboard, stream

app = FastAPI(title="bong-registry")

app.include_router(bongs.router, prefix="/service")
app.include_router(users.router, prefix="/service")
app.include_router(leaderboard.router, prefix="/service")
app.include_router(stream.router, prefix="/service")
