import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from ..db import get_db
from ..models import Bong, BongSubject, Cosign, User
from ..schemas import BongCreate, BongRead
from ..llm import judge
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
        offense=bong.offense,
        tier=bong.tier,
        score=bong.score,
        llm_response=bong.llm_response,
        cosign_count=cosign_count,
        created_at=bong.created_at,
    )


@router.post("/bongs", response_model=BongRead, status_code=201)
async def submit_bong(body: BongCreate, db: AsyncSession = Depends(get_db)):
    submitter = await db.get(User, body.submitter_id)
    if not submitter:
        raise HTTPException(status_code=404, detail="submitter not found")

    subject = await db.get(User, body.subject_id)
    if not subject:
        raise HTTPException(status_code=404, detail="subject not found")

    verdict = await judge(body.offense)

    bong = Bong(
        submitter_id=body.submitter_id,
        offense=body.offense,
        tier=verdict["tier"],
        score=verdict["score"],
        llm_response=verdict["verdict"],
    )
    db.add(bong)
    await db.flush()

    db.add(BongSubject(bong_id=bong.id, user_id=body.subject_id))
    await db.commit()

    await db.refresh(bong)
    await db.refresh(bong, ["submitter", "subjects"])
    for s in bong.subjects:
        await db.refresh(s, ["user"])

    read = await _bong_read(bong, db)
    broadcast(read.model_dump(mode="json"))
    return read


@router.get("/bongs", response_model=list[BongRead])
async def list_bongs(limit: int = 50, offset: int = 0, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Bong)
        .options(
            selectinload(Bong.submitter),
            selectinload(Bong.subjects).selectinload(BongSubject.user),
        )
        .order_by(Bong.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
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
