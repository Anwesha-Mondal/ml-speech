"""Leaderboards: opt-in only, best score per passage, version-locked, names from MongoDB."""

from __future__ import annotations

from typing import Any

import fakeredis
from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.auth.db import USERS
from backend.leaderboard import store
from backend.leaderboard.config import get_leaderboard_settings
from backend.leaderboard.router import submit_result

from .conftest import STRONG, csrf_headers, register


def _user(app: FastAPI, email: str, name: str, opt_in: bool = True) -> tuple[TestClient, dict[str, Any]]:
    c = TestClient(app, base_url="http://testserver")
    s = register(c, email=email, name=name)
    if opt_in:
        r = c.put("/api/leaderboard/opt-in", json={"opt_in": True}, headers=csrf_headers(s))
        assert r.status_code == 200
    return c, s


def test_opt_in_is_required_and_defaults_off(app: FastAPI) -> None:
    c, s = _user(app, "ana@example.com", "Ana", opt_in=False)
    assert s["user"]["leaderboard_opt_in"] is False
    res = submit_result(s["user"]["id"], "asset-07", 80)
    assert res["eligible"] is False
    assert c.get("/api/leaderboard?prompt_id=asset-07").json()["rankings"] == []


def test_best_score_only_goes_up(app: FastAPI) -> None:
    c, s = _user(app, "ana@example.com", "Ana")
    uid = s["user"]["id"]
    assert submit_result(uid, "asset-07", 70)["new_best"] is True
    assert submit_result(uid, "asset-07", 60)["new_best"] is False
    assert submit_result(uid, "asset-07", 85.456)["new_best"] is True
    board = c.get("/api/leaderboard?prompt_id=asset-07").json()
    assert board["rankings"] == [{"rank": 1, "display_name": "Ana", "score": 85.46, "you": True}]
    assert board["you"] == {"opted_in": True, "best_score": 85.46}
    assert board["scoring_version"] == get_leaderboard_settings().scoring_version


def test_unranked_passages_and_unknown_boards(app: FastAPI) -> None:
    c, s = _user(app, "ana@example.com", "Ana")
    assert submit_result(s["user"]["id"], "custom", 99)["eligible"] is False
    assert c.get("/api/leaderboard?prompt_id=custom").status_code == 404


def test_global_board_sums_bests_and_orders(app: FastAPI) -> None:
    a, sa = _user(app, "ana@example.com", "Ana")
    b, sb = _user(app, "bo@example.com", "Bo")
    submit_result(sa["user"]["id"], "asset-07", 90)
    submit_result(sb["user"]["id"], "asset-07", 80)
    submit_result(sb["user"]["id"], "asset-10", 50)
    board = a.get("/api/leaderboard").json()
    assert [(r["display_name"], r["score"]) for r in board["rankings"]] == [("Bo", 130.0), ("Ana", 90.0)]
    assert b.get("/api/leaderboard?prompt_id=asset-07").json()["rankings"][0]["display_name"] == "Ana"


def test_opt_out_removes_name_and_scores(app: FastAPI) -> None:
    a, sa = _user(app, "ana@example.com", "Ana")
    b, _ = _user(app, "bo@example.com", "Bo")
    submit_result(sa["user"]["id"], "asset-07", 90)
    r = a.put("/api/leaderboard/opt-in", json={"opt_in": False}, headers=csrf_headers(sa))
    assert r.json()["removed_scores"] == 1
    assert b.get("/api/leaderboard?prompt_id=asset-07").json()["rankings"] == []
    assert store.user_entries(sa["user"]["id"]) == []


def test_names_hidden_even_if_redis_still_has_the_id(app: FastAPI, db: Any) -> None:
    a, sa = _user(app, "ana@example.com", "Ana")
    submit_result(sa["user"]["id"], "asset-07", 90)
    db[USERS].update_one({"_id": sa["user"]["id"]}, {"$set": {"leaderboard_opt_in": False}})
    assert a.get("/api/leaderboard?prompt_id=asset-07").json()["rankings"] == []


def test_delete_account_removes_scores(app: FastAPI) -> None:
    a, sa = _user(app, "ana@example.com", "Ana")
    submit_result(sa["user"]["id"], "asset-07", 90)
    exported = a.get("/api/privacy/export").json()
    assert exported["leaderboard"][0]["prompt_id"] == "asset-07" and exported["account"]["leaderboard_opt_in"] is True
    ok = a.post("/api/privacy/delete-account", json={"password": STRONG, "confirm": "DELETE"}, headers=csrf_headers(sa))
    assert ok.status_code == 200
    assert store.user_entries(sa["user"]["id"]) == []


def test_requires_sign_in_and_csrf(app: FastAPI) -> None:
    c = TestClient(app, base_url="http://testserver")
    assert c.get("/api/leaderboard").status_code == 401
    s = register(c)
    assert c.put("/api/leaderboard/opt-in", json={"opt_in": True}).status_code == 403
    assert c.put("/api/leaderboard/opt-in", json={"opt_in": True}, headers=csrf_headers(s)).status_code == 200


def _down_redis() -> fakeredis.FakeRedis:
    server = fakeredis.FakeServer()
    server.connected = False  # every command raises ConnectionError
    return fakeredis.FakeRedis(server=server, decode_responses=True)


def test_redis_down_gives_503_and_keeps_the_analysis(app: FastAPI) -> None:
    from backend.redis_client import use_client

    a, sa = _user(app, "ana@example.com", "Ana")
    use_client(_down_redis())
    # Sessions live in the same Redis, so every signed-in request answers 503, not 500.
    assert a.get("/api/leaderboard").status_code == 503
    # A finished analysis is still returned; only the ranking is skipped.
    assert submit_result(sa["user"]["id"], "asset-07", 90)["submitted"] is False
