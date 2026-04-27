from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from ..db import get_db
from ..models import Bong, BongSubject, Cosign, User
from ..schemas import LeaderboardEntry, BongRead
from .bongs import _bong_read

router = APIRouter()

VALID_PERIODS = {"week", "month", "year", "all"}


def _period_filter(period: str):
    if period == "week":
        return Bong.created_at >= func.date_trunc("week", func.now())
    if period == "month":
        return Bong.created_at >= func.date_trunc("month", func.now())
    if period == "year":
        return Bong.created_at >= func.date_trunc("year", func.now())
    return None


@router.get("/leaderboard", response_model=list[LeaderboardEntry])
async def leaderboard(
    period: str = Query(default="all"),
    sort: str = Query(default="score"),
    db: AsyncSession = Depends(get_db),
):
    if period not in VALID_PERIODS:
        raise HTTPException(status_code=400, detail=f"period must be one of {VALID_PERIODS}")
    if sort not in {"score", "cosigns"}:
        raise HTTPException(status_code=400, detail="sort must be 'score' or 'cosigns'")

    cosign_subq = (
        select(Cosign.bong_id, func.count(Cosign.id).label("cosign_count"))
        .group_by(Cosign.bong_id)
        .subquery()
    )

    stmt = (
        select(
            User.id,
            User.display_name,
            func.count(BongSubject.bong_id).label("bong_count"),
            func.sum(Bong.score).label("total_score"),
            func.max(Bong.score).label("highest_score"),
            func.coalesce(func.sum(cosign_subq.c.cosign_count), 0).label("cosign_count"),
        )
        .join(BongSubject, BongSubject.user_id == User.id)
        .join(Bong, Bong.id == BongSubject.bong_id)
        .outerjoin(cosign_subq, cosign_subq.c.bong_id == BongSubject.bong_id)
        .group_by(User.id, User.display_name)
    )

    period_filter = _period_filter(period)
    if period_filter is not None:
        stmt = stmt.where(period_filter)

    if sort == "cosigns":
        stmt = stmt.order_by(func.coalesce(func.sum(cosign_subq.c.cosign_count), 0).desc())
    else:
        stmt = stmt.order_by(func.sum(Bong.score).desc())

    result = await db.execute(stmt)
    rows = result.all()

    return [
        LeaderboardEntry(
            rank=i + 1,
            user_id=row.id,
            display_name=row.display_name,
            bong_count=row.bong_count,
            total_score=row.total_score,
            highest_score=row.highest_score,
            cosign_count=row.cosign_count,
        )
        for i, row in enumerate(rows)
    ]


@router.get("/bong-of-the-period", response_model=BongRead)
async def bong_of_the_period(
    period: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    if period not in {"week", "month", "year"}:
        raise HTTPException(status_code=400, detail="period must be week, month, or year")

    stmt = (
        select(Bong)
        .options(
            selectinload(Bong.submitter),
            selectinload(Bong.subjects).selectinload(BongSubject.user),
        )
        .where(_period_filter(period))
        .order_by(Bong.score.desc())
        .limit(1)
    )

    result = await db.execute(stmt)
    bong = result.scalar_one_or_none()
    if not bong:
        raise HTTPException(status_code=404, detail="no bongs this period")

    return await _bong_read(bong, db)
