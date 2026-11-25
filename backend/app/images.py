"""Upload validation and image normalisation.

Every upload (JPEG, PNG, WebP, HEIC/HEIF, TIFF including 16-bit microscope
exports) is decoded once here and re-encoded:
  * PNG for the vision model (lossless, consistent payload)
  * JPEG for storage, so stored images display in every browser
"""

import io
import os
from dataclasses import dataclass

from fastapi import HTTPException
from PIL import Image, ImageOps, UnidentifiedImageError

try:  # HEIC/HEIF support (iPhone photos)
    from pillow_heif import register_heif_opener

    register_heif_opener()
    HEIF_SUPPORTED = True
except Exception:  # pragma: no cover - optional dependency
    HEIF_SUPPORTED = False

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".heic", ".heif", ".tif", ".tiff", ".webp"}
ALLOWED_TYPES = {
    "image/jpeg", "image/jpg", "image/png", "image/heic", "image/heif",
    "image/tiff", "image/tif", "image/webp",
}
MODEL_MAX_SIDE = 2048
STORAGE_MAX_SIDE = 2048


@dataclass
class NormalizedImage:
    model_png: bytes
    storage_jpeg: bytes
    width: int
    height: int


def validate_upload(filename: str, content_type: str, data: bytes, max_bytes: int) -> None:
    ext = os.path.splitext(filename or "")[1].lower()
    if (content_type or "") not in ALLOWED_TYPES and ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail="Unsupported image format. Use JPG, PNG, HEIC, TIFF or WebP.",
        )
    if not data:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")
    if len(data) > max_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum size is {max_bytes // (1024 * 1024)} MB.",
        )


def _to_rgb(image: Image.Image) -> Image.Image:
    if image.mode in ("I;16", "I;16B", "I;16L", "I"):
        # 16-bit microscope TIFFs: scale to 8-bit before converting.
        image = image.point(lambda v: v * (1 / 256)).convert("L")
    if image.mode == "RGBA" or (image.mode == "P" and "transparency" in image.info):
        background = Image.new("RGB", image.size, (255, 255, 255))
        rgba = image.convert("RGBA")
        background.paste(rgba, mask=rgba.split()[-1])
        return background
    return image.convert("RGB")


def _fit(image: Image.Image, max_side: int) -> Image.Image:
    if max(image.size) <= max_side:
        return image
    copy = image.copy()
    copy.thumbnail((max_side, max_side), Image.LANCZOS)
    return copy


def normalize_image(data: bytes) -> NormalizedImage:
    try:
        with Image.open(io.BytesIO(data)) as source:
            source.seek(0)  # first frame of multi-page TIFFs
            image = ImageOps.exif_transpose(source)
            image = _to_rgb(image)
    except (UnidentifiedImageError, OSError, ValueError):
        raise HTTPException(
            status_code=400,
            detail="This file could not be read as an image. Try exporting it as JPG or PNG.",
        )

    model_buf = io.BytesIO()
    _fit(image, MODEL_MAX_SIDE).save(model_buf, format="PNG")

    stored = _fit(image, STORAGE_MAX_SIDE)
    storage_buf = io.BytesIO()
    stored.save(storage_buf, format="JPEG", quality=88, optimize=True)

    return NormalizedImage(
        model_png=model_buf.getvalue(),
        storage_jpeg=storage_buf.getvalue(),
        width=stored.width,
        height=stored.height,
    )
