import os
import sys
from pypdf import PdfReader


def extract_text_from_pdf(pdf_path: str) -> str:
    reader = PdfReader(pdf_path)
    pages_text = []

    for page_number, page in enumerate(reader.pages, start=1):
        text = page.extract_text() or ""
        cleaned = text.strip()
        if cleaned:
            pages_text.append(f"[Page {page_number}]\n{cleaned}")

    return "\n\n".join(pages_text).strip()


def main():
    if len(sys.argv) < 2:
        print("PDF file path is required.", file=sys.stderr)
        return 1

    pdf_path = sys.argv[1]

    try:
        if not os.path.exists(pdf_path):
            print("PDF file does not exist.", file=sys.stderr)
            return 1

        extracted_text = extract_text_from_pdf(pdf_path)
        if not extracted_text:
            print("No selectable text found in this PDF. It may be scanned pages and needs OCR.", flush=True)
            return 0

        print(extracted_text, flush=True)
        return 0
    except Exception as exc:
        print(f"Error extracting PDF text: {str(exc)}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
