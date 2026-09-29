import { useCallback, useState } from 'react';
import { Api } from '../../api';

export default function useScannerCamera({ session, setSession, activeSessionId, videoRef, overlayCanvasRef, streamRef, isRecognizingRef, isPausedRef, initLocalFaceDetector, scheduleScan, onRecognitionStart, onRecognitionStop, onSessionRecords, setStatusText, setStatusState }) {
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const stopCamera = useCallback(() => {
    isRecognizingRef.current = false;
    isPausedRef.current = false;
    onRecognitionStop?.();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    if (overlayCanvasRef.current) {
      const context = overlayCanvasRef.current.getContext('2d');
      context.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height);
    }
    setIsCameraActive(false);
    setIsPaused(false);
    setStatusText('Camera off');
    setStatusState('off');
  }, [onRecognitionStop, overlayCanvasRef, setStatusState, setStatusText, videoRef]);

  const startCamera = useCallback(async () => {
    try {
      let currentSession = session;
      if (!currentSession?.id) {
        if (!activeSessionId) {
          alert('No schedule selected. Please go back and select a class schedule to start attendance.');
          return;
        }
        currentSession = await Api.startSession(activeSessionId);
        setSession(currentSession);
        try {
          const detail = await Api.getSessionDetail(currentSession.id);
          onSessionRecords(detail.records || []);
        } catch {
          // Records will load lazily.
        }
      }
      if (currentSession?.status === 'closed') {
        throw new Error('This attendance session is closed. Reopen it explicitly before starting the camera.');
      }
      setStatusText('Starting camera & detector...');
      setStatusState('ready');
      await initLocalFaceDetector();
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280, max: 1920 }, height: { ideal: 720, max: 1080 }, facingMode: 'user', frameRate: { ideal: 30, max: 30 } } });
      streamRef.current = mediaStream;
      if (videoRef.current) { videoRef.current.srcObject = mediaStream; await videoRef.current.play(); }
      isRecognizingRef.current = true;
      onRecognitionStart?.();
      isPausedRef.current = false;
      setIsCameraActive(true);
      setIsPaused(false);
      setStatusText('Camera active');
      setStatusState('ready');
      scheduleScan(150);
    } catch (error) {
      console.error('Failed to start camera:', error);
      alert(`Camera error: ${error.message}`);
      setStatusText('Camera error');
      setStatusState('error');
    }
  }, [activeSessionId, initLocalFaceDetector, onRecognitionStart, onSessionRecords, scheduleScan, session, setSession, setStatusState, setStatusText, videoRef]);

  const togglePause = useCallback(() => {
    if (isPausedRef.current) {
      isPausedRef.current = false;
      setIsPaused(false);
      setStatusText('Camera active');
      setStatusState('ready');
      scheduleScan(100);
    } else {
      isPausedRef.current = true;
      setIsPaused(true);
      setStatusText('Paused');
      setStatusState('ready');
    }
  }, [scheduleScan, setStatusState, setStatusText]);

  return { isCameraActive, isPaused, streamRef, isRecognizingRef, isPausedRef, startCamera, stopCamera, togglePause };
}
