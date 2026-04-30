import uuid
import pytest


async def make_user(client, *, google_id="g1", email="a@test.com", display_name="alpha"):
    res = await client.post("/service/users", json={
        "google_id": google_id,
        "email": email,
        "display_name": display_name,
    })
    assert res.status_code == 201
    return res.json()


async def submit_bong(client, submitter_id, subject_id, offense_tokens=None):
    if offense_tokens is None:
        offense_tokens = [
            {"type": "text", "value": "did something dumb "},
            {"type": "mention", "user_id": subject_id},
        ]
    return await client.post("/service/bongs", json={
        "submitter_id": submitter_id,
        "offense_tokens": offense_tokens,
    })


class TestSubmitBong:
    async def test_creates_bong(self, client, mocker):
        mocker.patch("app.routes.bongs._run_judge")
        u1 = await make_user(client, google_id="g1", email="a@test.com", display_name="alpha")
        u2 = await make_user(client, google_id="g2", email="b@test.com", display_name="beta")

        res = await submit_bong(client, u1["id"], u2["id"])
        assert res.status_code == 201
        data = res.json()
        assert data["submitter"]["id"] == u1["id"]
        assert any(s["id"] == u2["id"] for s in data["subjects"])
        assert data["score"] is None
        assert data["tier"] is None

    async def test_no_mentions_returns_400(self, client):
        u1 = await make_user(client)
        res = await client.post("/service/bongs", json={
            "submitter_id": u1["id"],
            "offense_tokens": [{"type": "text", "value": "just text no mention"}],
        })
        assert res.status_code == 400

    async def test_unknown_submitter_returns_404(self, client):
        fake_id = str(uuid.uuid4())
        res = await client.post("/service/bongs", json={
            "submitter_id": fake_id,
            "offense_tokens": [{"type": "mention", "user_id": fake_id}],
        })
        assert res.status_code == 404

    async def test_unknown_subject_returns_404(self, client):
        u1 = await make_user(client)
        fake_id = str(uuid.uuid4())
        res = await submit_bong(client, u1["id"], fake_id)
        assert res.status_code == 404

    async def test_offense_tokens_stored(self, client, mocker):
        mocker.patch("app.routes.bongs._run_judge")
        u1 = await make_user(client, google_id="g1", email="a@test.com", display_name="alpha")
        u2 = await make_user(client, google_id="g2", email="b@test.com", display_name="beta")

        tokens = [
            {"type": "text", "value": "bro "},
            {"type": "mention", "user_id": u2["id"]},
            {"type": "text", "value": " ur buggin"},
        ]
        res = await submit_bong(client, u1["id"], u2["id"], offense_tokens=tokens)
        assert res.status_code == 201
        assert res.json()["offense_tokens"] == tokens


class TestListBongs:
    async def test_lists_bongs(self, client, mocker):
        mocker.patch("app.routes.bongs._run_judge")
        u1 = await make_user(client, google_id="g1", email="a@test.com", display_name="alpha")
        u2 = await make_user(client, google_id="g2", email="b@test.com", display_name="beta")
        await submit_bong(client, u1["id"], u2["id"])

        res = await client.get("/service/bongs")
        assert res.status_code == 200
        assert len(res.json()) == 1

    async def test_filter_by_submitter(self, client, mocker):
        mocker.patch("app.routes.bongs._run_judge")
        u1 = await make_user(client, google_id="g1", email="a@test.com", display_name="alpha")
        u2 = await make_user(client, google_id="g2", email="b@test.com", display_name="beta")
        u3 = await make_user(client, google_id="g3", email="c@test.com", display_name="gamma")
        await submit_bong(client, u1["id"], u2["id"])
        await submit_bong(client, u3["id"], u2["id"])

        res = await client.get(f"/service/bongs?submitter_id={u1['id']}")
        assert res.status_code == 200
        data = res.json()
        assert len(data) == 1
        assert data[0]["submitter"]["id"] == u1["id"]

    async def test_filter_by_subject(self, client, mocker):
        mocker.patch("app.routes.bongs._run_judge")
        u1 = await make_user(client, google_id="g1", email="a@test.com", display_name="alpha")
        u2 = await make_user(client, google_id="g2", email="b@test.com", display_name="beta")
        u3 = await make_user(client, google_id="g3", email="c@test.com", display_name="gamma")
        await submit_bong(client, u1["id"], u2["id"])
        await submit_bong(client, u1["id"], u3["id"])

        res = await client.get(f"/service/bongs?subject_id={u2['id']}")
        assert res.status_code == 200
        data = res.json()
        assert len(data) == 1
        assert any(s["id"] == u2["id"] for s in data[0]["subjects"])


