/**
 * AI Image Detective – Backend Server
 *
 * Express server that bridges the React frontend with two Python workers:
 *   • ai_sidecar.py  – persistent process, keeps AI models in RAM
 *   • pdf_ocr.py     – spawned per request for PDF extraction
 */

require("dotenv/config");
const express  = require("express");
const cors     = require("cors");
const multer   = require("multer");
const readline = require("readline");
const { spawn } = require("child_process");
const fs   = require("fs");
const path = require("path");

const app  = express();
const PORT = process.env.PORT || 5001;

// ---------------------------------------------------------------------------
// Config (no hard-coded paths)
// ---------------------------------------------------------------------------
const UPLOADS_DIR       = path.join(process.cwd(), "uploads");
const MAX_UPLOAD_BYTES  = 10 * 1024 * 1024; // 10 MB
const SIDECAR_RESTART_DELAY_MS = 5000;

// ---------------------------------------------------------------------------
// Resolve Python executable – prefers .venv, then falls back to system python
// ---------------------------------------------------------------------------
function resolvePython() {
    if (process.env.PYTHON_PATH) return process.env.PYTHON_PATH;

    const venvPython = process.platform === "win32"
        ? path.join(process.cwd(), ".venv", "Scripts", "python.exe")
        : path.join(process.cwd(), ".venv", "bin", "python");

    return fs.existsSync(venvPython)
        ? venvPython
        : process.platform === "win32" ? "python" : "python3";
}
const PYTHON = resolvePython();

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
app.use(cors());
app.use(express.json());

app.get("/", (_req, res) =>
    res.send(
        `🚀 <b style="color:#4f46e5">Backend is running!</b><br/><br/>` +
        `Visit the frontend at: <a href="http://localhost:5173">http://localhost:5173</a>`
    )
);

// ---------------------------------------------------------------------------
// Uploads directory
// ---------------------------------------------------------------------------
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const upload = multer({
    dest: UPLOADS_DIR,
    limits: { fileSize: MAX_UPLOAD_BYTES },
});

// ---------------------------------------------------------------------------
// AI Sidecar – persistent worker
// ---------------------------------------------------------------------------
let sidecarProcess  = null;
let pendingResponse = null;   // Express res object waiting for the result
let pendingFilePath = null;   // temp file to delete once done

function startSidecar() {
    console.log("🤖 Starting AI Sidecar (Persistent Worker)...");

    const proc = spawn(PYTHON, ["-u", "ai_sidecar.py"], { env: process.env });

    // Line-by-line reader prevents partial-JSON bugs on large inference output
    const rl = readline.createInterface({ input: proc.stdout, terminal: false });

    rl.on("line", (raw) => {
        const line = raw.trim();

        if (line === "AI_SIDECAR_READY") {
            console.log("📡 AI Sidecar is READY and keeping models in memory.");
            return;
        }

        try {
            const result = JSON.parse(line);

            if (pendingResponse) {
                // Clean up temp file
                if (pendingFilePath) {
                    try {
                        if (fs.existsSync(pendingFilePath)) fs.unlinkSync(pendingFilePath);
                    } catch (_) { /* ignore */ }
                    pendingFilePath = null;
                }

                if (result.success) {
                    pendingResponse.json({ description: result.data });
                } else {
                    pendingResponse.status(500).json({ description: `Analysis Failed: ${result.error}` });
                }
                pendingResponse = null;
            }
        } catch (_) {
            // Non-JSON output from Python (warnings, progress bars) – ignore
        }
    });

    proc.stderr.on("data", (buf) => {
        const msg = buf.toString().trim();
        // Suppress noisy HuggingFace / torch progress spam
        const supressed = ["FutureWarning", "Loading weights", "UNEXPECTED", "hub.py"];
        if (!supressed.some((s) => msg.includes(s))) {
            console.warn("⚠️ Sidecar Log:", msg);
        }
    });

    proc.on("close", (code) => {
        console.info(`🔴 AI Sidecar stopped (code ${code}). Restarting in ${SIDECAR_RESTART_DELAY_MS / 1000}s…`);

        // Reject any pending request so the browser isn't left hanging
        if (pendingResponse) {
            pendingResponse.status(503).json({ description: "AI worker restarted unexpectedly. Please retry." });
            pendingResponse = null;
        }

        sidecarProcess = null;
        setTimeout(startSidecar, SIDECAR_RESTART_DELAY_MS);
    });

    sidecarProcess = proc;
}

startSidecar();

// ---------------------------------------------------------------------------
// Helper – run a one-shot Python script (used for PDF extraction)
// ---------------------------------------------------------------------------
function runScript(scriptName, filePath, res) {
    const proc = spawn(PYTHON, ["-u", scriptName, filePath], { env: process.env });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (d) => { stdout += d.toString(); });
    proc.stderr.on("data", (d) => { stderr += d.toString(); });

    proc.on("close", (code) => {
        // Always clean up the temp file
        try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch (_) { /* ignore */ }

        if (code !== 0) {
            const msg = stderr.trim() || "Script exited with a non-zero status.";
            return res.status(500).json({ description: `Extraction Failed: ${msg}` });
        }
        res.json({ description: stdout.trim() || "Done." });
    });
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/**
 * POST /api/analyze
 * Sends the uploaded image to the persistent sidecar for AI analysis.
 */
app.post("/api/analyze", upload.single("image"), (req, res) => {
    if (!req.file) return res.status(400).json({ description: "No image provided." });

    if (!sidecarProcess) {
        return res.status(503).json({ description: "AI engine is initialising. Please retry in a few seconds." });
    }

    if (pendingResponse) {
        // Only one request can be processed at a time by the sidecar
        return res.status(429).json({ description: "Analyzer is busy – please wait a moment and try again." });
    }

    console.log(`📸 Analysing image: ${req.file.originalname}`);
    pendingResponse = res;
    pendingFilePath = req.file.path;
    sidecarProcess.stdin.write(`${req.file.path}\n`);
});

/**
 * POST /api/extract-pdf
 * Spawns pdf_ocr.py to extract text from the uploaded PDF.
 */
app.post("/api/extract-pdf", upload.single("pdf"), (req, res) => {
    if (!req.file) return res.status(400).json({ description: "No PDF provided." });
    console.log(`📄 Extracting PDF: ${req.file.originalname}`);
    runScript("pdf_ocr.py", req.file.path, res);
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
app.listen(PORT, () => {
    console.log(`\n=========================================`);
    console.log(`🚀 Vision AI Backend: http://localhost:${PORT}`);
    console.log(`📡 Status: Listening for Requests…`);
    console.log(`=========================================\n`);
});
