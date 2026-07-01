"""add draft_content to pv_drafts

Revision ID: a1b2c3d4e5f6
Revises: e2ad2f43ead2
Create Date: 2026-06-28 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = 'a1b2c3d4e5f6'
down_revision = 'e2ad2f43ead2'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('pv_drafts', sa.Column('draft_content', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('pv_drafts', 'draft_content')
