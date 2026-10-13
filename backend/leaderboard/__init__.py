"""Opt-in leaderboards: each user's best score per passage, kept in MongoDB."""

from .router import router as leaderboard_router

__all__ = ["leaderboard_router"]
