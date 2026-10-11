"""Opt-in leaderboards kept in Redis (sorted sets of each user's best score per passage)."""

from .router import router as leaderboard_router

__all__ = ["leaderboard_router"]
