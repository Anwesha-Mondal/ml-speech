"""RAG query endpoint (megaev.md §11.6). Retrieval only: nothing here scores speech."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from backend.auth.db import User
from backend.auth.sessions import require_user

from .retriever import get_rag_settings, get_retriever

router = APIRouter(prefix="/rag", tags=["rag"])


class RagQuery(BaseModel):
    domain: str = Field(max_length=32)
    query_text: str = Field(min_length=1, max_length=2000)
    filters: dict[str, str] = Field(default_factory=dict, max_length=5)
    top_k: int = Field(default=3, ge=1, le=10)


@router.post("/query")
def query(body: RagQuery, _: User = Depends(require_user)) -> dict[str, Any]:
    cfg = get_rag_settings()
    if body.domain not in cfg.domains:
        raise HTTPException(422, f"Unknown domain. Use one of: {', '.join(cfg.domains)}.")
    hits = get_retriever().search(body.domain, body.query_text, body.filters, body.top_k)
    return {
        "rag_version": cfg.version,
        "results": [
            {
                "document_id": d["document_id"],
                "domain": d["domain"],
                "title": d["title"],
                "content": d["content"],
                "metadata": d["metadata"],
                "score": score,
            }
            for d, score in hits
        ],
    }
