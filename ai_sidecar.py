"""
AI Image Detective: Persistent Vision Sidecar
Runs EasyOCR for text extraction, then classifies the document type
from the extracted text using a keyword-based smart classifier.
Produces accurate, human-readable descriptions without any heavy
image-captioning model.
"""

import os
import sys
import json
import warnings

import torch
import easyocr
from PIL import Image, ImageStat

warnings.filterwarnings("ignore")

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
OCR_LANGUAGES = ["en"]
MAX_SIZE_FOR_STAT = (512, 512)    # size for brightness analysis

# ---------------------------------------------------------------------------
# Document categories — ordered from most-specific to least-specific.
# Each entry: (category_label, [keywords_to_match])
# All keyword matching is case-insensitive.
# ---------------------------------------------------------------------------
DOC_CATEGORIES = [
    ("Academic Marksheet / Exam Certificate",
     ["statement of marks", "marks obtained", "board examination",
      "higher secondary", "secondary school certificate", "seat no",
      "theory total", "passing certificate", "gseb", "cbse", "icse"]),

    ("Degree / Diploma Certificate",
     ["degree", "diploma", "bachelor", "master", "convocation",
      "university", "awarded", "chancellor"]),

    ("Resume / Curriculum Vitae",
     ["experience", "curriculum vitae", "work experience",
      "skills", "education", "internship", "projects", "references",
      "linkedin", "github", "objective", "summary"]),

    ("Government / Aadhar ID Card",
     ["aadhaar", "aadhar", "unique identification", "uidai",
      "government of india", "enrolment no"]),

    ("PAN Card",
     ["permanent account number", "pan", "income tax department",
      "signature of the holder"]),

    ("Passport",
     ["passport", "republic of india", "nationality", "date of issue",
      "place of issue", "given names"]),

    ("Invoice / Bill / Receipt",
     ["invoice", "bill", "receipt", "gst", "total amount",
      "payment", "subtotal", "tax", "amount due"]),

    ("Medical / Prescription",
     ["prescription", "diagnosis", "patient", "doctor", "hospital",
      "clinic", "dosage", "medicine", "treatment"]),

    ("Legal / Official Letter",
     ["affidavit", "hereby", "undersigned", "whereas", "notary",
      "legal", "advocate", "court", "order no", "case no"]),

    ("Newspaper / Article",
     ["published", "editor", "journalist", "press", "headline",
      "column", "advertisement"]),

    ("Handwritten Note",
     ["dear", "regards", "sincerely", "yours truly", "note:"]),
]


# ---------------------------------------------------------------------------
# Module-level state — loaded once
# ---------------------------------------------------------------------------
_device: str | None = None
_ocr_reader: easyocr.Reader | None = None


def _get_device() -> str:
    global _device
    if _device is None:
        _device = "cuda" if torch.cuda.is_available() else "cpu"
    return _device


def _load_models() -> None:
    global _ocr_reader
    if _ocr_reader is None:
        _ocr_reader = easyocr.Reader(
            OCR_LANGUAGES,
            gpu=(_get_device() == "cuda"),
            verbose=False,
        )


# ---------------------------------------------------------------------------
# Core helpers
# ---------------------------------------------------------------------------
def _extract_text(image_path: str) -> str:
    """Return text detected in the image via EasyOCR."""
    texts = _ocr_reader.readtext(image_path, detail=0, paragraph=True)
    joined = " ".join(t.strip() for t in texts if t.strip())
    return joined


def _classify_document(ocr_text: str) -> str:
    """
    Classify the document type from OCR text and return a natural
    human-readable description.
    """
    if not ocr_text:
        return None   # signal to caller: no text — use visual fallback

    lower = ocr_text.lower()

    for label, keywords in DOC_CATEGORIES:
        if any(kw in lower for kw in keywords):
            return f"This image contains a {label}."

    return "This image contains a printed or handwritten document with text."


def _visual_fallback(image_path: str, image: Image.Image) -> str:
    """Describe a photo with no extractable text using pixel statistics."""
    grayscale = image.convert("L")
    stat = ImageStat.Stat(grayscale)
    mean = stat.mean[0]
    stddev = stat.stddev[0]

    if mean < 60:
        brightness = "dark"
    elif mean < 190:
        brightness = "well-lit"
    else:
        brightness = "bright"

    if stddev < 25:
        scene = "a plain or minimal scene"
    elif stddev < 60:
        scene = "a scene with moderate detail"
    else:
        scene = "a detailed, high-contrast scene"

    # Colour hints
    rgb = image.convert("RGB")
    rgb.thumbnail(MAX_SIZE_FOR_STAT)
    r_avg, g_avg, b_avg = ImageStat.Stat(rgb).mean[:3]
    if r_avg > g_avg and r_avg > b_avg and r_avg > 120:
        tone = "warm tones"
    elif b_avg > r_avg and b_avg > g_avg and b_avg > 120:
        tone = "cool / blue tones"
    elif g_avg > r_avg and g_avg > b_avg and g_avg > 100:
        tone = "natural / green tones"
    else:
        tone = "neutral tones"

    return f"A photo — {brightness}, {scene}, with {tone}. No readable text was detected."


# ---------------------------------------------------------------------------
# Main pipeline
# ---------------------------------------------------------------------------
def analyze_image(image_path: str) -> dict:
    try:
        _load_models()

        image = Image.open(image_path).convert("RGB")
        width, height = image.size
        orientation = (
            "Landscape" if width > height else
            "Portrait"  if height > width else
            "Square"
        )

        ocr_text = _extract_text(image_path)

        caption = _classify_document(ocr_text)
        if caption is None:
            # No text at all — use visual description
            caption = _visual_fallback(image_path, image)
            display_ocr = None
        else:
            display_ocr = ocr_text if ocr_text else None

        return {
            "success": True,
            "data": {
                "caption":      caption,
                "ocr_text":     display_ocr,
                "width":        width,
                "height":       height,
                "orientation":  orientation,
                "device":       "GPU ⚡" if _get_device() == "cuda" else "CPU",
            },
        }

    except Exception as exc:
        return {"success": False, "error": str(exc)}


# ---------------------------------------------------------------------------
# Entry point — sends AI_SIDECAR_READY, then waits for image paths on stdin
# ---------------------------------------------------------------------------
def main() -> None:
    print("AI_SIDECAR_READY", flush=True)

    for raw_line in sys.stdin:
        image_path = raw_line.strip()
        if not image_path:
            continue
        if not os.path.isfile(image_path):
            print(json.dumps({"success": False, "error": "File not found"}), flush=True)
            continue

        result = analyze_image(image_path)
        print(json.dumps(result, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
