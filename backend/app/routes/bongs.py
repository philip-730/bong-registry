import uuid
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from ..db import get_db, SessionLocal
from ..models import Bong, BongSubject, Cosign, User
from ..schemas import BongCreate, BongRead, UserRead
from ..llm import judge_stream
from .stream import broadcast

router = APIRouter()


async def _bong_read(bong: Bong, db: AsyncSession) -> BongRead:
    cosign_count_result = await db.execute(
        select(func.count()).where(Cosign.bong_id == bong.id)
    )
    cosign_count = cosign_count_result.scalar_one()
    subjects = [s.user for s in bong.subjects]
    return BongRead(
        id=bong.id,
        submitter=bong.submitter,
        subjects=subjects,
        offense_tokens=bong.offense_tokens,
        tier=bong.tier,
        score=bong.score,
        llm_response=bong.llm_response,
        cosign_count=cosign_count,
        created_at=bong.created_at,
    )


async def _run_judge(bong_id: uuid.UUID, offense: str) -> None:
    async for event_type, value in judge_stream(offense):
        if event_type == "verdict_chunk":
            broadcast({"type": "verdict_chunk", "bong_id": str(bong_id), "chunk": value})
        else:
            async with SessionLocal() as db:
                result = await db.execute(
                    select(Bong)
                    .options(
                        selectinload(Bong.submitter),
                        selectinload(Bong.subjects).selectinload(BongSubject.user),
                    )
                    .where(Bong.id == bong_id)
                )
                bong = result.scalar_one()
                bong.score = value["score"]
                bong.tier = value["tier"]
                bong.llm_response = value["verdict"]
                await db.commit()
                await db.refresh(bong)
                read = await _bong_read(bong, db)
                broadcast({"type": "bong_complete", "bong": read.model_dump(mode="json")})


@router.post("/bongs", response_model=BongRead, status_code=201)
async def submit_bong(body: BongCreate, background_tasks: BackgroundTasks, db: AsyncSession = Depends(get_db)):
    submitter = await db.get(User, body.submitter_id)
    if not submitter:
        raise HTTPException(status_code=404, detail="submitter not found")

    subject_ids = list({t.user_id for t in body.offense_tokens if t.type == "mention" and t.user_id})
    if not subject_ids:
        raise HTTPException(status_code=400, detail="at least one subject required")

    subjects: list[User] = []
    for sid in subject_ids:
        user = await db.get(User, sid)
        if not user:
            raise HTTPException(status_code=404, detail=f"subject {sid} not found")
        subjects.append(user)

    user_map = {str(u.id): u.display_name for u in subjects}
    offense_text = "".join(
        t.value if t.type == "text" else f"@{user_map.get(str(t.user_id), 'someone')}"
        for t in body.offense_tokens
    )

    tokens_json = [t.model_dump(mode="json", exclude_none=True) for t in body.offense_tokens]

    bong = Bong(
        submitter_id=body.submitter_id,
        offense_tokens=tokens_json,
        tier=None,
        score=None,
        llm_response=None,
    )
    db.add(bong)
    await db.flush()

    for sid in subject_ids:
        db.add(BongSubject(bong_id=bong.id, user_id=sid))
    await db.commit()

    await db.refresh(bong)
    await db.refresh(bong, ["submitter", "subjects"])
    for s in bong.subjects:
        await db.refresh(s, ["user"])

    read = await _bong_read(bong, db)
    broadcast({"type": "bong_pending", "bong": read.model_dump(mode="json")})

    background_tasks.add_task(_run_judge, bong.id, offense_text)
    return read


@router.get("/bongs", response_model=list[BongRead])
async def list_bongs(
    limit: int = 50,
    offset: int = 0,
    submitter_id: uuid.UUID | None = None,
    subject_id: uuid.UUID | None = None,
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(Bong)
        .options(
            selectinload(Bong.submitter),
            selectinload(Bong.subjects).selectinload(BongSubject.user),
        )
        .order_by(Bong.created_at.desc())
    )
    if submitter_id:
        query = query.where(Bong.submitter_id == submitter_id)
    if subject_id:
        query = query.join(BongSubject, Bong.id == BongSubject.bong_id).where(BongSubject.user_id == subject_id)
    result = await db.execute(query.limit(limit).offset(offset))
    bongs = result.scalars().all()
    return [await _bong_read(b, db) for b in bongs]


@router.get("/bongs/{bong_id}", response_model=BongRead)
async def get_bong(bong_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Bong)
        .options(
            selectinload(Bong.submitter),
            selectinload(Bong.subjects).selectinload(BongSubject.user),
        )
        .where(Bong.id == bong_id)
    )
    bong = result.scalar_one_or_none()
    if not bong:
        raise HTTPException(status_code=404, detail="bong not found")
    return await _bong_read(bong, db)


@router.get("/bongs/{bong_id}/cosigns", response_model=list[UserRead])
async def get_cosigners(bong_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(User)
        .join(Cosign, Cosign.user_id == User.id)
        .where(Cosign.bong_id == bong_id)
        .order_by(Cosign.created_at)
    )
    users = result.scalars().all()
    return [UserRead.model_validate(u) for u in users]


@router.post("/bongs/{bong_id}/cosign", status_code=201)
async def cosign(bong_id: uuid.UUID, user_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    bong = await db.get(Bong, bong_id)
    if not bong:
        raise HTTPException(status_code=404, detail="bong not found")

    existing = await db.execute(
        select(Cosign).where(Cosign.bong_id == bong_id, Cosign.user_id == user_id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="already co-signed")

    db.add(Cosign(bong_id=bong_id, user_id=user_id))
    await db.commit()
    return {"ok": True}


@router.delete("/bongs/{bong_id}/cosign", status_code=200)
async def remove_cosign(bong_id: uuid.UUID, user_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Cosign).where(Cosign.bong_id == bong_id, Cosign.user_id == user_id)
    )
    cosign = result.scalar_one_or_none()
    if not cosign:
        raise HTTPException(status_code=404, detail="co-sign not found")

    await db.delete(cosign)
    await db.commit()
    return {"ok": True}
