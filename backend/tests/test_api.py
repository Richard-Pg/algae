import io
import unittest
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient
from PIL import Image

import algae_identifier
import app.auth
import app.db
from app.config import get_settings
from app.rate_limit import identify_limiter
from main import app as fastapi_app
from tests.fakes import FakeSupabase

USERS = {
    "token-alice": {"id": "alice", "email": "alice@example.org", "user_metadata": {"display_name": "Alice"}},
    "token-bob": {"id": "bob", "email": "bob@example.org", "user_metadata": {}},
    "token-admin": {"id": "admin", "email": "haiming.peng@outlook.com", "user_metadata": {}},
}

AI_RESULT = {
    "identified": True,
    "is_harmful": True,
    "primary_identification": {"genus": "Microcystis", "species": "Microcystis aeruginosa", "confidence": 0.87},
    "alternative_identifications": [{"genus": "Dolichospermum", "species": "spp.", "confidence": 0.09}],
    "database_info": {"taxonomy": {"phylum": "Cyanobacteria"}, "toxin": {"risk_level": "High"}},
}


def image_bytes(fmt="PNG", mode="RGB"):
    buf = io.BytesIO()
    Image.new(mode, (40, 30), (20, 120, 60) if mode == "RGB" else 1000).save(buf, format=fmt)
    return buf.getvalue()


def auth(token):
    return {"Authorization": f"Bearer {token}"}


def fake_verify(token):
    if token not in USERS:
        raise ValueError("bad token")
    return USERS[token]


class ApiTestCase(unittest.TestCase):
    def setUp(self):
        self.db = FakeSupabase()
        app.db._service_client = self.db
        identify_limiter.reset()
        self.patches = [
            patch.object(app.auth, "verify_access_token", side_effect=fake_verify),
            patch.object(algae_identifier, "identify_algae", new=AsyncMock(return_value=dict(AI_RESULT))),
        ]
        for p in self.patches:
            p.start()
        self.client = TestClient(fastapi_app)

    def tearDown(self):
        for p in self.patches:
            p.stop()
        app.db._service_client = None

    def identify(self, headers=None, data=None, name="cells.png", ctype="image/png"):
        return self.client.post(
            "/api/identify",
            files={"file": (name, data or image_bytes(), ctype)},
            headers=headers or {},
        )


class IdentifyTests(ApiTestCase):
    def test_anonymous_identification_is_saved_and_viewable_by_link(self):
        response = self.identify()
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertTrue(body["id"])
        self.assertTrue(body["image_url"].startswith("https://signed.example/uploads/identifications/anonymous/"))
        self.assertEqual(body["primary_identification"]["genus"], "Microcystis")
        self.assertEqual(body["quota"]["remaining"], get_settings().anon_daily_limit - 1)

        fetched = self.client.get(f"/api/identifications/{body['id']}")
        self.assertEqual(fetched.status_code, 200)
        self.assertEqual(fetched.json()["primary_identification"]["species"], "Microcystis aeruginosa")

    def test_anonymous_limit_is_enforced_on_the_server(self):
        for _ in range(get_settings().anon_daily_limit):
            self.assertEqual(self.identify().status_code, 200)
        blocked = self.identify()
        self.assertEqual(blocked.status_code, 429)
        self.assertEqual(blocked.json()["detail"]["code"], "rate_limited")
        # Signed-in users have their own allowance.
        self.assertEqual(self.identify(auth("token-alice")).status_code, 200)

    def test_failed_identification_does_not_use_quota(self):
        with patch.object(algae_identifier, "identify_algae", new=AsyncMock(side_effect=RuntimeError("boom"))):
            self.assertEqual(self.identify().status_code, 502)
        self.assertEqual(self.client.get("/api/quota").json()["remaining"], get_settings().anon_daily_limit)

    def test_private_results_are_hidden_from_other_users_until_shared(self):
        result_id = self.identify(auth("token-alice")).json()["id"]
        self.assertEqual(self.client.get(f"/api/identifications/{result_id}").status_code, 404)
        self.assertEqual(self.client.get(f"/api/identifications/{result_id}", headers=auth("token-bob")).status_code, 404)
        own = self.client.get(f"/api/identifications/{result_id}", headers=auth("token-alice"))
        self.assertTrue(own.json()["is_owner"])

        self.client.patch(f"/api/identifications/{result_id}", json={"is_shared": True}, headers=auth("token-alice"))
        self.assertEqual(self.client.get(f"/api/identifications/{result_id}").status_code, 200)

    def test_history_lists_only_own_results_and_filters_harmful(self):
        self.identify(auth("token-alice"))
        self.identify(auth("token-bob"))
        listing = self.client.get("/api/identifications", headers=auth("token-alice")).json()
        self.assertEqual(listing["total"], 1)
        self.assertEqual(listing["items"][0]["genus"], "Microcystis")
        self.assertTrue(listing["items"][0]["is_harmful"])
        harmful = self.client.get("/api/identifications?harmful=true", headers=auth("token-alice")).json()
        self.assertEqual(harmful["total"], 1)

    def test_owner_can_delete_but_others_cannot(self):
        result_id = self.identify(auth("token-alice")).json()["id"]
        self.assertEqual(self.client.delete(f"/api/identifications/{result_id}", headers=auth("token-bob")).status_code, 404)
        self.assertEqual(self.client.delete(f"/api/identifications/{result_id}", headers=auth("token-alice")).status_code, 200)
        self.assertEqual(self.db.store["identification_history"], [])

    def test_unauthenticated_history_wipe_endpoint_is_gone(self):
        self.assertIn(self.client.delete("/api/history").status_code, (404, 405))

    def test_rejects_non_images_and_accepts_16_bit_tiff(self):
        bad = self.identify(data=b"not an image", name="notes.png")
        self.assertEqual(bad.status_code, 400)
        tiff = self.identify(data=image_bytes("TIFF", "I;16"), name="scope.tif", ctype="image/tiff")
        self.assertEqual(tiff.status_code, 200)

    def test_invalid_token_is_an_error_not_anonymous(self):
        self.assertEqual(self.identify(auth("expired")).status_code, 401)


