import asyncio
import unittest
from unittest.mock import AsyncMock, patch

import algae_database
from app.routers import species


class CompiledSpeciesTests(unittest.TestCase):
    def _info(self, row):
        with (
            patch.object(algae_database, "get_curated_species", return_value=row),
            patch.object(algae_database, "match_gbif", new=AsyncMock(return_value=None)),
        ):
            return asyncio.run(algae_database.get_species_info("Planktothrix"))

    def test_draft_records_are_reported_as_compiled(self):
        info = self._info({"genus": "Planktothrix", "review_status": "draft"})
        self.assertEqual(info["source"], "compiled")
        self.assertFalse(info["is_fallback"])

    def test_reviewed_and_legacy_records_are_curated(self):
        self.assertEqual(self._info({"genus": "Microcystis", "review_status": "reviewed"})["source"], "curated")
        self.assertEqual(self._info({"genus": "Microcystis"})["source"], "curated")

    def test_thumbnail_falls_back_to_credited_images(self):
        self.assertEqual(species.thumbnail_of({"reference_images": ["a.jpg"], "image_credits": [{"thumb": "b.jpg"}]}), "a.jpg")
        self.assertEqual(species.thumbnail_of({"reference_images": [], "image_credits": [{"url": "c.jpg", "thumb": "c-small.jpg"}]}), "c-small.jpg")
        self.assertIsNone(species.thumbnail_of({}))

    def test_summary_carries_review_status(self):
        summary = species._summary({"genus": "Alexandrium", "taxonomy": {"class": "Dinophyceae"}, "review_status": "draft"})
        self.assertEqual(summary["review_status"], "draft")
        self.assertEqual(summary["group"], "dinoflagellates")
        self.assertEqual(species._summary({"genus": "X"})["review_status"], "reviewed")


if __name__ == "__main__":
    unittest.main()
