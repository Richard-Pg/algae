import asyncio
import io
import json
import os
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from PIL import Image

import algae_identifier


class AsyncClientContext:
    def __init__(self, client):
        self.client = client

    async def __aenter__(self):
        return self.client

    async def __aexit__(self, exc_type, exc_value, traceback):
        return False


def make_png_bytes(mode="RGBA"):
    image = Image.new(mode, (2, 2), (10, 90, 40, 180))
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


class GeminiModelConfigurationTests(unittest.TestCase):
    def test_default_model_is_gemini_3_7_flash(self):
        with patch.dict(os.environ, {}, clear=True):
            self.assertEqual(
                algae_identifier.get_gemini_model_name(),
                "gemini-3.7-flash",
            )

    def test_model_environment_override_is_trimmed(self):
        with patch.dict(
            os.environ,
            {"GEMINI_MODEL": "  gemini-custom-model  "},
            clear=True,
        ):
            self.assertEqual(
                algae_identifier.get_gemini_model_name(),
                "gemini-custom-model",
            )

    def test_missing_api_key_is_rejected(self):
        with patch.dict(os.environ, {}, clear=True):
            with self.assertRaisesRegex(ValueError, "GEMINI_API_KEY not set"):
                algae_identifier.create_gemini_client()


class GeminiIdentificationTests(unittest.TestCase):
    def test_identification_uses_3_6_sdk_configuration(self):
        ai_payload = {
            "identified": False,
            "error_message": "No algae visible",
            "image_quality": "poor",
            "image_type": "unknown",
        }
        generate_content = AsyncMock(
            return_value=SimpleNamespace(text=json.dumps(ai_payload))
        )
        async_client = SimpleNamespace(
            models=SimpleNamespace(generate_content=generate_content)
        )
        gemini_client = SimpleNamespace(aio=AsyncClientContext(async_client))

        with (
            patch.dict(os.environ, {}, clear=True),
            patch.object(
                algae_identifier,
                "create_gemini_client",
                return_value=gemini_client,
            ),
        ):
            result = asyncio.run(
                algae_identifier.identify_algae(make_png_bytes())
            )

        generate_content.assert_awaited_once()
        request = generate_content.await_args.kwargs
        self.assertEqual(request["model"], "gemini-3.7-flash")
        self.assertEqual(request["contents"][0], algae_identifier.IDENTIFICATION_PROMPT)

        image_part = request["contents"][1]
        self.assertEqual(image_part.inline_data.mime_type, "image/png")
        self.assertTrue(image_part.inline_data.data.startswith(b"\x89PNG"))

        config = request["config"]
        self.assertEqual(config.max_output_tokens, 4096)
        self.assertEqual(config.response_mime_type, "application/json")
        self.assertIsNone(config.temperature)
        self.assertEqual(result["ai_model"], "gemini-3.7-flash")
        self.assertEqual(result["ai_provider"], "google_gemini")

    def test_identified_result_keeps_database_enrichment(self):
        ai_payload = {
            "identified": True,
            "primary_identification": {
                "genus": "Phaeodactylum",
                "species": "Phaeodactylum tricornutum",
                "confidence": 0.92,
            },
            "generated_details": {},
        }
        database_payload = {
            "taxonomy": {"genus": "Phaeodactylum"},
            "toxin": {"produces_toxin": False},
            "ecology": {"water_type": "Marine"},
            "description": "A pennate diatom.",
            "morphology": "Fusiform cells.",
            "common_species": ["Phaeodactylum tricornutum"],
            "reference_images": [],
        }
        generate_content = AsyncMock(
            return_value=SimpleNamespace(text=json.dumps(ai_payload))
        )
        async_client = SimpleNamespace(
            models=SimpleNamespace(generate_content=generate_content)
        )
        gemini_client = SimpleNamespace(aio=AsyncClientContext(async_client))

        with (
            patch.dict(os.environ, {}, clear=True),
            patch.object(
                algae_identifier,
                "create_gemini_client",
                return_value=gemini_client,
            ),
            patch.object(
                algae_identifier,
                "get_species_info",
                return_value=database_payload,
            ),
        ):
            result = asyncio.run(
                algae_identifier.identify_algae(make_png_bytes())
            )

        self.assertEqual(result["database_info"], database_payload)


if __name__ == "__main__":
    unittest.main()