class SubmissionAndReviewTests(ApiTestCase):
    def submit_from_identification(self):
        result_id = self.identify(auth("token-alice")).json()["id"]
        response = self.client.post(
            "/api/submissions",
            data={"identification_id": result_id, "proposed_genus": " Microcystis ", "proposed_species": "aeruginosa",
                  "submitted_references": '["https://www.algaebase.org"]'},
            headers=auth("token-alice"),
        )
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()["submission_id"]

    def test_submission_reuses_identification_image_and_ai_result(self):
        sid = self.submit_from_identification()
        row = self.db.store["species_submissions"][0]
        self.assertEqual(row["id"], sid)
        self.assertEqual(row["proposed_genus"], "Microcystis")
        self.assertTrue(row["image_path"].startswith("identifications/alice/"))
        self.assertEqual(row["ai_analysis"]["primary_identification"]["genus"], "Microcystis")
        self.assertEqual(row["submitted_references"][0]["url"], "https://www.algaebase.org")
        algae_identifier.identify_algae.assert_awaited_once()  # not re-run for the submission

    def test_cannot_submit_someone_elses_identification(self):
        result_id = self.identify(auth("token-alice")).json()["id"]
        response = self.client.post(
            "/api/submissions", data={"identification_id": result_id, "proposed_genus": "X"}, headers=auth("token-bob")
        )
        self.assertEqual(response.status_code, 404)

    def test_admin_routes_require_admin(self):
        self.assertEqual(self.client.get("/api/admin/submissions", headers=auth("token-alice")).status_code, 403)
        self.assertEqual(self.client.get("/api/admin/submissions").status_code, 401)

    def test_approval_publishes_image_and_creates_species(self):
        sid = self.submit_from_identification()
        queue = self.client.get("/api/admin/submissions", headers=auth("token-admin")).json()
        self.assertEqual(queue["counts"]["pending"], 1)
        self.assertTrue(queue["submissions"][0]["image_url"].startswith("https://signed.example/"))

        response = self.client.post(f"/api/admin/submissions/{sid}/approve", json={"admin_notes": "Nice"},
                                    headers=auth("token-admin"))
        self.assertEqual(response.status_code, 200, response.text)
        species = self.db.store["algae_species"][0]
        self.assertEqual(species["genus"], "Microcystis")
        self.assertTrue(species["reference_images"][0].startswith("https://public.example/algae_images/species/"))
        submission = self.db.store["species_submissions"][0]
        self.assertEqual(submission["status"], "approved")
        self.assertEqual(submission["published_image_url"], species["reference_images"][0])

        detail = self.client.get("/api/species/microcystis").json()
        self.assertEqual(detail["group"], "cyanobacteria")
        self.assertEqual(len(detail["contributions"]), 1)

    def test_revision_loop(self):
        sid = self.submit_from_identification()
        missing_notes = self.client.post(f"/api/admin/submissions/{sid}/request-revision", json={"admin_notes": ""},
                                         headers=auth("token-admin"))
        self.assertEqual(missing_notes.status_code, 400)
        self.client.post(f"/api/admin/submissions/{sid}/request-revision",
                         json={"admin_notes": "Add a scale bar"}, headers=auth("token-admin"))
        mine = self.client.get("/api/submissions/mine", headers=auth("token-alice")).json()
        self.assertEqual(mine["counts"]["needs_revision"], 1)
        self.assertNotIn("user_email", mine["items"][0])

        revised = self.client.put(f"/api/submissions/{sid}", json={"user_notes": "Added a scale bar"},
                                  headers=auth("token-alice"))
        self.assertEqual(revised.status_code, 200)
        self.assertEqual(self.db.store["species_submissions"][0]["status"], "pending")

        self.client.post(f"/api/admin/submissions/{sid}/reject", json={}, headers=auth("token-admin"))
        locked = self.client.put(f"/api/submissions/{sid}", json={"user_notes": "again"}, headers=auth("token-alice"))
        self.assertEqual(locked.status_code, 409)


class SpeciesAndMeTests(ApiTestCase):
    def test_species_list_groups_and_filters(self):
        self.db.store["algae_species"] = [
            {"id": "1", "genus": "Microcystis", "taxonomy": {"phylum": "Cyanobacteria"}, "toxin": {"produces_toxin": True, "risk_level": "High"}},
            {"id": "2", "genus": "Navicula", "taxonomy": {"phylum": "Bacillariophyta"}, "toxin": {"produces_toxin": False}},
        ]
        everything = self.client.get("/api/species").json()
        self.assertEqual(everything["total"], 2)
        groups = {g["id"]: g["count"] for g in everything["groups"]}
        self.assertEqual(groups["cyanobacteria"], 1)
        self.assertEqual(groups["diatoms"], 1)
        self.assertEqual(self.client.get("/api/species?harmful=true").json()["items"][0]["genus"], "Microcystis")
        self.assertEqual(self.client.get("/api/species?q=navi").json()["total"], 1)
        self.assertEqual(self.client.get("/api/species/Unknownia").status_code, 404)

    def test_me_reports_admin_flag(self):
        self.assertFalse(self.client.get("/api/me", headers=auth("token-alice")).json()["is_admin"])
        self.assertTrue(self.client.get("/api/me", headers=auth("token-admin")).json()["is_admin"])


if __name__ == "__main__":
    unittest.main()