class TestGetBong:
    async def test_get_bong(self, client, mocker):
        mocker.patch("app.routes.bongs._run_judge")
        u1 = await make_user(client, google_id="g1", email="a@test.com", display_name="alpha")
        u2 = await make_user(client, google_id="g2", email="b@test.com", display_name="beta")
        bong = (await submit_bong(client, u1["id"], u2["id"])).json()

        res = await client.get(f"/service/bongs/{bong['id']}")
        assert res.status_code == 200
        assert res.json()["id"] == bong["id"]

    async def test_unknown_bong_returns_404(self, client):
        res = await client.get("/service/bongs/00000000-0000-0000-0000-000000000000")
        assert res.status_code == 404

    async def test_multiple_subjects(self, client, mocker):
        mocker.patch("app.routes.bongs._run_judge")
        u1 = await make_user(client, google_id="g1", email="a@test.com", display_name="alpha")
        u2 = await make_user(client, google_id="g2", email="b@test.com", display_name="beta")
        u3 = await make_user(client, google_id="g3", email="c@test.com", display_name="gamma")

        tokens = [
            {"type": "mention", "user_id": u2["id"]},
            {"type": "text", "value": " and "},
            {"type": "mention", "user_id": u3["id"]},
            {"type": "text", "value": " both buggin"},
        ]
        res = await submit_bong(client, u1["id"], u2["id"], offense_tokens=tokens)
        assert res.status_code == 201
        subject_ids = {s["id"] for s in res.json()["subjects"]}
        assert u2["id"] in subject_ids
        assert u3["id"] in subject_ids

    async def test_cosign_count_increments(self, client, mocker):
        mocker.patch("app.routes.bongs._run_judge")
        u1 = await make_user(client, google_id="g1", email="a@test.com", display_name="alpha")
        u2 = await make_user(client, google_id="g2", email="b@test.com", display_name="beta")
        bong = (await submit_bong(client, u1["id"], u2["id"])).json()
        assert bong["cosign_count"] == 0

        await client.post(f"/service/bongs/{bong['id']}/cosign?user_id={u2['id']}")
        res = await client.get(f"/service/bongs/{bong['id']}")
        assert res.json()["cosign_count"] == 1


class TestCosign:
    async def test_cosign(self, client, mocker):
        mocker.patch("app.routes.bongs._run_judge")
        u1 = await make_user(client, google_id="g1", email="a@test.com", display_name="alpha")
        u2 = await make_user(client, google_id="g2", email="b@test.com", display_name="beta")
        bong = (await submit_bong(client, u1["id"], u2["id"])).json()

        res = await client.post(f"/service/bongs/{bong['id']}/cosign?user_id={u2['id']}")
        assert res.status_code == 201

    async def test_duplicate_cosign_returns_409(self, client, mocker):
        mocker.patch("app.routes.bongs._run_judge")
        u1 = await make_user(client, google_id="g1", email="a@test.com", display_name="alpha")
        u2 = await make_user(client, google_id="g2", email="b@test.com", display_name="beta")
        bong = (await submit_bong(client, u1["id"], u2["id"])).json()

        await client.post(f"/service/bongs/{bong['id']}/cosign?user_id={u2['id']}")
        res = await client.post(f"/service/bongs/{bong['id']}/cosign?user_id={u2['id']}")
        assert res.status_code == 409

    async def test_remove_cosign(self, client, mocker):
        mocker.patch("app.routes.bongs._run_judge")
        u1 = await make_user(client, google_id="g1", email="a@test.com", display_name="alpha")
        u2 = await make_user(client, google_id="g2", email="b@test.com", display_name="beta")
        bong = (await submit_bong(client, u1["id"], u2["id"])).json()

        await client.post(f"/service/bongs/{bong['id']}/cosign?user_id={u2['id']}")
        res = await client.delete(f"/service/bongs/{bong['id']}/cosign?user_id={u2['id']}")
        assert res.status_code == 200

    async def test_remove_nonexistent_cosign_returns_404(self, client, mocker):
        mocker.patch("app.routes.bongs._run_judge")
        u1 = await make_user(client, google_id="g1", email="a@test.com", display_name="alpha")
        u2 = await make_user(client, google_id="g2", email="b@test.com", display_name="beta")
        bong = (await submit_bong(client, u1["id"], u2["id"])).json()

        res = await client.delete(f"/service/bongs/{bong['id']}/cosign?user_id={u2['id']}")
        assert res.status_code == 404

    async def test_get_cosigners(self, client, mocker):
        mocker.patch("app.routes.bongs._run_judge")
        u1 = await make_user(client, google_id="g1", email="a@test.com", display_name="alpha")
        u2 = await make_user(client, google_id="g2", email="b@test.com", display_name="beta")
        u3 = await make_user(client, google_id="g3", email="c@test.com", display_name="gamma")
        bong = (await submit_bong(client, u1["id"], u2["id"])).json()

        await client.post(f"/service/bongs/{bong['id']}/cosign?user_id={u2['id']}")
        await client.post(f"/service/bongs/{bong['id']}/cosign?user_id={u3['id']}")

        res = await client.get(f"/service/bongs/{bong['id']}/cosigns")
        assert res.status_code == 200
        names = [u["display_name"] for u in res.json()]
        assert names == ["beta", "gamma"]

    async def test_get_cosigners_empty(self, client, mocker):
        mocker.patch("app.routes.bongs._run_judge")
        u1 = await make_user(client, google_id="g1", email="a@test.com", display_name="alpha")
        u2 = await make_user(client, google_id="g2", email="b@test.com", display_name="beta")
        bong = (await submit_bong(client, u1["id"], u2["id"])).json()

        res = await client.get(f"/service/bongs/{bong['id']}/cosigns")
        assert res.status_code == 200
        assert res.json() == []
