"""offense_tokens

Revision ID: a4f8b2c6d9e1
Revises: 2322ebd5de3d
Create Date: 2026-04-28 00:00:00.000000

"""
from typing import Sequence, Union
import json
import re

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "a4f8b2c6d9e1"
down_revision: Union[str, Sequence[str], None] = "2322ebd5de3d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _tokenize(offense: str, subjects: list[dict]) -> list[dict]:
    """Convert a plain offense string to a token list."""
    names = [s["display_name"] for s in subjects if s.get("display_name")]
    if not names:
        return [{"type": "text", "value": offense}]

    pattern = re.compile("@(" + "|".join(re.escape(n) for n in names) + ")")
    name_to_id = {s["display_name"]: s["user_id"] for s in subjects}

    tokens: list[dict] = []
    last = 0
    for match in pattern.finditer(offense):
        if match.start() > last:
            tokens.append({"type": "text", "value": offense[last:match.start()]})
        tokens.append({"type": "mention", "user_id": name_to_id[match.group(1)]})
        last = match.end()
    if last < len(offense):
        tokens.append({"type": "text", "value": offense[last:]})

    return tokens or [{"type": "text", "value": offense}]


def upgrade() -> None:
    op.add_column("bongs", sa.Column("offense_tokens", postgresql.JSONB(), nullable=True))

    conn = op.get_bind()
    rows = conn.execute(sa.text("""
        SELECT
            b.id::text,
            b.offense,
            COALESCE(
                json_agg(
                    json_build_object(
                        'user_id', bs.user_id::text,
                        'display_name', u.display_name
                    )
                ) FILTER (WHERE bs.user_id IS NOT NULL),
                '[]'::json
            ) AS subjects
        FROM bongs b
        LEFT JOIN bong_subjects bs ON b.id = bs.bong_id
        LEFT JOIN users u ON bs.user_id = u.id
        GROUP BY b.id, b.offense
    """)).fetchall()

    for row in rows:
        bong_id, offense, subjects_raw = row
        if isinstance(subjects_raw, str):
            subjects = json.loads(subjects_raw)
        else:
            subjects = subjects_raw or []
        tokens = _tokenize(offense, subjects)
        conn.execute(
            sa.text("UPDATE bongs SET offense_tokens = cast(:tokens as jsonb) WHERE id = cast(:id as uuid)"),
            {"tokens": json.dumps(tokens), "id": bong_id},
        )

    op.alter_column("bongs", "offense_tokens", nullable=False)
    op.drop_column("bongs", "offense")


def downgrade() -> None:
    op.add_column("bongs", sa.Column("offense", sa.String(), nullable=True))

    conn = op.get_bind()
    rows = conn.execute(sa.text("SELECT id::text, offense_tokens FROM bongs")).fetchall()
    for row in rows:
        bong_id, tokens_raw = row
        if isinstance(tokens_raw, str):
            tokens = json.loads(tokens_raw)
        else:
            tokens = tokens_raw or []
        offense = "".join(
            t["value"] if t["type"] == "text" else f"@someone"
            for t in tokens
        )
        conn.execute(
            sa.text("UPDATE bongs SET offense = :offense WHERE id = cast(:id as uuid)"),
            {"offense": offense, "id": bong_id},
        )

    op.alter_column("bongs", "offense", nullable=False)
    op.drop_column("bongs", "offense_tokens")
