export function ticketStorage() {
  try { return window.sessionStorage; } catch { return null; }
}

export function selectionKey(slug) {
  return 'the-next:ticket-selection:v1:' + slug;
}

export function readSelection(slug, storage = ticketStorage()) {
  try {
    const saved = JSON.parse(storage?.getItem(selectionKey(slug)) || 'null');
    if (saved?.version !== 1 || !saved.quantities || Array.isArray(saved.quantities) || typeof saved.quantities !== 'object') return {};
    return Object.fromEntries(Object.entries(saved.quantities).filter(([id, count]) =>
      /^[0-9a-f-]{36}$/i.test(id) && Number.isSafeInteger(count) && count > 0));
  } catch { return {}; }
}

export function writeSelection(slug, quantities, storage = ticketStorage()) {
  try {
    // Persist only ticket IDs and quantities, never prices, credentials or personal data.
    if (!Object.keys(quantities).length) storage?.removeItem(selectionKey(slug));
    else storage?.setItem(selectionKey(slug), JSON.stringify({ version: 1, quantities }));
  } catch { /* Selection remains usable in memory when browser storage is unavailable. */ }
}
