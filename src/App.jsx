import React, { useState, useEffect, useCallback } from 'react';
import './App.css';

// ---------------------------------------------------------------------------
// Constants – no hard-coded strings scattered in JSX
// ---------------------------------------------------------------------------
const MODES = { IMAGE: 'image', PDF: 'pdf' };
const ENDPOINTS  = { image: '/api/analyze',  pdf: '/api/extract-pdf' };
const FIELD_NAMES = { image: 'image',         pdf: 'pdf' };
const ACCEPT_TYPES = { image: 'image/*',      pdf: 'application/pdf' };
const LABELS = {
  image: { tab: 'Image Analysis', dropHint: 'Click or drag an image here', btn: 'Analyse Image', loading: 'Processing…', reset: 'Analyse Another Image' },
  pdf:   { tab: 'PDF to Text',    dropHint: 'Click or drag a PDF here',    btn: 'Extract Text',  loading: 'Extracting…', reset: 'Extract Another PDF'  },
};

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------
export default function App() {
  const [mode, setMode]             = useState(MODES.IMAGE);
  const [file, setFile]             = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [result, setResult]         = useState(null);   // string (PDF) or object (image)
  const [loading, setLoading]       = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError]           = useState('');

  // Revoke blob URL when it changes to avoid memory leaks
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const resetState = useCallback(() => {
    setFile(null);
    setPreviewUrl(null);
    setResult('');
    setError('');
  }, []);

  const switchMode = useCallback((next) => {
    if (next === mode) return;
    setMode(next);
    resetState();
  }, [mode, resetState]);

  /** Validates and stages the selected file. */
  const processFile = useCallback((incoming) => {
    if (!incoming) return;

    const isImage = incoming.type.startsWith('image/');
    const isPdf   = incoming.type === 'application/pdf';

    if (mode === MODES.IMAGE && !isImage) { setError('Please upload a valid image file.'); return; }
    if (mode === MODES.PDF   && !isPdf)   { setError('Please upload a valid PDF file.');   return; }

    setFile(incoming);
    setPreviewUrl(URL.createObjectURL(incoming));
    setResult('');
    setError('');
  }, [mode]);

  const handleFileChange = (e)  => processFile(e.target.files[0]);
  const handleDrop       = (e)  => { e.preventDefault(); setIsDragging(false); processFile(e.dataTransfer.files[0]); };

  /** Sends the file to the backend and displays the result. */
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file || loading) return;

    setLoading(true);
    setResult('');
    setError('');

    const form = new FormData();
    form.append(FIELD_NAMES[mode], file);

    try {
      const res  = await fetch(ENDPOINTS[mode], { method: 'POST', body: form });
      const data = await res.json();

      if (!res.ok) {
        setError(data.description || 'The server returned an error. Please try again.');
      } else {
        // Image analysis returns a structured object; PDF returns a plain string
        setResult(mode === MODES.IMAGE ? data.description : data.description);
      }
    } catch {
      setError("❌ Cannot reach the backend. Make sure 'npm run server' is running.");
    } finally {
      setLoading(false);
    }
  };

  const cfg = LABELS[mode];

  return (
    <>
      {/* Animated aurora background */}
      <div className="aurora-bg" aria-hidden="true">
        <div className="aurora-blob blob-1" />
        <div className="aurora-blob blob-2" />
      </div>

      <main className="main-wrapper">
        <div className="app-container">

          {/* Header */}
          <header className="header">
            <h1>Vision AI Studio</h1>
            <p>AI scene description · OCR text extraction · PDF analysis</p>
          </header>

          {/* Mode switch */}
          <div className="mode-switch" role="tablist">
            {Object.values(MODES).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                className={`mode-btn${mode === m ? ' active' : ''}`}
                onClick={() => switchMode(m)}
              >
                {LABELS[m].tab}
              </button>
            ))}
          </div>

          {/* Upload form */}
          <form onSubmit={handleSubmit} noValidate>
            {!previewUrl ? (
              <div
                className={`drop-zone${isDragging ? ' active' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
              >
                <input
                  id="file-input"
                  type="file"
                  accept={ACCEPT_TYPES[mode]}
                  className="file-input"
                  onChange={handleFileChange}
                />
                <span className="drop-zone-icon" aria-hidden="true">✨</span>
                <p className="drop-zone-hint">{cfg.dropHint}</p>
                {mode === MODES.PDF && file && (
                  <p className="selected-file">Selected: {file.name}</p>
                )}
              </div>
            ) : (
              <div className="image-preview-container">
                {mode === MODES.IMAGE ? (
                  <img src={previewUrl} alt="Selected file preview" className="image-preview" />
                ) : (
                  <embed
                    src={previewUrl}
                    type="application/pdf"
                    className="pdf-preview"
                    title="PDF preview"
                  />
                )}
              </div>
            )}

            {/* Validation / server error */}
            {error && <p className="error-msg" role="alert">{error}</p>}

            <button
              type="submit"
              className="analyze-btn"
              disabled={!file || loading}
              aria-busy={loading}
            >
              {loading
                ? <><span className="spinner" aria-hidden="true" />{cfg.loading}</>
                : cfg.btn}
            </button>
          </form>

          {/* Result */}
          {result && (
            <>
              <div className="result-card" aria-live="polite">
                <h2 className="result-title">Analysis Result</h2>

                {typeof result === 'object' ? (
                  /* ── Structured image result ── */
                  <div className="result-sections">
                    <div className="result-section">
                      <span className="result-section-label">🧠 Smart Description</span>
                      <p className="result-section-body">{result.caption}</p>
                    </div>

                    {result.ocr_text && (
                      <div className="result-section">
                        <span className="result-section-label">📝 Text found in image</span>
                        <p className="result-section-body result-ocr">{result.ocr_text}</p>
                      </div>
                    )}

                    <div className="result-meta-row">
                      <span>🖼 {result.width} × {result.height}px</span>
                      <span>·</span>
                      <span>{result.orientation}</span>
                      <span>·</span>
                      <span>{result.device}</span>
                    </div>
                  </div>
                ) : (
                  /* ── Plain PDF text result ── */
                  <pre className="result-body">{result}</pre>
                )}
              </div>
              <button type="button" onClick={resetState} className="reset-btn">
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                  <path d="M3 3v5h5" />
                </svg>
                {cfg.reset}
              </button>
            </>
          )}

        </div>
      </main>
    </>
  );
}
