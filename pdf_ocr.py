"""
AI Image Detective: PDF Analysis Utility
Extracts text and embedded metadata from PDF documents.
Handles encrypted or corrupted files gracefully.
"""

import os
import sys
from pypdf import PdfReader
from pypdf.errors import PdfReadError, FileNotDecryptedError

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
PAGE_TEXT_LIMIT = 800   # characters shown per page in the preview
MAX_PAGES = 20          # safeguard against enormous PDFs

# ---------------------------------------------------------------------------


def analyze_pdf(pdf_path: str) -> dict:
    """
    Parse a PDF and return its metadata + text content.
    Returns a dict with 'success' and either 'data' or 'error'.
    """
    try:
        reader = PdfReader(pdf_path)

        # 1. Metadata
        info = reader.metadata
        meta_lines = []
        if info:
            if info.title:                   meta_lines.append(f"Title  : {info.title}")
            if info.author:                  meta_lines.append(f"Author : {info.author}")
            if info.subject:                 meta_lines.append(f"Subject: {info.subject}")
            if info.get("/CreationDate"):    meta_lines.append(f"Created: {info.get('/CreationDate')}")

        metadata_block = ""
        if meta_lines:
            metadata_block = "📄 PDF Metadata\n" + "\n".join(meta_lines) + "\n\n"

        # 2. Text per page
        total_pages = min(len(reader.pages), MAX_PAGES)
        content_pages = []
        for i, page in enumerate(reader.pages[:total_pages], start=1):
            text = (page.extract_text() or "").strip()
            if text:
                snippet = text[:PAGE_TEXT_LIMIT] + ("…" if len(text) > PAGE_TEXT_LIMIT else "")
                content_pages.append(f"─── Page {i} ───\n{snippet}")

        if not content_pages:
            body = "No selectable text found. This document likely contains scanned images."
        else:
            body = "\n\n".join(content_pages)

        return {"success": True, "data": metadata_block + body}

    except FileNotDecryptedError:
        return {"success": False, "error": "Access Denied: This PDF is encrypted or password-protected."}
    except PdfReadError:
        return {"success": False, "error": "Parse Error: The PDF file appears to be corrupted or malformed."}
    except Exception as exc:
        return {"success": False, "error": f"Unexpected Error: {exc}"}


def main() -> int:
    """CLI entry point."""
    # Force UTF-8 so emojis / non-latin characters don't crash on Windows
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    if len(sys.argv) < 2:
        print("Error: PDF file path argument is required.", file=sys.stderr)
        return 1

    pdf_path = sys.argv[1]
    if not os.path.isfile(pdf_path):
        print(f"Error: File not found: {pdf_path}", file=sys.stderr)
        return 1

    result = analyze_pdf(pdf_path)
    if result["success"]:
        print(result["data"], flush=True)
        return 0

    print(result["error"], file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
