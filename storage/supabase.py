"""
Supabase Client and Integration Helper for Kramix V2.
Provides strongly-typed access to Supabase services (Auth, Storage, Database/REST)
while maintaining fallback safety when credentials are not yet configured.
"""
from __future__ import annotations
import logging
from typing import Optional, Any
from backend.app.config import get_settings

logger = logging.getLogger("kramix.storage.supabase")

_supabase_client: Optional[Any] = None


def get_supabase_client() -> Optional[Any]:
    """
    Returns an initialized Supabase client if `supabase` SDK is installed
    and `SUPABASE_URL` and `SUPABASE_KEY` / `SUPABASE_SERVICE_ROLE_KEY` are provided.
    Returns None if unconfigured or dependencies are missing.
    """
    global _supabase_client
    if _supabase_client is not None:
        return _supabase_client

    settings = get_settings()
    url = settings.SUPABASE_URL
    # Prefer service role key for backend operations; fallback to anon key
    key = settings.SUPABASE_SERVICE_ROLE_KEY or settings.SUPABASE_KEY

    if not url or not key:
        logger.debug("Supabase credentials not fully configured (SUPABASE_URL or key missing).")
        return None

    try:
        from supabase import create_client, Client
        _supabase_client = create_client(url, key)
        logger.info(f"Initialized Supabase client for project: {url.split('//')[-1].split('.')[0]}")
        return _supabase_client
    except ImportError:
        logger.debug("The 'supabase' Python package is not installed. To use direct Supabase SDK: pip install supabase")
        return None
    except Exception as exc:
        logger.error(f"Failed to initialize Supabase client: {exc}")
        return None


def is_supabase_configured() -> bool:
    """Checks whether Supabase URL and keys are populated."""
    settings = get_settings()
    return bool(settings.SUPABASE_URL and (settings.SUPABASE_KEY or settings.SUPABASE_SERVICE_ROLE_KEY))
