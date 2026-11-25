import io
import unittest

from PIL import Image

import algae_database
from algae_identifier import normalize_result
from app.images import HEIF_SUPPORTED, normalize_image


class GbifMatchTests(unittest.TestCase):
    def test_prefers_algal_kingdom_over_snail_homonym(self):
        payload = {
            "matchType": "NONE",
            "alternatives": [
                {"usageKey": 1, "kingdom": "Animalia", "matchType": "EXACT", "confidence": 97, "genus": "Microcystis"},
                {"usageKey": 2, "genusKey": 2, "kingdom": "Bacteria", "matchType": "EXACT", "confidence": 96, "genus": "Microcystis"},
            ],
        }
        self.assertEqual(algae_database._pick_algal_match(payload)["usageKey"], 2)

    def test_no_algal_match_returns_none(self):
        payload = {"usageKey": 9, "kingdom": "Animalia", "matchType": "EXACT", "confidence": 99}
        self.assertIsNone(algae_database._pick_algal_match(payload))


class NormalizeResultTests(unittest.TestCase):
    def test_percent_confidences_become_fractions_and_alternatives_sort(self):
        result = normalize_result({
            "identified": True,
            "primary_identification": {"genus": "A", "confidence": 87},
            "alternative_identifications": [{"genus": "B", "confidence": 0.04}, {"genus": "C", "confidence": "0.09"}, "junk"],
        })
        self.assertAlmostEqual(result["primary_identification"]["confidence"], 0.87)
        self.assertEqual([a["genus"] for a in result["alternative_identifications"]], ["C", "B"])
        self.assertEqual(result["trivia"]["references"], [])


class ImageTests(unittest.TestCase):
    def test_large_rgba_png_is_downscaled_and_jpeg_encoded(self):
        buf = io.BytesIO()
        Image.new("RGBA", (4000, 1000), (0, 100, 0, 128)).save(buf, format="PNG")
        out = normalize_image(buf.getvalue())
        self.assertEqual(max(out.width, out.height), 2048)
        self.assertTrue(out.storage_jpeg.startswith(b"\xff\xd8"))
        self.assertTrue(out.model_png.startswith(b"\x89PNG"))

    @unittest.skipUnless(HEIF_SUPPORTED, "pillow-heif not installed")
    def test_heic_upload_is_decoded(self):
        buf = io.BytesIO()
        try:
            Image.new("RGB", (64, 48), (10, 80, 40)).save(buf, format="HEIF")
        except Exception as exc:  # encoder not available on this platform
            self.skipTest(f"HEIF encoder unavailable: {exc}")
        out = normalize_image(buf.getvalue())
        self.assertEqual((out.width, out.height), (64, 48))


if __name__ == "__main__":
    unittest.main()
