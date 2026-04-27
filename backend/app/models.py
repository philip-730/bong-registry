import uuid
from datetime import datetime
from decimal import Decimal
from sqlalchemy import String, Numeric, ForeignKey, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .db import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    google_id: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    email: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    display_name: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"))

    submitted_bongs: Mapped[list["Bong"]] = relationship(back_populates="submitter")
    cosigns: Mapped[list["Cosign"]] = relationship(back_populates="user")


class Bong(Base):
    __tablename__ = "bongs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    submitter_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    offense: Mapped[str] = mapped_column(String, nullable=False)
    tier: Mapped[str] = mapped_column(String, nullable=False)
    score: Mapped[Decimal] = mapped_column(Numeric(4, 1), nullable=False)
    llm_response: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"))

    submitter: Mapped["User"] = relationship(back_populates="submitted_bongs")
    subjects: Mapped[list["BongSubject"]] = relationship(back_populates="bong", cascade="all, delete-orphan")
    cosigns: Mapped[list["Cosign"]] = relationship(back_populates="bong", cascade="all, delete-orphan")


class BongSubject(Base):
    __tablename__ = "bong_subjects"

    bong_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("bongs.id"), primary_key=True)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), primary_key=True)

    bong: Mapped["Bong"] = relationship(back_populates="subjects")
    user: Mapped["User"] = relationship()


class Cosign(Base):
    __tablename__ = "cosigns"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    bong_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("bongs.id"), nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"))

    __table_args__ = (UniqueConstraint("bong_id", "user_id"),)

    bong: Mapped["Bong"] = relationship(back_populates="cosigns")
    user: Mapped["User"] = relationship(back_populates="cosigns")
