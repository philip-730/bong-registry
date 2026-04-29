import pytest
from decimal import Decimal


async def make_user(client, *, google_id, email, display_name):
    res = await client.post("/service/users", json={
        "google_id": google_id, "email": email, "display_name": display_name,
    })
    assert res.status_code == 201
    return res.json()


async def submit_and_judge(client, db, submitter_id, subject_id, score, tier):
    """Submit a bong and manually set the score/tier (bypassing LLM)."""
    from app.models import Bong
    from sqlalchemy import select

    res = await client.post("/service/bongs", json={
        "submitter_id": submitter_id,
        "offense_tokens": [{"type": "mention", "user_id": subject_id}],
    })
    assert res.status_code == 201
    bong_id = res.json()["id"]

    result = await db.execute(select(Bong).where(Bong.id == bong_id))
    bong = result.scalar_one()
    bong.score = score
    bong.tier = tier
    bong.llm_response = "deadass od bong"
    await db.commit()
    return bong_id


class TestLeaderboard:
    async def test_returns_ranked_entries(self, client, db, mocker):
        mocker.patch("app.routes.bongs._run_judge")
        u1 = await make_user(client, google_id="g1", email="a@test.com", display_name="alpha")
        u2 = await make_user(client, google_id="g2", email="b@test.com", display_name="beta")
        u3 = await make_user(client, google_id="g3", email="c@test.com", display_name="gamma")

        await submit_and_judge(client, db, u1["id"], u2["id"], score=8.0, tier="od bong")
        await submit_and_judge(client, db, u1["id"], u3["id"], score=3.0, tier="mini bong")

        res = await client.get("/service/leaderboard?period=all")
        assert res.status_code == 200
        data = res.json()
        assert len(data) == 2
        # u2 has score 8.0, u3 has 3.0 — u2 should be rank 1
        assert data[0]["display_name"] == "beta"
        assert data[0]["rank"] == 1
        assert data[1]["display_name"] == "gamma"
        assert data[1]["rank"] == 2

    async def test_invalid_period_returns_400(self, client):
        res = await client.get("/service/leaderboard?period=decade")
        assert res.status_code == 400

    async def test_invalid_sort_returns_400(self, client):
        res = await client.get("/service/leaderboard?sort=vibes")
        assert res.status_code == 400

    async def test_empty_leaderboard(self, client):
        res = await client.get("/service/leaderboard?period=all")
        assert res.status_code == 200
        assert res.json() == []


class TestBongOfThePeriod:
    async def test_returns_highest_score_bong(self, client, db, mocker):
        mocker.patch("app.routes.bongs._run_judge")
        u1 = await make_user(client, google_id="g1", email="a@test.com", display_name="alpha")
        u2 = await make_user(client, google_id="g2", email="b@test.com", display_name="beta")

        await submit_and_judge(client, db, u1["id"], u2["id"], score=5.0, tier="half bong")
        b2 = await submit_and_judge(client, db, u1["id"], u2["id"], score=9.1, tier="oddd bong")

        res = await client.get("/service/bong-of-the-period?period=month")
        assert res.status_code == 200
        assert res.json()["id"] == b2

    async def test_no_bongs_returns_404(self, client):
        res = await client.get("/service/bong-of-the-period?period=week")
        assert res.status_code == 404

    async def test_invalid_period_returns_400(self, client):
        res = await client.get("/service/bong-of-the-period?period=all")
        assert res.status_code == 400
