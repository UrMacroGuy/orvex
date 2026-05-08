from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Any, Optional
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, JSON, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from .response import ModelResponse
    from .synthesis import Synthesis
    from .user import User
    from .web_source import WebSource


class Query(Base, TimestampMixin):
    __tablename__ = "queries"

    id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid4
    )
    user_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    prompt: Mapped[str] = mapped_column(Text, nullable=False)
    selected_models: Mapped[list[dict[str, Any]]] = mapped_column(
        JSON, nullable=False
    )
    options: Mapped[dict[str, Any]] = mapped_column(
        JSON, nullable=False, default=dict
    )
    status: Mapped[str] = mapped_column(
        String(16), nullable=False, default="pending", index=True
    )
    error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    user: Mapped["User"] = relationship(back_populates="queries")
    responses: Mapped[list["ModelResponse"]] = relationship(
        back_populates="query", cascade="all, delete-orphan"
    )
    synthesis: Mapped[Optional["Synthesis"]] = relationship(
        back_populates="query", cascade="all, delete-orphan", uselist=False
    )
    web_sources: Mapped[list["WebSource"]] = relationship(
        back_populates="query", cascade="all, delete-orphan"
    )
