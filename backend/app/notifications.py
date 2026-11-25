"""Email notifications for contributions (SMTP, optional)."""

import logging
import os
import smtplib
from datetime import datetime, timezone
from email.message import EmailMessage

from app.config import env, env_flag, env_int, get_settings
from app.db import get_supabase

log = logging.getLogger(__name__)
SETTING_KEY = "contribution_email_notifications"


def smtp_configured() -> bool:
    return all(env(name) for name in ("SMTP_HOST", "SMTP_USERNAME", "SMTP_PASSWORD"))


def notifications_enabled() -> bool:
    try:
        row = (
            get_supabase().table("admin_settings").select("value")
            .eq("key", SETTING_KEY).single().execute()
        )
        if row.data and isinstance(row.data.get("value"), dict):
            return bool(row.data["value"].get("enabled", False))
    except Exception as exc:
        log.info("Notification setting lookup failed; using env default: %s", exc)
    return env_flag("CONTRIBUTION_EMAIL_NOTIFICATIONS", False)


def set_notifications_enabled(enabled: bool) -> None:
    get_supabase().table("admin_settings").upsert({
        "key": SETTING_KEY,
        "value": {"enabled": enabled},
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }).execute()


def _send(to: str, subject: str, body: str) -> None:
    if not smtp_configured() or not to:
        log.info("Email skipped (SMTP not configured or no recipient): %s", subject)
        return
    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = env("SMTP_FROM_EMAIL") or env("SMTP_USERNAME")
    message["To"] = to
    message.set_content(body)
    try:
        with smtplib.SMTP(env("SMTP_HOST"), env_int("SMTP_PORT", 587), timeout=10) as server:
            if env_flag("SMTP_USE_TLS", True):
                server.starttls()
            server.login(env("SMTP_USERNAME"), os.environ.get("SMTP_PASSWORD", ""))
            server.send_message(message)
    except Exception as exc:
        log.warning("Email failed (%s): %s", subject, exc)


def species_label(submission: dict) -> str:
    name = submission.get("proposed_genus") or "Unknown genus"
    if submission.get("proposed_species"):
        name += f" {submission['proposed_species']}"
    return name


def notify_new_submission(submission: dict) -> None:
    if not notifications_enabled():
        return
    settings = get_settings()
    _send(
        settings.notification_email,
        f"New AlgaeAI contribution: {species_label(submission)}",
        "\n".join([
            "A new observation is waiting for review.",
            "",
            f"Species: {species_label(submission)}",
            f"Contributor: {submission.get('user_name') or submission.get('user_email') or 'Unknown'}",
            f"Location: {submission.get('location_found') or 'Not provided'}",
            "",
            "Notes:",
            submission.get("user_notes") or "None",
            "",
            f"Review it here: {settings.frontend_url}/admin",
        ]),
    )


def notify_review_result(submission: dict, status: str, admin_notes: str = "") -> None:
    settings = get_settings()
    words = {
        "approved": ("approved", "has been approved and added to the open database"),
        "rejected": ("reviewed", "was not accepted"),
        "needs_revision": ("returned for revision", "needs a few changes before it can be accepted"),
    }
    subject_word, sentence = words.get(status, ("reviewed", "has been reviewed"))
    _send(
        (submission.get("user_email") or "").strip(),
        f"Your AlgaeAI observation was {subject_word}: {species_label(submission)}",
        "\n".join([
            f"Your observation of {species_label(submission)} {sentence}.",
            "",
            "Reviewer notes:",
            admin_notes.strip() or "No additional notes were provided.",
            "",
            f"See your contributions: {settings.frontend_url}/workspace",
        ]),
    )
