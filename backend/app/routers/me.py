"""The signed-in user's profile and stats."""

from fastapi import APIRouter, Depends

from app.auth import CurrentUser, get_current_user
from app.db import get_supabase

router = APIRouter(prefix="/api", tags=["me"])


@router.get("/me")
def me(user: CurrentUser = Depends(get_current_user)):
    stats = {"identifications": 0, "harmful": 0}
    try:
        sb = get_supabase()
        stats["identifications"] = (
            sb.table("identification_history").select("id", count="exact", head=True)
            .eq("user_id", user.id).execute().count or 0
        )
        stats["harmful"] = (
            sb.table("identification_history").select("id", count="exact", head=True)
            .eq("user_id", user.id).eq("result->>is_harmful", "true").execute().count or 0
        )
    except Exception:
        pass
    return {
        "id": user.id,
        "email": user.email,
        "display_name": user.display_name,
        "is_admin": user.is_admin,
        "stats": stats,
    }
