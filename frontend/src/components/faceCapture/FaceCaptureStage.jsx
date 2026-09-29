import React from 'react';
import { AlertTriangle, Camera, CheckCircle2, Circle, Loader2, ScanFace, XCircle } from 'lucide-react';

import { guidanceTone } from './useFaceGuidance';

const STATUS_ICON = {
  idle: Camera,
  loading: Loader2,
  unavailable: ScanFace,
  noface: XCircle,
  adjust: AlertTriangle,
  ready: CheckCircle2,
};

/**
 * Large live camera view with an oval guide and a real-time instruction
 * banner. The oval and banner change colour with the guidance state.
 */
export default function FaceCaptureStage({
  videoRef,
  canvasRef,
  cameraActive,
  flash,
  guidance,
  onStartCamera,
  offlineTitle = 'Camera is off',
  offlineHint = 'Start the camera, then position the face inside the oval.',
  autoCapture = null, // { phase, count, prompt } from useAutoFaceCapture
}) {
  const autoPhase = autoCapture?.phase;
  const autoTone = { steady: 'success', countdown: 'success', processing: 'neutral', done: 'success', error: 'danger' }[autoPhase];
  const tone = autoTone || guidanceTone(guidance?.status);
  const Icon = autoPhase === 'processing' ? Loader2
    : autoPhase === 'done' ? CheckCircle2
      : autoPhase === 'error' ? XCircle
        : STATUS_ICON[guidance?.status] || Camera;
  const bannerText = autoCapture?.prompt || guidance?.message;
  const spinning = guidance?.status === 'loading' || autoPhase === 'processing';

  return (
    <div className={`face-stage tone-${tone}`}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="face-stage-video"
        style={{ display: cameraActive ? 'block' : 'none' }}
      />
      {canvasRef && <canvas ref={canvasRef} style={{ display: 'none' }} />}

      {!cameraActive && (
        <div className="face-stage-offline">
          <Camera size={36} aria-hidden="true" />
          <strong>{offlineTitle}</strong>
          <span>{offlineHint}</span>
          {onStartCamera && (
            <button type="button" className="btn btn-primary" onClick={onStartCamera}>Start Camera</button>
          )}
        </div>
      )}

      {cameraActive && (
        <>
          <div className="face-stage-oval" aria-hidden="true" />
          {autoPhase === 'countdown' && (
            <div className="face-stage-countdown" aria-hidden="true" key={autoCapture.count}>{autoCapture.count}</div>
          )}
          {autoPhase === 'processing' && (
            <div className="face-stage-center-icon" aria-hidden="true"><Loader2 size={56} className="spin" /></div>
          )}
          {autoPhase === 'done' && (
            <div className="face-stage-center-icon is-done" aria-hidden="true"><CheckCircle2 size={64} /></div>
          )}
          <div className="face-stage-banner" role="status" aria-live="polite">
            <Icon size={14} aria-hidden="true" className={spinning ? 'spin' : undefined} />
            <span>{bannerText}</span>
          </div>
        </>
      )}

      {flash && <div className="face-stage-flash" aria-hidden="true" />}
    </div>
  );
}

const CHECK_LABELS = [
  ['face', 'Face detected'],
  ['centered', 'Centered in the oval'],
  ['distance', 'Good distance'],
  ['lighting', 'Good lighting'],
];

/** Compact live checklist so the operator sees what is already OK. */
export function FaceGuidanceChecklist({ guidance, cameraActive }) {
  const checks = guidance?.checks || {};
  const unavailable = guidance?.status === 'unavailable';
  return (
    <ul className="face-checklist" aria-label="Capture readiness">
      {CHECK_LABELS.map(([key, label]) => {
        const state = cameraActive ? checks[key] || 'pending' : 'pending';
        const Icon = state === 'ok' ? CheckCircle2 : state === 'bad' ? XCircle : Circle;
        const note = unavailable && key !== 'lighting' ? 'Check manually' : state === 'ok' ? 'OK' : state === 'bad' ? 'Needs adjusting' : 'Waiting';
        return (
          <li key={key} className={`face-check is-${state}`}>
            <Icon size={16} aria-hidden="true" />
            <span className="face-check-label">{label}</span>
            <span className="face-check-note">{note}</span>
          </li>
        );
      })}
    </ul>
  );
}
