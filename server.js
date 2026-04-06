const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();

// Allow React (frontend) to communicate with Node (backend)
app.use(cors());

// Set up Multer to save uploaded files temporarily in an 'uploads' folder
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}
const upload = multer({ dest: uploadsDir });
const resolvePythonExecutable = () => {
    if (process.env.PYTHON_PATH) return process.env.PYTHON_PATH;

    const venvPython = process.platform === 'win32'
        ? path.join('.', 'venv', 'Scripts', 'python.exe')
        : path.join('.', 'venv', 'bin', 'python');

    if (fs.existsSync(venvPython)) return venvPython;
    return process.platform === 'win32' ? 'python' : 'python3';
};

const pythonExecutable = resolvePythonExecutable();
console.log(`Using Python executable: ${pythonExecutable}`);

const runPythonScript = (scriptName, filePath, res) => {
    const pythonEnv = {
        ...process.env,
        TMPDIR: uploadsDir,
        TEMP: uploadsDir,
        TMP: uploadsDir
    };
    const pythonProcess = spawn(
        pythonExecutable,
        ['-u', scriptName, filePath],
        { env: pythonEnv }
    );
    let result = '';
    let errorLogs = '';
    let isHandled = false;

    const cleanupTempFile = () => {
        try {
            fs.unlinkSync(filePath);
            console.log(`🧹 Cleaned up temporary file: ${filePath}`);
        } catch (e) {
            console.log(`Note: Could not delete temp file (${filePath}).`, e.message);
        }
    };

    pythonProcess.stdout.on('data', (data) => {
        result += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
        errorLogs += data.toString();
        console.error(`⚠️ Python log (${scriptName}):`, data.toString().trim());
    });

    pythonProcess.on('error', (err) => {
        if (isHandled) return;
        isHandled = true;
        cleanupTempFile();
        return res.status(500).json({
            description: `Server Error: could not start ${scriptName}.`,
            error: `${err.message} (python: ${pythonExecutable})`
        });
    });

    pythonProcess.on('close', (code) => {
        if (isHandled) return;
        isHandled = true;
        cleanupTempFile();

        if (code !== 0) {
            console.log(`❌ Python script failed (${scriptName}) with code:`, code);
            return res.status(500).json({
                description: `Server Error: ${scriptName} failed to run.`,
                error: errorLogs.trim() || 'No Python error logs available.'
            });
        }

        const outputLines = result.split('\n').map((line) => line.trim()).filter((line) => line !== '');
        const finalText = outputLines.join('\n') || 'No text generated.';
        res.json({ description: finalText });
    });
};

// The main API route that React calls
app.post('/api/analyze', upload.single('image'), (req, res) => {
    // 1. Check if an image was actually uploaded
    if (!req.file) {
        return res.status(400).send('No image uploaded.');
    }

    const imagePath = req.file.path;
    console.log(`\n📸 Received new image for analysis: ${imagePath}`);

    runPythonScript('analyzer.py', imagePath, res);
});

// PDF text extraction route
app.post('/api/extract-pdf', upload.single('pdf'), (req, res) => {
    if (!req.file) {
        return res.status(400).send('No PDF uploaded.');
    }

    const pdfPath = req.file.path;
    console.log(`\n📄 Received new PDF for extraction: ${pdfPath}`);

    runPythonScript('pdf_ocr.py', pdfPath, res);
});

// Start the Node.js server
const PORT = 5001;
app.listen(PORT, () => {
    console.log(`\n🚀 Backend server is running on http://localhost:${PORT}`);
    console.log(`Waiting for images from React...`);
});
