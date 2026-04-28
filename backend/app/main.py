import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routes import bongs, users, leaderboard, stream

app = FastAPI(title="bong-registry")

origins = os.environ.get("CORS_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(bongs.router, prefix="/service")
app.include_router(users.router, prefix="/service")
app.include_router(leaderboard.router, prefix="/service")
app.include_router(stream.router, prefix="/service")
