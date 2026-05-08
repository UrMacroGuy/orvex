"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-05-06 00:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    op.create_table(
        "api_keys",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True),
        sa.Column("user_id", sa.Uuid(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("provider_id", sa.String(64), nullable=False),
        sa.Column("label", sa.String(64), nullable=False),
        sa.Column("masked", sa.String(64), nullable=False),
        sa.Column("ciphertext", sa.LargeBinary, nullable=False),
        sa.Column("nonce", sa.LargeBinary, nullable=False),
        sa.Column("last_validated", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("user_id", "provider_id", "label",
                            name="uq_api_keys_user_provider_label"),
    )
    op.create_index("ix_api_keys_user_id", "api_keys", ["user_id"])

    op.create_table(
        "queries",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True),
        sa.Column("user_id", sa.Uuid(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("prompt", sa.Text, nullable=False),
        sa.Column("selected_models", sa.JSON, nullable=False),
        sa.Column("options", sa.JSON, nullable=False),
        sa.Column("status", sa.String(16), nullable=False, server_default="pending"),
        sa.Column("error", sa.Text, nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_queries_user_id", "queries", ["user_id"])
    op.create_index("ix_queries_status", "queries", ["status"])

    op.create_table(
        "model_responses",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True),
        sa.Column("query_id", sa.Uuid(as_uuid=True),
                  sa.ForeignKey("queries.id", ondelete="CASCADE"), nullable=False),
        sa.Column("provider_id", sa.String(64), nullable=False),
        sa.Column("model_id", sa.String(128), nullable=False),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("text", sa.Text, nullable=True),
        sa.Column("latency_ms", sa.Integer, nullable=False, server_default="0"),
        sa.Column("input_tokens", sa.Integer, nullable=False, server_default="0"),
        sa.Column("output_tokens", sa.Integer, nullable=False, server_default="0"),
        sa.Column("error", sa.Text, nullable=True),
        sa.Column("error_code", sa.String(64), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_model_responses_query_id", "model_responses", ["query_id"])

    op.create_table(
        "syntheses",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True),
        sa.Column("query_id", sa.Uuid(as_uuid=True),
                  sa.ForeignKey("queries.id", ondelete="CASCADE"),
                  nullable=False, unique=True),
        sa.Column("summary", sa.Text, nullable=False, server_default=""),
        sa.Column("consensus", sa.JSON, nullable=False),
        sa.Column("disagreements", sa.JSON, nullable=False),
        sa.Column("unique_insights", sa.JSON, nullable=False),
        sa.Column("citations", sa.JSON, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "web_sources",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True),
        sa.Column("query_id", sa.Uuid(as_uuid=True),
                  sa.ForeignKey("queries.id", ondelete="CASCADE"), nullable=False),
        sa.Column("url", sa.Text, nullable=False),
        sa.Column("title", sa.Text, nullable=False),
        sa.Column("snippet", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_web_sources_query_id", "web_sources", ["query_id"])


def downgrade() -> None:
    op.drop_index("ix_web_sources_query_id", "web_sources")
    op.drop_table("web_sources")
    op.drop_table("syntheses")
    op.drop_index("ix_model_responses_query_id", "model_responses")
    op.drop_table("model_responses")
    op.drop_index("ix_queries_status", "queries")
    op.drop_index("ix_queries_user_id", "queries")
    op.drop_table("queries")
    op.drop_index("ix_api_keys_user_id", "api_keys")
    op.drop_table("api_keys")
    op.drop_index("ix_users_email", "users")
    op.drop_table("users")
