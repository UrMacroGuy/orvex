"""add oauth fields to users

Revision ID: 0002
Revises: 0001
Create Date: 2026-05-07 00:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("users") as batch_op:
        batch_op.add_column(sa.Column("name", sa.String(255), nullable=True))
        batch_op.add_column(sa.Column("oauth_provider", sa.String(32), nullable=True))
        batch_op.add_column(sa.Column("oauth_id", sa.String(255), nullable=True))
        batch_op.add_column(
            sa.Column("is_verified", sa.Boolean(), nullable=False, server_default="0")
        )
        batch_op.create_unique_constraint(
            "uq_users_oauth_provider_id",
            ["oauth_provider", "oauth_id"],
        )


def downgrade() -> None:
    with op.batch_alter_table("users") as batch_op:
        batch_op.drop_constraint("uq_users_oauth_provider_id", type_="unique")
        batch_op.drop_column("is_verified")
        batch_op.drop_column("oauth_id")
        batch_op.drop_column("oauth_provider")
        batch_op.drop_column("name")
