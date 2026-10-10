"""Privacy: legal documents, consent records, data export, account deletion and retention.
Settings live in configs/privacy/privacy.yaml; documents in docs/legal/*.md."""

from .router import router as privacy_router

__all__ = ["privacy_router"]
