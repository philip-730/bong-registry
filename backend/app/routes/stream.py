import asyncio
import json
from fastapi import APIRouter
from fastapi.responses import StreamingResponse

router = APIRouter()

_listeners: list[asyncio.Queue] = []


def broadcast(event: dict) -> None:
    for q in _listeners:
        q.put_nowait(event)


@router.get("/stream")
async def stream():
    async def event_generator():
        q: asyncio.Queue = asyncio.Queue()
        _listeners.append(q)
        try:
            while True:
                event = await q.get()
                yield f"data: {json.dumps(event)}\n\n"
        finally:
            _listeners.remove(q)

    return StreamingResponse(event_generator(), media_type="text/event-stream")
