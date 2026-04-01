const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { spawn } = require('child_process');
const fs = require('fs');

const app = express();

// Allow React (frontend) to communicate with Node (backend)
app.use(cors());

// Set up Multer to save uploaded files temporarily in an 'uploads' folder
const upload = multer({ dest: 'uploads/' });

// The main API route that React calls
app.post('/api/analyze', upload.single('image'), (req, res) => {
    // 1. Check if an image was actually uploaded
    if (!req.file) {
        return res.status(400).send('No image uploaded.');
    }

    const imagePath = req.file.path;
    console.log(`\n📸 Received new image for analysis: ${imagePath}`);

    // 2. Spawn the Python process
    // - Uses the virtual environment's Python directly (Windows format)
    // - Uses '-u' to force unbuffered output so Node gets the data immediately
    const pythonProcess = spawn('.\\venv\\Scripts\\python.exe', ['-u', 'analyzer.py', imagePath]);

    let aiResult = '';
    let aiError = '';

    // 3. Listen to normal Python output (the generated description)
    pythonProcess.stdout.on('data', (data) => {
        aiResult += data.toString();
        console.log("💬 Python output:", data.toString().trim()); 
    });

    // 4. Listen to Python errors/warnings (Hugging Face logs, missing modules, etc.)
    pythonProcess.stderr.on('data', (data) => {
        aiError += data.toString();
        console.error("⚠️ Python log/warning:", data.toString().trim());
    });

    // 5. When Python is completely finished processing
    pythonProcess.on('close', (code) => {
        // Safely delete the temporary image from your computer to save space
        try {
            fs.unlinkSync(imagePath); 
            console.log("🧹 Cleaned up temporary image.");
        } catch (e) {
            console.log("Note: Could not delete temp file.", e.message);
        }

        // If Python crashed (exit code is not 0), send the error to React
        if (code !== 0) {
            console.log("❌ Python crashed with code:", code);
            return res.status(500).json({ 
                description: `Server Error: Python failed to run properly. Check the Node terminal for details.` 
            });
        }

        // Clean up the final output. Ignore empty lines and grab the very last line printed by Python.
        const outputLines = aiResult.split('\n').map(line => line.trim()).filter(line => line !== '');
        const finalDescription = outputLines[outputLines.length - 1] || "No description generated.";

        console.log(`✅ Sending result to React: "${finalDescription}"`);
        
        // Send the final result back to the React frontend
        res.json({ description: finalDescription });
    });
});

// Start the Node.js server
const PORT = 5000;
app.listen(PORT, () => {
    console.log(`\n🚀 Backend server is running on http://localhost:${PORT}`);
    console.log(`Waiting for images from React...`);
});