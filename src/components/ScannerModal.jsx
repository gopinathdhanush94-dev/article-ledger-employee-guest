import React, { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';

function isMobileDevice() {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');
}

function normalize(value) {
  return String(value ?? '').trim().toLowerCase().replace(/\s+/g, '');
}

export default function ScannerModal({ onClose, onScan, products, lookupCode }) {
  const videoRef = useRef(null);
  const controlsRef = useRef(null);
  const inputRef = useRef(null);
  const lastScannedRef = useRef('');
  const scanLockRef = useRef(false);
  const mountedRef = useRef(true);

  const [mode, setMode] = useState(isMobileDevice() ? 'camera' : 'reader');
  const [readerValue, setReaderValue] = useState('');
  const [status, setStatus] = useState('');
  const [cameraState, setCameraState] = useState('idle');
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState('');

  // Lock the page behind the scanner without allowing the background catalogue
  // to participate in touch scrolling while the scanner is open.
  useEffect(() => {
    mountedRef.current = true;
    const body = document.body;
    const html = document.documentElement;
    const scrollY = window.scrollY || window.pageYOffset || 0;
    const previous = {
      bodyOverflow: body.style.overflow,
      bodyPosition: body.style.position,
      bodyTop: body.style.top,
      bodyWidth: body.style.width,
      bodyTouchAction: body.style.touchAction,
      htmlOverflow: html.style.overflow,
      htmlOverscroll: html.style.overscrollBehavior,
    };

    html.style.overflow = 'hidden';
    html.style.overscrollBehavior = 'none';
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.width = '100%';
    body.style.overflow = 'hidden';
    body.style.touchAction = 'none';
    body.classList.add('scanner-open');

    return () => {
      mountedRef.current = false;
      body.classList.remove('scanner-open');
      body.style.overflow = previous.bodyOverflow;
      body.style.position = previous.bodyPosition;
      body.style.top = previous.bodyTop;
      body.style.width = previous.bodyWidth;
      body.style.touchAction = previous.bodyTouchAction;
      html.style.overflow = previous.htmlOverflow;
      html.style.overscrollBehavior = previous.htmlOverscroll;
      window.scrollTo(0, scrollY);
    };
  }, []);

  const stopCamera = () => {
    try {
      controlsRef.current?.stop?.();
    } catch (_) {}
    controlsRef.current = null;

    const video = videoRef.current;
    if (video?.srcObject) {
      video.srcObject.getTracks?.().forEach(track => track.stop());
      video.srcObject = null;
    }
    setCameraState('idle');
  };

  useEffect(() => () => stopCamera(), []);

  useEffect(() => {
    if (mode !== 'reader') return undefined;
    const timer = setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 80);
    return () => clearTimeout(timer);
  }, [mode]);

  const findProduct = (raw) => {
    const value = String(raw || '').trim();
    if (!value) return null;
    const normalized = normalize(value);

    const exact = products.find(p =>
      [p.ean, p.article_no, p.model, p.hsn, p.id]
        .filter(v => v !== null && v !== undefined && String(v).trim() !== '')
        .some(v => normalize(v) === normalized)
    );
    if (exact) return exact;

    // QR payloads may contain a URL or text. Try 8–14 digit numeric candidates.
    const digits = value.match(/\d{8,14}/g) || [];
    for (const token of digits) {
      const hit = products.find(p => String(p.ean || '').replace(/\D/g, '') === token);
      if (hit) return hit;
    }
    return null;
  };

  const handleValue = async (value) => {
    const raw = String(value || '').trim();
    if (!raw || scanLockRef.current) return false;

    // Stop decoding while we do the server-side fallback lookup. This matters
    // on mobile because a barcode may decode repeatedly before the database
    // lookup has completed.
    scanLockRef.current = true;
    stopCamera();
    setNotFound('');
    setStatus('Checking Article Ledger…');

    let product = findProduct(raw);
    if (!product && lookupCode) {
      try { product = await lookupCode(raw); } catch (_) { product = null; }
    }

    if (product) {
      onScan(product);
      return true;
    }

    // Unknown code: show the exact scanned value.
    scanLockRef.current = false;
    setNotFound(raw);
    setStatus('');
    return false;
  };

  const startCamera = async () => {
    if (!mountedRef.current || mode !== 'camera') return;
    stopCamera();
    setError('');
    setStatus('');
    setNotFound('');
    setCameraState('starting');

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraState('blocked');
      setError('Camera access is not available in this browser. Check the site camera permission or use External Reader.');
      return;
    }

    // Do not repeatedly prompt when the browser already knows the site is denied.
    try {
      if (navigator.permissions?.query) {
        const permission = await navigator.permissions.query({ name: 'camera' });
        if (permission.state === 'denied') {
          setCameraState('blocked');
          setError('Camera access is blocked for this site. Allow Camera in browser/site settings, then tap Retry camera.');
          return;
        }
      }
    } catch (_) {
      // iOS Safari/Brave may not expose camera permission via Permissions API.
      // ZXing's getUserMedia call below remains the authoritative check.
    }

    try {
      const reader = new BrowserMultiFormatReader();
      const controls = await reader.decodeFromConstraints(
        {
          audio: false,
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        },
        videoRef.current,
        (result, decodeError) => {
          if (!mountedRef.current || scanLockRef.current || mode !== 'camera') return;
          if (!result) return;

          const raw = result.getText?.() || result.text || '';
          const value = String(raw).trim();
          if (!value || value === lastScannedRef.current) return;
          lastScannedRef.current = value;
          handleValue(value);
        }
      );

      if (!mountedRef.current || mode !== 'camera') {
        controls?.stop?.();
        return;
      }

      controlsRef.current = controls;
      setCameraState('running');
      setStatus('Ready — point the rear camera at the QR code or barcode.');
    } catch (e) {
      stopCamera();
      if (!mountedRef.current) return;

      if (e?.name === 'NotAllowedError' || e?.name === 'SecurityError') {
        setCameraState('blocked');
        setError('Camera permission is blocked or not granted for this site. Allow Camera in the browser site settings, then tap Retry camera.');
      } else if (e?.name === 'NotFoundError' || e?.name === 'DevicesNotFoundError') {
        setError('No camera was found on this device. Use External Reader instead.');
      } else {
        setError('Unable to start the camera. Check the browser camera permission and try again.');
      }
    }
  };

  // Camera starts automatically whenever Camera mode is selected.
  useEffect(() => {
    if (mode !== 'camera') return undefined;
    const timer = setTimeout(startCamera, 100);
    return () => {
      clearTimeout(timer);
      stopCamera();
    };
  }, [mode]);

  const switchMode = (nextMode) => {
    stopCamera();
    setError('');
    setStatus('');
    setNotFound('');
    setReaderValue('');
    lastScannedRef.current = '';
    scanLockRef.current = false;
    setMode(nextMode);
  };

  const submitReader = (e) => {
    e.preventDefault();
    handleValue(readerValue);
  };

  const handleReaderChange = (e) => {
    const value = e.target.value;
    setReaderValue(value);
    const compact = value.replace(/\s+/g, '');
    if (/^\d{8,14}$/.test(compact)) handleValue(compact);
  };

  const close = () => {
    stopCamera();
    onClose();
  };

  return (
    <div
      className="scanner-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Scan barcode or QR code"
      onPointerDown={(e) => { if (e.target === e.currentTarget) close(); }}
    >
      <div className="scanner-modal">
        <div className="scanner-header">
          <div>
            <div className="scanner-kicker">PRODUCT LOOKUP</div>
            <h2>Scan QR / Barcode</h2>
            <p>Find the article instantly from its EAN, Article No. or product code.</p>
          </div>
          <button type="button" className="scanner-close" onClick={close} aria-label="Close scanner">×</button>
        </div>

        <div className="scanner-mode-tabs">
          <button type="button" className={mode === 'camera' ? 'active' : ''} onClick={() => switchMode('camera')}>📷 Camera</button>
          <button type="button" className={mode === 'reader' ? 'active' : ''} onClick={() => switchMode('reader')}>▣ External Reader</button>
        </div>

        <div className="scanner-scroll-area">
          {mode === 'camera' ? (
            <div className="scanner-camera-panel">
              <div className="scanner-viewfinder">
                <video ref={videoRef} muted playsInline autoPlay />
                {cameraState !== 'running' && (
                  <div className="scanner-camera-placeholder">
                    <span>⌁</span>
                    <strong>{cameraState === 'blocked' ? 'Camera access blocked' : 'Starting camera…'}</strong>
                    <small>
                      {cameraState === 'blocked'
                        ? 'Allow Camera for this site in browser settings, then tap Retry.'
                        : 'The rear camera starts automatically. Keep the code inside the frame.'}
                    </small>
                    {cameraState === 'blocked' && (
                      <button type="button" className="scanner-retry" onClick={startCamera}>Retry camera</button>
                    )}
                  </div>
                )}
                <div className="scanner-frame" />
              </div>
              <div className="scanner-auto-note">Camera starts automatically when permission is available.</div>
            </div>
          ) : (
            <form className="scanner-reader-panel" onSubmit={submitReader}>
              <div className="reader-icon">▣</div>
              <h3>External reader ready</h3>
              <p>USB or Bluetooth barcode readers that work like a keyboard can scan directly. The input is focused automatically.</p>
              <input
                ref={inputRef}
                autoFocus
                value={readerValue}
                onChange={handleReaderChange}
                placeholder="Ready for scan…"
                aria-label="Barcode scanner input"
                inputMode="none"
                autoComplete="off"
              />
              <div className="scanner-reader-actions">
                <button type="submit" className="btn btn-teal">Find Article</button>
                <button type="button" className="btn" onClick={() => { setReaderValue(''); inputRef.current?.focus({ preventScroll: true }); }}>Clear</button>
              </div>
            </form>
          )}

          {status && <div className="scanner-status">{status}</div>}
          {error && <div className="scanner-error">{error}</div>}
        </div>

        <div className="scanner-footer">Supported: QR, EAN-13/EAN-8, UPC, Code 128 and other common barcode formats.</div>

        {notFound && (
          <div className="scanner-not-found-backdrop" role="presentation" onPointerDown={(e) => { if (e.target === e.currentTarget) { setNotFound(''); scanLockRef.current = false; } }}>
            <div className="scanner-not-found" role="alertdialog" aria-modal="true" aria-label="Code not available" onPointerDown={e => e.stopPropagation()}>
              <div className="scanner-not-found-icon">!</div>
              <div className="scanner-not-found-kicker">NOT AVAILABLE</div>
              <h3>Code not found in Article Ledger</h3>
              <p>This QR / barcode is not available in the database.</p>
              <div className="scanner-code-value">{notFound}</div>
              <button type="button" className="btn btn-teal" onClick={() => { setNotFound(''); lastScannedRef.current = ''; scanLockRef.current = false; if (mode === 'camera') startCamera(); else inputRef.current?.focus({ preventScroll: true }); }}>Scan Another</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
