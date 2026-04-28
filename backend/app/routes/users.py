import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from ..db import get_db
from ..models import User, Cosign
from ..schemas import UserCreate, UserRead

router = APIRouter()


@router.get("/users", response_model=list[UserRead])
async def list_users(google_id: str | None = None, db: AsyncSession = Depends(get_db)):
    q = select(User).order_by(User.display_name)
    if google_id:
        q = q.where(User.google_id == google_id)
    result = await db.execute(q)
    return result.scalars().all()


@router.get("/users/{user_id}/cosigns")
async def user_cosigns(user_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Cosign.bong_id).where(Cosign.user_id == user_id)
    )
    return [str(row.bong_id) for row in result.all()]


@router.post("/users", response_model=UserRead, status_code=201)
async def create_user(body: UserCreate, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(
        select(User).where(
            (User.google_id == body.google_id)
            | (User.email == body.email)
            | (User.display_name == body.display_name)
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="user already exists")

    user = User(**body.model_dump())
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user
