export function setStatus(text: string) {
  const el = document.getElementById('status');
  if (el) el.textContent = text;
}

export function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function truncateForList(s: string, maxChars = 64) {
  const normalized = s.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxChars) return normalized;
  return normalized.slice(0, Math.max(0, maxChars - 1)).trimEnd() + '…';
}

export function hoursAgo(createdUtcSeconds: number) {
  const now = Date.now() / 1000;
  const diffSeconds = Math.max(0, Math.floor(now - createdUtcSeconds));
  return Math.floor(diffSeconds / 3600);
}

export async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timeoutHandle: number | undefined;
  const timeout = new Promise<T>((_, reject) => {
    timeoutHandle = window.setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutHandle != null) window.clearTimeout(timeoutHandle);
  }
}
