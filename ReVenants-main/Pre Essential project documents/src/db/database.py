"""Supabase connection factory.

The client is created lazily so importing the application does not require a
network connection. The schema itself is defined in ``supabase_schema.sql``.
"""

from __future__ import annotations

import os
from functools import lru_cache
from typing import Any


@lru_cache(maxsize=1)
def get_supabase_client() -> Any:
    """Return the shared Supabase client configured by environment variables.

    ``SUPABASE_KEY`` should be the server-side service-role key for the bot
    worker, or an appropriately restricted key when Row Level Security is
    enabled. Never commit the key to source control.
    """

    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_KEY")
    if not url or not key:
        raise RuntimeError(
            "SUPABASE_URL and SUPABASE_KEY must be set before using the database"
        )

    try:
        from supabase import create_client
    except ImportError as exc:
        raise RuntimeError(
            "The Supabase Python client is required. Install it with: "
            "pip install supabase"
        ) from exc

    return create_client(url, key)
