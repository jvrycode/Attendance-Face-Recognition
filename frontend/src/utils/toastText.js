/**
 * Trim noisy phrasing so every toast reads the same way:
 * "User created successfully!" -> "User created."
 */
export function cleanToastMessage(value) {
  let text = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  text = text
    .replace(/\s+successfully(?=[\s.!,)]|$)/gi, '')
    .replace(/!+/g, '.')
    .replace(/\.{2,}/g, '.')
    .replace(/\s+\./g, '.')
    .trim();
  if (!/[.?)]$/.test(text)) text += '.';
  return text.charAt(0).toUpperCase() + text.slice(1);
}
