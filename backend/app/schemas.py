import uuid
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel


class UserCreate(BaseModel):
    google_id: str
    email: str
    display_name: str


class UserRead(BaseModel):
    id: uuid.UUID
    google_id: str
    email: str
    display_name: str
    created_at: datetime

    model_config = {"from_attributes": True}


class BongCreate(BaseModel):
    submitter_id: uuid.UUID
    subject_ids: list[uuid.UUID]
    offense: str


class BongRead(BaseModel):
    id: uuid.UUID
    submitter: UserRead
    subjects: list[UserRead]
    offense: str
    tier: str | None
    score: Decimal | None
    llm_response: str | None
    cosign_count: int
    created_at: datetime

    model_config = {"from_attributes": True}


class CosignRead(BaseModel):
    id: uuid.UUID
    bong_id: uuid.UUID
    user_id: uuid.UUID
    created_at: datetime

    model_config = {"from_attributes": True}


class LeaderboardEntry(BaseModel):
    rank: int
    user_id: uuid.UUID
    display_name: str
    bong_count: int
    total_score: Decimal
    highest_score: Decimal
    cosign_count: int


class BongOfThePeriod(BaseModel):
    period: str
    bong: BongRead
