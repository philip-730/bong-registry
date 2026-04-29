import pytest


async def create_user(client, *, google_id="g1", email="a@test.com", display_name="alpha"):
    res = await client.post("/service/users", json={
        "google_id": google_id,
        "email": email,
        "display_name": display_name,
    })
    return res


class TestCreateUser:
    async def test_creates_user(self, client):
        res = await create_user(client)
        assert res.status_code == 201
        data = res.json()
        assert data["display_name"] == "alpha"
        assert data["google_id"] == "g1"
        assert "id" in data

    async def test_duplicate_google_id_returns_409(self, client):
        await create_user(client)
        res = await create_user(client, email="other@test.com", display_name="other")
        assert res.status_code == 409

    async def test_duplicate_email_returns_409(self, client):
        await create_user(client)
        res = await create_user(client, google_id="g2", display_name="other")
        assert res.status_code == 409

    async def test_duplicate_display_name_returns_409(self, client):
        await create_user(client)
        res = await create_user(client, google_id="g2", email="other@test.com")
        assert res.status_code == 409


class TestListUsers:
    async def test_lists_all_users(self, client):
        await create_user(client, google_id="g1", email="a@test.com", display_name="alpha")
        await create_user(client, google_id="g2", email="b@test.com", display_name="beta")
        res = await client.get("/service/users")
        assert res.status_code == 200
        assert len(res.json()) == 2

    async def test_filter_by_google_id(self, client):
        await create_user(client, google_id="g1", email="a@test.com", display_name="alpha")
        await create_user(client, google_id="g2", email="b@test.com", display_name="beta")
        res = await client.get("/service/users?google_id=g1")
        assert res.status_code == 200
        data = res.json()
        assert len(data) == 1
        assert data[0]["google_id"] == "g1"

    async def test_cosigns_list(self, client, mocker):
        mocker.patch("app.routes.bongs._run_judge")
        u1 = (await create_user(client, google_id="g1", email="a@test.com", display_name="alpha")).json()
        u2 = (await create_user(client, google_id="g2", email="b@test.com", display_name="beta")).json()

        bong_res = await client.post("/service/bongs", json={
            "submitter_id": u1["id"],
            "offense_tokens": [{"type": "mention", "user_id": u2["id"]}],
        })
        bong_id = bong_res.json()["id"]
        await client.post(f"/service/bongs/{bong_id}/cosign?user_id={u1['id']}")

        res = await client.get(f"/service/users/{u1['id']}/cosigns")
        assert res.status_code == 200
        assert bong_id in res.json()


class TestUpdateUser:
    async def test_updates_display_name(self, client):
        res = await create_user(client)
        user_id = res.json()["id"]
        res = await client.patch(f"/service/users/{user_id}", json={"display_name": "renamed"})
        assert res.status_code == 200
        assert res.json()["display_name"] == "renamed"

    async def test_taken_display_name_returns_409(self, client):
        u1 = (await create_user(client, google_id="g1", email="a@test.com", display_name="alpha")).json()
        await create_user(client, google_id="g2", email="b@test.com", display_name="beta")
        res = await client.patch(f"/service/users/{u1['id']}", json={"display_name": "beta"})
        assert res.status_code == 409

    async def test_same_name_is_ok(self, client):
        res = await create_user(client)
        user_id = res.json()["id"]
        res = await client.patch(f"/service/users/{user_id}", json={"display_name": "alpha"})
        assert res.status_code == 200

    async def test_unknown_user_returns_404(self, client):
        res = await client.patch("/service/users/00000000-0000-0000-0000-000000000000", json={"display_name": "x"})
        assert res.status_code == 404
