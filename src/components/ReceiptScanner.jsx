/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useEffect } from 'react';
import { Upload, Eye, RefreshCw, AlertCircle, Sparkles, CheckCircle2, Trash2, WifiOff, CloudOff, Check, Camera } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useTheme } from '../theme.jsx';

export default function ReceiptScanner({ onAnalysisComplete }) {
  const { theme } = useTheme();
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const [analysisStep, setAnalysisStep] = useState(0);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  // Custom Camera Stream States
  const [showCamera, setShowCamera] = useState(false);
  const [cameraStream, setCameraStream] = useState(null);
  const [cameraError, setCameraError] = useState(null);
  const [cameraDevices, setCameraDevices] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState('');
  const [isCameraLoading, setIsCameraLoading] = useState(false);
  const [needsPermissionPrompt, setNeedsPermissionPrompt] = useState(() => {
    return localStorage.getItem('receipt_camera_permission_granted') !== 'true';
  });
  const videoRef = useRef(null);

  // Check if browser already has camera permission granted natively on load
  useEffect(() => {
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'camera' })
        .then((status) => {
          if (status.state === 'granted') {
            localStorage.setItem('receipt_camera_permission_granted', 'true');
            setNeedsPermissionPrompt(false);
          }
        })
        .catch((err) => console.log('Permission query not supported or failed', err));
    }
  }, []);

  // Clean up stream tracks on unmount or stream change
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [cameraStream]);

  // Sync camera stream to video element when it becomes available in DOM
  useEffect(() => {
    if (showCamera && cameraStream && videoRef.current) {
      videoRef.current.srcObject = cameraStream;
    }
  }, [showCamera, cameraStream]);

  // Load offline queue from LocalStorage
  const [offlineQueue, setOfflineQueue] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('offline_receipts') || '[]');
    } catch (e) {
      console.error('Failed to parse offline receipts queue:', e);
      return [];
    }
  });

  // Track network online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const steps = [
    'Parsing file content safely...',
    'Analyzing layout, logo & text...',
    'Extracting items, subtotals & tax...',
    'Assigning category with Gemini Intelligence...',
  ];

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const resizeAndCompressImage = (file, maxWidth = 1200, maxHeight = 1200, quality = 0.8) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let width = img.width;
          let height = img.height;

          // Scale down maintaining aspect ratio
          if (width > height) {
            if (width > maxWidth) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Canvas 2D context is not available.'));
            return;
          }

          // Fill white background (useful if png has transparency)
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);
          
          ctx.drawImage(img, 0, 0, width, height);

          try {
            const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
            resolve(compressedDataUrl);
          } catch (err) {
            reject(err);
          }
        };
        img.onerror = () => reject(new Error('Failed to load image element.'));
        img.src = e.target.result;
      };
      reader.onerror = () => reject(new Error('Failed to read file.'));
      reader.readAsDataURL(file);
    });
  };

  const saveToOfflineQueue = (base64Data, filename) => {
    const newItem = {
      id: `offline-rec-${Date.now()}`,
      base64Image: base64Data || imagePreview,
      mimeType: 'image/jpeg',
      timestamp: new Date().toISOString(),
      filename: filename || `Offline_Receipt_${new Date().toLocaleDateString()}_${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}.jpg`
    };

    const updated = [newItem, ...offlineQueue];
    setOfflineQueue(updated);
    localStorage.setItem('offline_receipts', JSON.stringify(updated));

    setSuccessMessage('Receipt successfully added to your Offline Scan Queue. It will be ready to process whenever you are back online!');
    setErrorMessage(null);
    setIsAnalyzing(false);
    setImagePreview(null);
  };

  const processFile = async (fileOrDataUrl) => {
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      let finalBase64 = null;
      let finalMimeType = 'image/jpeg';
      let filename = `Captured_Receipt_${Date.now()}.jpg`;

      setIsAnalyzing(true);
      setAnalysisStep(0);

      if (fileOrDataUrl && fileOrDataUrl.dataUrl) {
        // Handle webcam/capture stream photos directly
        finalBase64 = fileOrDataUrl.dataUrl;
        if (fileOrDataUrl.name) {
          filename = fileOrDataUrl.name;
        }
      } else {
        // Handle standard file selection
        const file = fileOrDataUrl;
        const isImage = file.type?.startsWith('image/') || 
                        file.name?.toLowerCase().endsWith('.heic') || 
                        file.name?.toLowerCase().endsWith('.heif') || 
                        file.name?.toLowerCase().endsWith('.jpg') || 
                        file.name?.toLowerCase().endsWith('.jpeg') || 
                        file.name?.toLowerCase().endsWith('.png') || 
                        file.name?.toLowerCase().endsWith('.webp');
        if (!isImage) {
          setErrorMessage('Please upload a valid image file (PNG, JPG, WEBP, HEIC).');
          setIsAnalyzing(false);
          return;
        }
        filename = file.name;

        try {
          // Compress client-side to keep under LocalStorage size limits & speed up Gemini processing
          finalBase64 = await resizeAndCompressImage(file, 1200, 1200, 0.7);
          finalMimeType = 'image/jpeg';
        } catch (compressErr) {
          console.warn('Client-side compression failed, reading raw file:', compressErr);
          finalBase64 = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error('Failed to read raw file.'));
            reader.readAsDataURL(file);
          });
          if (file.type) {
            finalMimeType = file.type;
          }
        }
      }

      setImagePreview(finalBase64);

      // If user is offline right now, automatically queue it for offline use instead of attempting immediate scan
      if (!isOnline) {
        setTimeout(() => {
          saveToOfflineQueue(finalBase64, filename);
        }, 800);
        return;
      }

      // Simulate scanning progression steps for better UX
      const runStep = (stepIdx) => {
        if (stepIdx < steps.length) {
          setAnalysisStep(stepIdx);
          setTimeout(() => runStep(stepIdx + 1), 400);
        } else {
          // Trigger the actual API call
          sendToGemini(finalBase64, finalMimeType);
        }
      };

      runStep(0);
    } catch (err) {
      console.error('Error processing receipt image:', err);
      setErrorMessage('Failed to process the receipt image.');
      setIsAnalyzing(false);
    }
  };

  // Start active camera stream session
  const startCamera = async (deviceId = null) => {
    setIsCameraLoading(true);
    setCameraError(null);
    try {
      // If we already have a stream running, stop it first
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }

      const constraints = {
        video: deviceId 
          ? { deviceId: { exact: deviceId } } 
          : { facingMode: { ideal: 'environment' } }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setCameraStream(stream);
      setShowCamera(true);
      localStorage.setItem('receipt_camera_permission_granted', 'true');
      setNeedsPermissionPrompt(false);

      // Enumerate devices to find all video sources
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = allDevices.filter(device => device.kind === 'videoinput');
      setCameraDevices(videoDevices);
      
      const activeTrack = stream.getVideoTracks()[0];
      if (activeTrack) {
        const settings = activeTrack.getSettings();
        if (settings && settings.deviceId) {
          setSelectedCameraId(settings.deviceId);
        }
      }
    } catch (err) {
      console.warn('Failed to open camera via web API:', err);
      setCameraError('Could not access camera. Please verify camera permissions are enabled.');
      // Direct native system fallback on failure
      cameraInputRef.current?.click();
    } finally {
      setIsCameraLoading(false);
    }
  };

  // Stop active camera session and release locks
  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setShowCamera(false);
    setCameraError(null);
  };

  // Switch between front/back active cameras
  const switchCamera = async (deviceId) => {
    await startCamera(deviceId);
  };

  // Snap photo frame from active video feed and process
  const capturePhoto = () => {
    if (!videoRef.current) return;

    try {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      
      const width = video.videoWidth || 640;
      const height = video.videoHeight || 480;
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Draw the video frame onto the 2D canvas context
      ctx.drawImage(video, 0, 0, width, height);

      const capturedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
      
      // Release camera stream completely
      stopCamera();

      // Send to analyzer
      processFile({
        dataUrl: capturedDataUrl,
        name: `Captured_Receipt_${Date.now()}.jpg`
      });
    } catch (err) {
      console.error('Error capturing photo:', err);
      setErrorMessage('Failed to capture photo from video feed.');
    }
  };

  // Button click trigger handler
  const handleTakePhotoClick = (e) => {
    if (e && e.stopPropagation) {
      e.stopPropagation();
    }
    
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      if (needsPermissionPrompt) {
        setShowCamera(true);
      } else {
        startCamera();
      }
    } else {
      cameraInputRef.current?.click();
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
      e.target.value = '';
    }
  };

  const triggerFileSelect = (e) => {
    if (e && e.stopPropagation) {
      e.stopPropagation();
    }
    fileInputRef.current?.click();
  };

  const sendToGemini = async (base64Image, mimeType, queuedId = null) => {
    try {
      const activeUser = localStorage.getItem('active_user_session');
      const headers = { 'Content-Type': 'application/json' };
      if (activeUser) {
        headers['X-Username'] = activeUser;
      }

      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers,
        body: JSON.stringify({ image: base64Image, mimeType }),
      });

      if (response.status === 401) {
        console.warn('[ReceiptScanner] Received 401 response. User session has expired or is invalid. Logging out.');
        localStorage.removeItem('active_user_session');
        window.location.reload();
        return;
      }

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${response.status} failed to scan.`);
      }

      const result = await response.json();
      onAnalysisComplete(result, base64Image);
      
      // If this was from the offline queue, remove it now on success
      if (queuedId) {
        const updated = offlineQueue.filter(item => item.id !== queuedId);
        setOfflineQueue(updated);
        localStorage.setItem('offline_receipts', JSON.stringify(updated));
      }
      
      setIsAnalyzing(false);
      setImagePreview(null);
    } catch (err) {
      console.error('Scanning failed:', err);
      
      const errMsg = !isOnline 
        ? 'You are currently offline. Please connect to the internet to run receipt scans.' 
        : err.message || 'An unexpected error occurred during analysis.';
      
      setErrorMessage(errMsg);
      setIsAnalyzing(false);
    }
  };

  const scanQueuedReceipt = async (item) => {
    if (!isOnline) {
      setErrorMessage('You are offline. Connect to the internet to scan this receipt.');
      return;
    }
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsAnalyzing(true);
    setAnalysisStep(0);
    setImagePreview(item.base64Image);

    const runStep = (stepIdx) => {
      if (stepIdx < steps.length) {
        setAnalysisStep(stepIdx);
        setTimeout(() => runStep(stepIdx + 1), 400);
      } else {
        sendToGemini(item.base64Image, item.mimeType, item.id);
      }
    };
    runStep(0);
  };

  return (
    <div className="w-full">
      <input
        id="receipt-file-input"
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        className="hidden"
      />
      <input
        id="receipt-camera-input"
        type="file"
        ref={cameraInputRef}
        onChange={handleFileChange}
        accept="image/*"
        capture="environment"
        className="hidden"
      />

      <AnimatePresence mode="wait">
        {!isAnalyzing ? (
          <motion.div
            id="drag-drop-zone"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={triggerFileSelect}
            className={`border border-dashed p-10 text-center cursor-pointer transition-all duration-300 flex flex-col items-center justify-center min-h-[220px] rounded-lg ${
              isDragging
                ? `${theme.isDark ? 'border-neutral-500 bg-[#121214]/60' : 'border-slate-400 bg-slate-100'}`
                : `border-dashed border ${theme.border} hover:border-neutral-500 ${theme.isDark ? 'bg-[#0c0c0e]' : 'bg-slate-50'} shadow-sm hover:shadow-md`
            }`}
          >
            <div className={`p-4 border ${theme.border} ${theme.isDark ? 'bg-[#121214]' : 'bg-slate-100'} rounded-full text-neutral-400 mb-4 shadow-sm`}>
              {isOnline ? (
                <Upload className="w-6 h-6 stroke-[1.5]" />
              ) : (
                <WifiOff className="w-6 h-6 stroke-[1.5] text-amber-500 animate-pulse" />
              )}
            </div>
            
            <h3 className={`${theme.id === 'potter' ? 'font-display font-bold text-amber-100' : 'font-sans font-medium'} text-lg mb-1`}>
              {theme.id === 'potter' 
                ? (isOnline ? 'Present Vault Parchment' : 'Present Offline Scroll') 
                : (isOnline ? 'Upload Receipt Image' : 'Offline Receipt Capture')}
            </h3>
            
            <p className={`text-xs ${theme.textMuted} max-w-sm mb-4 font-sans leading-relaxed`}>
              {theme.id === 'potter' 
                ? (isOnline 
                    ? 'Drop your vault parchment scroll here, or click one of the options below'
                    : 'Drop scrolls while offline. We will save them to your vault pouch automatically!')
                : (isOnline 
                    ? 'Drag and drop your receipt photo here, or use the quick buttons below'
                    : 'Drop files while offline. They will be cached in your browser to scan when you reconnect!')
              }
            </p>

            <div className="flex flex-col sm:flex-row gap-3 mb-5 w-full max-w-xs" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={triggerFileSelect}
                className={`flex-1 py-2 px-3 text-xs font-sans font-medium rounded-md shadow-xs border ${theme.border} flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  theme.isDark 
                    ? 'bg-[#121214] hover:bg-[#1a1a1e] text-neutral-200 hover:text-white' 
                    : 'bg-white hover:bg-slate-100 text-slate-700 hover:text-slate-900'
                }`}
              >
                <Upload className="w-4 h-4 stroke-[1.5]" />
                Choose File
              </button>
              <button
                type="button"
                onClick={handleTakePhotoClick}
                className={`flex-1 py-2 px-3 text-xs font-sans font-medium rounded-md shadow-xs border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  theme.id === 'potter'
                    ? 'bg-amber-500/10 hover:bg-amber-500/20 text-[#d4af37] border-[#d4af37]/40'
                    : (theme.isDark
                        ? 'bg-neutral-900 hover:bg-neutral-850 text-neutral-200 border-neutral-800'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300')
                }`}
              >
                <Camera className="w-4 h-4 stroke-[1.5]" />
                Take Photo
              </button>
            </div>

            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-sans font-medium border ${theme.border} ${theme.isDark ? 'bg-[#121214] text-neutral-350' : 'bg-slate-100 text-slate-600'} shadow-xs`}>
              {isOnline ? (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-neutral-500 animate-pulse" />
                  Automated Categorization
                </>
              ) : (
                <>
                  <CloudOff className="w-3.5 h-3.5 text-amber-500" />
                  Offline Storage Engaged
                </>
              )}
            </span>
          </motion.div>
        ) : (
          <motion.div
            id="scanning-progress-container"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className={`border ${theme.border} rounded-lg p-6 ${theme.panel} shadow-sm flex flex-col md:flex-row gap-6 items-center transition-colors duration-300`}
          >
            {/* Visual preview with laser scan overlay */}
            <div className={`relative w-full md:w-44 h-44 rounded-md overflow-hidden ${theme.isDark ? 'bg-[#070708]' : 'bg-slate-200'} border ${theme.border} flex-shrink-0 flex items-center justify-center shadow-inner`}>
              {imagePreview ? (
                <>
                  <img
                    src={imagePreview}
                    alt="Receipt preview"
                    className="w-full h-full object-cover opacity-50"
                  />
                  {/* Laser scan line effect */}
                  <div className={`absolute inset-x-0 h-[2px] ${theme.id === 'potter' ? 'bg-[#d4af37]' : (theme.isDark ? 'bg-neutral-300' : 'bg-indigo-600')} shadow-[0_0_8px_rgba(255,255,255,0.4)] animate-[bounce_2.2s_infinite]`} />
                </>
              ) : (
                <RefreshCw className="w-6 h-6 text-neutral-400 animate-spin" />
              )}
            </div>

            {/* Steps & status logs */}
            <div className="flex-1 w-full text-left">
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className={`w-4 h-4 ${theme.id === 'potter' ? 'text-amber-400' : (theme.isDark ? 'text-neutral-300' : 'text-indigo-600')} animate-pulse`} />
                <h4 className={`${theme.id === 'potter' ? 'font-display font-bold text-amber-100' : 'font-sans font-medium'} text-base`}>
                  {theme.id === 'potter' ? 'Unravelling Vault Scroll Spells...' : 'Scanning & Parsing Receipt...'}
                </h4>
              </div>
              
              <p className={`text-[10px] ${theme.textMuted} mb-4 font-sans`}>
                {!isOnline ? 'Caching your image locally for offline availability...' : 'Please wait while our intelligence categorizes your expense.'}
              </p>

              {/* Progress step bar */}
              <div className={`w-full h-[3px] ${theme.isDark ? 'bg-neutral-900' : 'bg-slate-200'} rounded-full overflow-hidden mb-4`}>
                <div
                  className={`h-full ${theme.isDark ? 'bg-white' : 'bg-indigo-600'} transition-all duration-500`}
                  style={{ width: `${((analysisStep + 1) / (steps.length + 1)) * 100}%` }}
                />
              </div>

              {/* Steps display list */}
              <div className="space-y-2">
                {steps.map((step, idx) => {
                  const isActive = idx === analysisStep;
                  const isCompleted = idx < analysisStep;
                  return (
                    <div
                      key={idx}
                      className={`flex items-center gap-2.5 text-xs font-sans transition-opacity duration-300 ${
                        isActive
                          ? `${theme.isDark ? 'text-white' : 'text-slate-900'} font-semibold`
                          : isCompleted
                          ? `${theme.isDark ? 'text-neutral-400' : 'text-slate-500'}`
                          : `${theme.isDark ? 'text-neutral-600' : 'text-slate-400'}`
                      }`}
                    >
                      {isCompleted ? (
                        <CheckCircle2 className={`w-4 h-4 ${theme.isDark ? 'text-white' : 'text-emerald-600'} flex-shrink-0`} />
                      ) : isActive ? (
                        <RefreshCw className={`w-3.5 h-3.5 ${theme.isDark ? 'text-white' : 'text-indigo-600'} animate-spin flex-shrink-0`} />
                      ) : (
                        <div className={`w-3.5 h-3.5 rounded-full border ${theme.border} flex-shrink-0`} />
                      )}
                      <span className={isCompleted ? `line-through ${theme.isDark ? 'decoration-neutral-800 text-neutral-500' : 'decoration-slate-200 text-slate-400'}` : ''}>{step}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Success Notification message */}
      <AnimatePresence>
        {successMessage && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className={`mt-4 p-4 border border-emerald-900/60 bg-emerald-950/15 text-emerald-300 flex items-start gap-2.5 text-xs font-sans rounded-md shadow-sm`}
          >
            <Check className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 space-y-1">
              <div>
                <span className="font-semibold">Success:</span> {successMessage}
              </div>
              <p className="text-[10px] text-emerald-400 leading-normal">
                Click "Scan" in the offline queue below as soon as your device reconnects to process it with AI.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error prompt message */}
      <AnimatePresence>
        {errorMessage && (
          <motion.div
            id="scanner-error-message"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="mt-4 p-4 border border-rose-950/60 bg-rose-950/15 text-rose-300 flex items-start gap-2.5 text-xs font-sans rounded-md shadow-sm"
          >
            <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 space-y-1">
              <div>
                <span className="font-semibold">Analysis failed:</span> {errorMessage}
              </div>
              <p className="text-[10px] text-rose-400 leading-normal">
                Please double check the image quality, check your connection, or save to offline queue below.
              </p>
              
              {imagePreview && (
                <div className="mt-3 flex items-center gap-2 pt-2 border-t border-rose-950/40">
                  <button
                    type="button"
                    onClick={() => saveToOfflineQueue(imagePreview, `Offline_Receipt_${Date.now()}.jpg`)}
                    className="px-3 py-1.5 rounded text-xs font-medium font-sans flex items-center gap-1.5 cursor-pointer bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/20"
                  >
                    <CloudOff className="w-3.5 h-3.5" />
                    Save to Offline Queue
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setImagePreview(null);
                      setErrorMessage(null);
                    }}
                    className="px-3 py-1.5 rounded text-xs font-medium font-sans text-neutral-400 hover:text-white transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Offline Receipt Scans Queue Dashboard */}
      {offlineQueue.length > 0 && (
        <div className={`mt-6 pt-6 border-t ${theme.border}`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <WifiOff className={`w-4 h-4 ${theme.id === 'potter' ? 'text-amber-400' : 'text-amber-500 animate-pulse'}`} />
              <h4 className={`text-xs uppercase tracking-wider font-semibold ${theme.id === 'potter' ? 'text-amber-200' : (theme.isDark ? 'text-neutral-200' : 'text-slate-800')}`}>
                {theme.id === 'potter' ? '✦ Pending Vault Scrolls' : 'Offline Scan Queue'}
              </h4>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${theme.isDark ? 'bg-neutral-900 text-neutral-400' : 'bg-slate-100 text-slate-600'} font-bold`}>
                {offlineQueue.length}
              </span>
            </div>
            {isOnline && (
              <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-medium animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Online - Ready to Scan
              </span>
            )}
          </div>

          <div className="space-y-3">
            {offlineQueue.map((item) => (
              <div 
                key={item.id} 
                className={`flex items-center justify-between p-3 rounded-lg border ${theme.border} ${theme.isDark ? 'bg-neutral-950/40' : 'bg-white'} hover:shadow-xs transition-all`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded overflow-hidden border border-neutral-850 flex-shrink-0 bg-neutral-900 flex items-center justify-center">
                    <img src={item.base64Image} alt="Receipt thumbnail" className="w-full h-full object-cover" />
                  </div>
                  <div className="min-w-0">
                    <p className={`text-xs font-medium truncate ${theme.isDark ? 'text-white' : 'text-slate-900'}`}>{item.filename}</p>
                    <p className={`text-[10px] ${theme.textMuted}`}>{new Date(item.timestamp).toLocaleString()}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => scanQueuedReceipt(item)}
                    disabled={!isOnline}
                    className={`px-2.5 py-1 rounded text-[11px] font-medium font-sans flex items-center gap-1 cursor-pointer transition-all ${
                      isOnline
                        ? (theme.id === 'potter' ? 'bg-amber-500/20 text-[#d4af37] border border-[#d4af37]/40 hover:bg-amber-500/30' : 'bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/20')
                        : 'bg-neutral-900 text-neutral-500 border border-neutral-800 cursor-not-allowed opacity-50'
                    }`}
                    title={isOnline ? 'Scan now using Gemini' : 'Connect to internet to scan'}
                  >
                    <RefreshCw className="w-3 h-3" />
                    Scan
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const updated = offlineQueue.filter(q => q.id !== item.id);
                      setOfflineQueue(updated);
                      localStorage.setItem('offline_receipts', JSON.stringify(updated));
                    }}
                    className={`p-1.5 rounded hover:bg-rose-950/20 text-neutral-500 hover:text-rose-400 transition-colors border border-transparent hover:border-rose-950/30 cursor-pointer`}
                    title="Remove from queue"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Interactive Camera Modal Overlay */}
      <AnimatePresence>
        {showCamera && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-neutral-950/90 backdrop-blur-md flex flex-col items-center justify-center p-4"
          >
            <div className={`relative w-full max-w-2xl ${theme.isDark ? 'bg-[#0c0c0e]' : 'bg-slate-900'} rounded-2xl overflow-hidden border ${theme.id === 'potter' ? 'border-amber-500/30' : 'border-neutral-800'} shadow-2xl flex flex-col aspect-video md:aspect-[4/3] max-h-[90vh]`}>
              
              {/* Header */}
              <div className="absolute top-0 inset-x-0 z-10 px-4 py-3 bg-gradient-to-b from-black/80 to-transparent flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Camera className={`w-4 h-4 ${theme.id === 'potter' ? 'text-amber-400' : 'text-indigo-400'} animate-pulse`} />
                  <span className="text-xs font-sans font-medium text-white tracking-wide">
                    {theme.id === 'potter' ? '✦ Capture Vault Scroll' : 'Scan Receipt Image'}
                  </span>
                </div>

                {/* Camera Switcher if there are multiple cameras */}
                {cameraDevices.length > 1 && (
                  <select
                    value={selectedCameraId}
                    onChange={(e) => switchCamera(e.target.value)}
                    className="bg-black/60 border border-neutral-700 rounded px-2 py-1 text-[11px] font-sans font-medium text-neutral-300 focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    {cameraDevices.map((device, idx) => (
                      <option key={device.deviceId} value={device.deviceId}>
                        {device.label || `Camera ${idx + 1}`}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Video Feed Box */}
              <div className="flex-1 relative flex items-center justify-center bg-black overflow-hidden">
                {needsPermissionPrompt && !cameraStream ? (
                  <div className="flex flex-col items-center justify-center p-6 text-center max-w-sm">
                    <div className={`w-16 h-16 rounded-full ${theme.id === 'potter' ? 'bg-amber-500/10 border-amber-500/20' : 'bg-indigo-500/10 border-indigo-500/20'} flex items-center justify-center mb-4 border shadow-inner animate-pulse`}>
                      <Camera className={`w-8 h-8 ${theme.id === 'potter' ? 'text-amber-400' : 'text-indigo-400'}`} />
                    </div>
                    <h4 className="text-sm font-bold text-white mb-2 font-sans">
                      {theme.id === 'potter' ? '✦ Wizarding Camera Access Required' : 'Camera Access Needed'}
                    </h4>
                    <p className="text-xs text-neutral-400 mb-6 leading-relaxed font-sans">
                      {theme.id === 'potter'
                        ? 'Permit the receipt categorizer to utilize your scrying lens so we may instantly capture parchment invoices and scan vault coins.'
                        : 'Receipt Categorizer requires access to your camera to take receipt photographs and parse expense transactions. You will only need to authorize this once.'
                      }
                    </p>
                    <button
                      type="button"
                      onClick={() => startCamera()}
                      disabled={isCameraLoading}
                      className={`w-full py-2.5 px-4 rounded-lg font-sans font-medium text-xs shadow-md transition-all transform active:scale-95 cursor-pointer ${
                        theme.id === 'potter'
                          ? 'bg-amber-500 hover:bg-amber-600 text-neutral-950'
                          : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                      }`}
                    >
                      {isCameraLoading ? 'Enabling Camera...' : 'Grant Camera Permission'}
                    </button>
                  </div>
                ) : isCameraLoading ? (
                  <div className="flex flex-col items-center gap-3">
                    <RefreshCw className="w-8 h-8 text-neutral-500 animate-spin" />
                    <span className="text-xs text-neutral-400 font-sans">Powering up camera lens...</span>
                  </div>
                ) : (
                  <>
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />

                    {/* Scanning Bounding Box Overlay */}
                    <div className="absolute inset-0 flex items-center justify-center p-8 pointer-events-none">
                      <div className="relative w-full max-w-[85%] aspect-[3/4] border-2 border-dashed border-white/40 rounded-lg flex flex-col items-center justify-between p-4">
                        {/* Corner Accents */}
                        <div className="absolute -top-[2px] -left-[2px] w-6 h-6 border-t-4 border-l-4 border-white rounded-tl-md" />
                        <div className="absolute -top-[2px] -right-[2px] w-6 h-6 border-t-4 border-r-4 border-white rounded-tr-md" />
                        <div className="absolute -bottom-[2px] -left-[2px] w-6 h-6 border-b-4 border-l-4 border-white rounded-bl-md" />
                        <div className="absolute -bottom-[2px] -right-[2px] w-6 h-6 border-b-4 border-r-4 border-white rounded-tr-md" />

                        <span className="bg-black/75 backdrop-blur-xs px-2.5 py-1 rounded text-[10px] font-sans font-medium text-white/90 uppercase tracking-wider shadow-sm mt-2">
                          Align Receipt inside guidelines
                        </span>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Footer Controls */}
              <div className="px-6 py-4 bg-black/90 border-t border-neutral-850 flex items-center justify-between">
                <button
                  type="button"
                  onClick={stopCamera}
                  className="px-4 py-2 text-xs font-sans font-medium text-neutral-400 hover:text-white transition-colors cursor-pointer"
                >
                  Cancel
                </button>

                {/* Shutter Button */}
                {(!needsPermissionPrompt || cameraStream) && (
                  <button
                    type="button"
                    onClick={capturePhoto}
                    disabled={isCameraLoading || !cameraStream}
                    className={`w-14 h-14 rounded-full border-4 border-white flex items-center justify-center shadow-lg transition-all transform hover:scale-105 active:scale-95 cursor-pointer bg-red-600 hover:bg-red-500 ${
                      isCameraLoading || !cameraStream ? 'opacity-40 cursor-not-allowed' : ''
                    }`}
                    title="Capture Receipt"
                  >
                    <div className="w-6 h-6 rounded-full bg-white animate-pulse" />
                  </button>
                )}

                <div className="w-16" /> {/* Spacer for alignment */}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
