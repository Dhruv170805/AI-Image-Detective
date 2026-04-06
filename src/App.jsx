import React, { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [mode, setMode] = useState('image');
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const processFile = (file) => {
    if (!file) return;

    if (mode === 'image' && file.type.startsWith('image/')) {
      setFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setResult('');
      return;
    }

    if (mode === 'pdf' && file.type === 'application/pdf') {
      setFile(file);
      setPreviewUrl(null);
      setResult('');
      return;
    }

    if (mode === 'image') {
      alert("Please upload a valid image file.");
    } else {
      alert("Please upload a valid PDF file.");
    }
  };

  const handleFileChange = (e) => processFile(e.target.files[0]);
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    processFile(e.dataTransfer.files[0]);
  };
  
  const resetApp = () => {
    setFile(null);
    setPreviewUrl(null);
    setResult('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    setResult('');

    const formData = new FormData();
    const endpoint = mode === 'image' ? '/api/analyze' : '/api/extract-pdf';
    const fieldName = mode === 'image' ? 'image' : 'pdf';
    formData.append(fieldName, file);

    try {
      const response = await fetch(`http://localhost:5001${endpoint}`, {
        method: 'POST',
        body: formData,
      });
      
      const data = await response.json();
      setResult(response.ok ? data.description : `Error: ${data.description}`);
    } catch (error) {
      // Log the error to fix the VS Code warning, then show a user-friendly message
      console.error("Fetch Error:", error); 
      setResult("Failed to connect to the backend server. Is it running?");
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (nextMode) => {
    if (nextMode === mode) return;
    setMode(nextMode);
    resetApp();
  };

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  return (
    <>
      {/* Background Aurora Orbs */}
      <div className="aurora-bg">
        <div className="aurora-blob blob-1"></div>
        <div className="aurora-blob blob-2"></div>
      </div>

      <div className="main-wrapper">
        <div className="app-container">
          <div className="header">
            <h1>Vision AI Studio</h1>
            <p>Image captioning + PDF text extraction in one app.</p>
          </div>

          <div className="mode-switch">
            <button
              type="button"
              className={`mode-btn ${mode === 'image' ? 'active' : ''}`}
              onClick={() => switchMode('image')}
            >
              Image to Description
            </button>
            <button
              type="button"
              className={`mode-btn ${mode === 'pdf' ? 'active' : ''}`}
              onClick={() => switchMode('pdf')}
            >
              PDF to Text
            </button>
          </div>
          
          <form onSubmit={handleSubmit}>
            {!previewUrl ? (
              <>
                <div 
                  className={`drop-zone ${isDragging ? 'active' : ''}`}
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                >
                  <input 
                    type="file" 
                    accept={mode === 'image' ? 'image/*' : 'application/pdf'}
                    onChange={handleFileChange} 
                    className="file-input"
                  />
                  <span className="drop-zone-icon">✨</span>
                  <div style={{ color: '#cbd5e1', fontWeight: 500 }}>
                    {mode === 'image' ? 'Click or drag an image here' : 'Click or drag a PDF here'}
                  </div>
                </div>
                {mode === 'pdf' && file && (
                  <p style={{ color: '#94a3b8', marginTop: '10px', marginBottom: 0, fontSize: '13px' }}>
                    Selected: {file.name}
                  </p>
                )}
              </>
            ) : (
              <div className="image-preview-container">
                <img src={previewUrl} alt="Preview" className="image-preview" />
              </div>
            )}

            <button 
              type="submit" 
              className="analyze-btn"
              disabled={!file || loading}
            >
              {loading ? (
                <>
                  <span className="spinner"></span>
                  {mode === 'image' ? 'Analyzing Scene...' : 'Extracting PDF Text...'}
                </>
              ) : (
                mode === 'image' ? 'Analyze Image' : 'Extract Text From PDF'
              )}
            </button>
          </form>

          {result && (
            <>
              <div className="result-card">
                <h3>Analysis Result</h3>
                <p>{result}</p>
              </div>
              <button onClick={resetApp} className="reset-btn">
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24">
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
                  <path d="M3 3v5h5"></path>
                </svg>
                {mode === 'image' ? 'Analyze Another Image' : 'Extract From Another PDF'}
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}

export default App;
