import React from 'react';
import ScannerRuntime from './ScannerRuntime';

/**
 * Composition boundary for the live scanner feature.
 * Route-level props are passed into the runtime while scanner UI and hooks
 * remain isolated under components/scanner.
 */
export default function LiveScannerEngine(props) {
  return <ScannerRuntime {...props} />;
}
