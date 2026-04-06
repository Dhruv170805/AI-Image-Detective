# Vision AI Studio 🔍

A full-stack web application that performs **instant AI-powered analysis** on images and PDFs — running 100% locally, no cloud required.

![Tech Stack](https://img.shields.io/badge/React-18-61DAFB?logo=react) ![Node.js](https://img.shields.io/badge/Node.js-Express-339933?logo=node.js) ![Python](https://img.shields.io/badge/Python-EasyOCR-3776AB?logo=python)

## ✨ Features

| Feature | Description |
|---|---|
| 🧠 **Smart Image Classification** | Automatically identifies document type (marksheet, resume, ID card, invoice, etc.) using keyword analysis |
| 📝 **OCR Text Extraction** | Reads printed and handwritten text from any image using EasyOCR |
| 📄 **PDF Text Extraction** | Extracts text content and metadata (author, date, title) from PDF files |
| 🖼 **Visual Previews** | Instant preview for both images and PDFs before analysis |
| ⚡ **Persistent Worker** | Python AI worker stays loaded in memory — zero reload delay between requests |
| 🌙 **Dark Mode UI** | Animated aurora background, glassmorphism card, smooth micro-animations |

## 🛠 Tech Stack

- **Frontend**: React 18, Vite, Vanilla CSS (design tokens, no Tailwind)
- **Backend**: Node.js, Express, Multer
- **AI / OCR**: Python, EasyOCR, Pillow, pypdf

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) v18+
- Python 3.9+

### Installation

**1. Clone the repository and install Node dependencies:**
```bash
git clone https://github.com/your-username/ai-image-detective.git
cd ai-image-detective
npm install
```

**2. Create and activate a Python virtual environment:**
```bash
# Windows
python -m venv .venv
.venv\Scripts\activate

# macOS / Linux
python3 -m venv .venv
source .venv/bin/activate
```

**3. Install Python dependencies:**
```bash
pip install -r requirements.txt
```
> ⚠️ On first run, EasyOCR will download ~100 MB of offline OCR models. This only happens once.

**4. Configure environment:**
```bash
cp .env.example .env
# Edit .env if you need to change the port (default: 5001)
```

**5. Run the application (two terminals):**
```bash
# Terminal 1 — Backend
npm run server

# Terminal 2 — Frontend
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## 📁 Project Structure

```
ai-image-detective/
├── src/
│   ├── App.jsx          # React frontend application
│   └── App.css          # Styles with CSS design tokens
├── ai_sidecar.py        # Persistent Python AI worker (OCR + classifier)
├── pdf_ocr.py           # PDF text & metadata extraction
├── server.js            # Express API server
├── requirements.txt     # Python dependencies
└── vite.config.js       # Vite dev server + proxy config
```

## 🧠 How It Works

```
Browser → Vite Proxy → Express → ai_sidecar.py (persistent)
                              └→ pdf_ocr.py     (per-request)
```

1. User uploads an image or PDF via the drag-and-drop UI.
2. The file is sent to the Express backend via the Vite proxy.
3. For **images**: the persistent `ai_sidecar.py` worker runs EasyOCR on the file, classifies the document type by keyword matching, and returns a structured result.
4. For **PDFs**: `pdf_ocr.py` is spawned, extracts all text and metadata using `pypdf`, and streams the result back.
5. The frontend receives structured JSON and renders each section (description, OCR text, image metadata) in a clean, readable card.

---
*Built for Internship Project Portfolio by Dhruv Patel.*
