"""add reformulated_notes to agenda_items

Revision ID: b3c4d5e6f7g8
Revises: a1b2c3d4e5f6
Create Date: 2026-06-29 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = 'b3c4d5e6f7g8'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('agenda_items', sa.Column('reformulated_notes', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('agenda_items', 'reformulated_notes')
