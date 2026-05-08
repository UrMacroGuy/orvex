from __future__ import annotations

from typing import TYPE_CHECKING, Optional
from uuid import UUID, uuid4

from sqlalchemy import ForeignKey, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from .query import Query


class WebSource(Base, TimestampMixin):
    __tablename__ = "web_sources"

    id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid4
    )
    query_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("queries.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    url: Mapped[str] = mapped_column(Text, nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    snippet: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    query: Mapped["Query"] = relationship(back_populates="web_sources")
