from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from ..db import get_db
from ..models import User
from ..schemas import UserCreate, UserRead

router = APIRouter()


@router.get("/users", response_model=list[UserRead])
async def list_users(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).order_by(User.display_name))
    return result.scalars().all()


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
