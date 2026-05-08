from __future__ import annotations

from typing import TYPE_CHECKING, Any
from uuid import UUID, uuid4

from sqlalchemy import ForeignKey, JSON, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from .query import Query


class Synthesis(Base, TimestampMixin):
    __tablename__ = "syntheses"

    id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid4
    )
    query_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("queries.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    summary: Mapped[str] = mapped_column(Text, nullable=False, default="")
    consensus: Mapped[list[dict[str, Any]]] = mapped_column(
        JSON, nullable=False, default=list
    )
    disagreements: Mapped[list[dict[str, Any]]] = mapped_column(
        JSON, nullable=False, default=list
    )
    unique_insights: Mapped[list[dict[str, Any]]] = mapped_column(
        JSON, nullable=False, default=list
    )
    citations: Mapped[list[dict[str, Any]]] = mapped_column(
        JSON, nullable=False, default=list
    )

    query: Mapped["Query"] = relationship(back_populates="synthesis")
