import { nanoid as generateNanoId } from 'nanoid';

export function createId(size = 12): string {
  return generateNanoId(size);
}

export function redact(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') {
    // Redact Bearer token or sensitive values if string looks like one
    if (obj.startsWith('sk-') || obj.startsWith('secret_')) {
      return obj.slice(0, 4) + '***' + obj.slice(-4);
    }
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => redact(item));
  }
  if (typeof obj === 'object') {
    const copy: Record<string, unknown> = {};
    const sensitiveKeys = new Set([
      'apikey',
      'key',
      'token',
      'accesstoken',
      'clientsecret',
      'authorization',
      'password',
      'secret',
    ]);
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (sensitiveKeys.has(k.toLowerCase()) && typeof v === 'string') {
        copy[k] = v.length > 8 ? v.slice(0, 4) + '***' + v.slice(-4) : '***';
      } else {
        copy[k] = redact(v);
      }
    }
    return copy;
  }
  return obj;
}

export function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return (hash >>> 0).toString(36);
}

export function clamp(val: number, min: number, max: number): number {
  return Math.min(Math.max(val, min), max);
}

/**
 * Escapes a single CSV value according to RFC4180
 * and neutralizes spreadsheet formula injection (=, +, -, @, \t, \r).
 */
export function escapeCsvField(val: unknown): string {
  if (val === null || val === undefined) return '""';
  let s = String(val);

  // Prevent formula injection in spreadsheet applications (Excel, LibreOffice, Google Sheets)
  if (/^[=+\-@\t\r]/.test(s)) {
    s = "'" + s;
  }

  // Quote if contains delimiter, quote, or newline
  if (s.includes('"') || s.includes(',') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return `"${s}"`;
}
