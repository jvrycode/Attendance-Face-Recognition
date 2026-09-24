/**
 * Time formatting utility for AttendFR.
 * Ensures all time displays are consistently 12-hour AM/PM format
 * (e.g. "6:00 PM – 8:30 PM", "8:00 AM – 9:30 AM") matching Django's
 * `|time:"g:i A"` template filter.
 * Never displays raw 24-hour / military time strings like "18:00:00".
 */

export function formatSingleTime(t) {
  if (!t) return '';
  const clean = String(t).trim();
  if (clean.toUpperCase().includes('AM') || clean.toUpperCase().includes('PM')) {
    return clean;
  }
  const parts = clean.split(':');
  if (parts.length < 2) return clean;
  let h = parseInt(parts[0], 10);
  if (isNaN(h)) return clean;
  const m = parts[1].padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${m} ${ampm}`;
}

export function formatTime12h(timeStr) {
  if (!timeStr) return '—';
  const str = String(timeStr).trim();

  // If already formatted with AM/PM and no raw military parts
  if (str.toUpperCase().includes('AM') || str.toUpperCase().includes('PM')) {
    // If it's already "6:00–8:30 PM" or "8:00 AM – 9:30 AM", return it cleanly
    return str;
  }

  // If range like "18:00:00 - 20:30:00" or "18:00 - 20:30" or "18:00:00 – 20:30:00"
  if (str.includes('-') || str.includes('–')) {
    const parts = str.split(/[-–]/).map((s) => s.trim());
    if (parts.length === 2) {
      return `${formatSingleTime(parts[0])} – ${formatSingleTime(parts[1])}`;
    }
  }

  return formatSingleTime(str);
}
