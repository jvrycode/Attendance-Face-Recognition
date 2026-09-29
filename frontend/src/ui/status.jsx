import React from 'react';
import { confirmAction } from './ConfirmDialog';

/**
 * Status colors carry meaning, so they are used the same way everywhere:
 * green = active / open, gray = inactive / temporarily closed.
 */
export function StatusBadge({ active, activeLabel = 'Active', inactiveLabel = 'Inactive' }) {
  return (
    <span className={`status-badge ${active ? 'is-active' : 'is-inactive'}`}>
      {active ? activeLabel : inactiveLabel}
    </span>
  );
}

/**
 * Shared activate / deactivate flow for academic records.
 * Deactivation asks for confirmation and explains the impact; activation is immediate.
 * Returns true when the status changed.
 */
export async function changeActiveStatus({ entity, name, isActive, impact, update, onSuccess, onError }) {
  const run = async () => {
    try {
      await update({ is_active: !isActive });
      onSuccess?.(`${entity} ${name} is now ${isActive ? 'inactive' : 'active'}.`);
      return true;
    } catch (error) {
      onError?.(error.message || `Failed to change ${entity.toLowerCase()} status.`);
      return false;
    }
  };

  if (!isActive) return run();

  let changed = false;
  const confirmed = await confirmAction({
    title: `Deactivate ${entity.toLowerCase()} ${name}?`,
    message: impact || `${entity} ${name} will be temporarily closed. Existing records are kept.`,
    details: 'You can activate it again at any time from the Actions menu.',
    confirmLabel: `Deactivate ${entity.toLowerCase()}`,
    tone: 'danger',
    onConfirm: async () => { changed = await run(); },
  });
  return confirmed && changed;
}
