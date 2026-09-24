import React, { useState, useEffect, useRef } from 'react';
import {
  Camera,
  VideoOff,
  Square,
  Pause,
  Play,
  Search,
  CheckCircle2,
  AlertTriangle,
  Info,
  Clock,
  User,
  ArrowLeft,
} from 'lucide-react';
import { Api } from '../api';

export default function LiveScannerView({ user, onNavigate, activeSessionId }) {
  const [session, setSession] = useState(null);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusText, setStatusText] = useState('Camera off');
  const [statusColor, setStatusColor] = useState('var(--text-muted)');
  const [searchQuery, setSearchQuery] = useState('');
  const [recognizedStudents, setRecognizedStudents] = useState([]);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const loopTimeoutRef = useRef(null);

  // Play audio chime on recognition
  const playChime = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.1); // A5
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.35);
    } catch {
      // Audio not permitted or supported
    }
  };

  // Load or pick an active attendance session
  useEffect(() => {
    async function initSession() {
      try {
        setLoading(true);
        const sessions = await Api.getSessions();
        let target = null;
        if (activeSessionId) {
          target = sessions.find((s) => s.id === activeSessionId);
        }
        if (!target) {
          target = sessions.find((s) => s.status === 'open') || sessions[0];
        }

        if (target) {
          const detail = await Api.getSessionDetail(target.id);
          setSession(detail.session);
          setRecords(detail.records || []);
        }
      } catch (err) {
        console.error('Failed to init session:', err);
      } finally {
        setLoading(false);
      }
    }
    initSession();

    return () => {
      stopCamera();
    };
  }, [activeSessionId]);

  // Start Camera Stream
  const startCamera = async () => {
    try {
      setStatusText('Initializing camera...');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setIsCameraActive(true);
      setStatusText('Scanning faces...');
      setStatusColor('var(--success)');
      startRecognitionLoop();
    } catch (err) {
      console.error('Error opening camera:', err);
      setStatusText('Camera error / permission denied');
      setStatusColor('var(--danger)');
    }
  };

  // Stop Camera Stream
  const stopCamera = () => {
    if (loopTimeoutRef.current) clearTimeout(loopTimeoutRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
    setStatusText('Camera off');
    setStatusColor('var(--text-muted)');
  };

  // Capture Frame and send to Recognize API
  const captureAndRecognize = async () => {
    if (!videoRef.current || !session) return;
    if (videoRef.current.readyState !== 4) return;

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current || document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 360;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const frameB64 = canvas.toDataURL('image/jpeg', 0.8);

      setIsProcessing(true);
      const res = await Api.recognizeFace(session.id, frameB64);

      if (res && res.recognized && res.recognized.length > 0) {
        playChime();
        setStatusText(`Recognized: ${res.recognized[0].name}`);
        setStatusColor('var(--success)');

        // Update roster records
        setRecords((prev) =>
          prev.map((rec) => {
            const matched = res.recognized.find(
              (r) => r.student_id === rec.student?.student_id
            );
            if (matched) {
              return { ...rec, status: 'present', recognized_at: new Date().toLocaleTimeString() };
            }
            return rec;
          })
        );
      } else if (res && res.faces_detected > 0) {
        setStatusText('Face detected, matching...');
        setStatusColor('var(--accent)');
      } else {
        setStatusText('Scanning...');
        setStatusColor('var(--success)');
      }
    } catch (err) {
      // recognition frame failed or throttled
    } finally {
      setIsProcessing(false);
    }
  };

  // Recognition Loop (~1.5s interval)
  const startRecognitionLoop = () => {
    const loop = async () => {
      await captureAndRecognize();
      loopTimeoutRef.current = setTimeout(loop, 1500);
    };
    loop();
  };

  const filteredRecords = records.filter((r) => {
    const name = `${r.student?.user?.first_name || ''} ${r.student?.user?.last_name || ''}`.toLowerCase();
    const id = (r.student?.student_id || '').toLowerCase();
    return name.includes(searchQuery.toLowerCase()) || id.includes(searchQuery.toLowerCase());
  });

  const presentCount = records.filter((r) => r.status === 'present').length;

  return (
    <div className="page-content" style={{ padding: '24px', maxWidth: '1280px', margin: '0 auto' }}>
      {/* Top Bar with Back Link and Session Info */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <button
            type="button"
            className="btn-link"
            onClick={() => onNavigate('sections')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '13px', textDecoration: 'none', marginBottom: '6px', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            <ArrowLeft size={14} />
            <span>Back to Sections</span>
          </button>
          <h2 style={{ fontSize: '22px', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>
            Live Attendance {session?.schedule_details?.section_name ? `– ${session.schedule_details.section_name}` : ''}
          </h2>
          <p style={{ margin: '4px 0 0 0', color: 'var(--text-muted)', fontSize: '13px' }}>
            {session ? `${session.date} | Room ${session.schedule_details?.room || 'Main Hall'}` : 'Loading active session...'}
          </p>
        </div>

        {session && session.status === 'open' && (
          <button
            type="button"
            className="btn btn-danger"
            onClick={async () => {
              if (confirm('Close this attendance session?')) {
                await Api.closeSession(session.id);
                stopCamera();
                onNavigate('dashboard');
              }
            }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Square size={14} />
            <span>Close Session</span>
          </button>
        )}
      </div>

      {/* Main 2-Column Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.45fr) 380px', gap: '20px', alignItems: 'stretch' }}>
        {/* Left: Camera Card */}
        <div className="card camera-card" style={{ display: 'flex', flexDirection: 'column', height: '100%', borderRadius: 'var(--radius-lg)', overflow: 'hidden', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          {/* Card Header */}
          <div style={{ padding: '14px 20px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Camera size={16} style={{ opacity: 0.8 }} /> Live Camera Feed
            </span>
            <div style={{ padding: '4px 12px', fontSize: '12px', borderRadius: '9999px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: statusColor }}></span>
              <span style={{ fontWeight: '500', color: 'var(--text-secondary)' }}>{statusText}</span>
            </div>
          </div>

          {/* 16:9 Camera Viewport */}
          <div style={{ position: 'relative', width: '100%', flex: 1, minHeight: '440px', aspectRatio: '16 / 9', background: '#090d16', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                transform: 'scaleX(-1)',
                display: isCameraActive ? 'block' : 'none',
              }}
            />
            <canvas ref={canvasRef} style={{ display: 'none' }} />

            {/* Oval Face Vignette Overlay when Active */}
            {isCameraActive && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  pointerEvents: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <div
                  style={{
                    width: '240px',
                    height: '320px',
                    borderRadius: '50%',
                    border: '2px dashed rgba(255, 255, 255, 0.4)',
                    boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.25)',
                  }}
                />
              </div>
            )}

            {/* Standby View */}
            {!isCameraActive && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'radial-gradient(circle at center, #111827 0%, #090d16 100%)', textAlign: 'center', padding: '24px' }}>
                <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
                  <VideoOff size={24} style={{ color: '#94a3b8' }} />
                </div>
                <div style={{ fontSize: '15px', fontWeight: '600', color: '#f1f5f9' }}>Camera Feed Offline</div>
                <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px', maxWidth: '300px' }}>
                  Click "Start Camera" below to initiate real-time student recognition
                </div>
              </div>
            )}
          </div>

          {/* Footer Controls */}
          <div style={{ padding: '12px 18px', background: 'var(--bg-card)', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {!isCameraActive ? (
                <button type="button" className="btn btn-primary" onClick={startCamera} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <Camera size={15} />
                  <span>Start Camera</span>
                </button>
              ) : (
                <button type="button" className="btn btn-outline" onClick={stopCamera} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--danger)' }}>
                  <Square size={15} />
                  <span>Stop Camera</span>
                </button>
              )}
            </div>

            <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <Info size={14} />
              <span>Single person scan • Auto-verifies (~1.5s)</span>
            </div>
          </div>
        </div>

        {/* Right: Roster Panel */}
        <div className="card roster-card" style={{ display: 'flex', flexDirection: 'column', height: '100%', borderRadius: 'var(--radius-lg)', overflow: 'hidden', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          {/* Header */}
          <div style={{ padding: '14px 18px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>
              Students ({records.length})
            </span>
            <span className="badge badge-success" style={{ fontSize: '11px', padding: '4px 8px', fontWeight: '600' }}>
              Present: {presentCount}
            </span>
          </div>

          {/* Search Bar */}
          <div style={{ padding: '8px 14px', borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
            <div style={{ position: 'relative', width: '100%' }}>
              <Search size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Quick search student..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ width: '100%', padding: '6px 10px 6px 28px', fontSize: '12px', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--bg-card)', color: 'var(--text-primary)', outline: 'none' }}
              />
            </div>
          </div>

          {/* Student List */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 14px', display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '520px' }}>
            {filteredRecords.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)', fontSize: '12px' }}>
                No students enrolled in this section.
              </div>
            ) : (
              filteredRecords.map((r) => {
                const isPresent = r.status === 'present';
                return (
                  <div
                    key={r.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 10px',
                      borderRadius: 'var(--radius)',
                      background: isPresent ? 'var(--success-light)' : 'var(--bg-card)',
                      border: `1px solid ${isPresent ? 'var(--success)' : 'var(--border)'}`,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          background: 'var(--bg-secondary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '12px',
                          fontWeight: '700',
                          color: 'var(--primary)',
                        }}
                      >
                        {r.student?.user?.first_name?.charAt(0) || 'S'}
                      </div>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>
                          {r.student?.user?.first_name} {r.student?.user?.last_name}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {r.student?.student_id}
                        </div>
                      </div>
                    </div>

                    <div>
                      {isPresent ? (
                        <span className="badge badge-success" style={{ fontSize: '10px', fontWeight: '700' }}>
                          Present
                        </span>
                      ) : (
                        <span className="badge badge-muted" style={{ fontSize: '10px', fontWeight: '600' }}>
                          Absent
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
