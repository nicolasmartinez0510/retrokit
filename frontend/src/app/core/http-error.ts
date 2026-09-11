import { HttpErrorResponse } from '@angular/common/http';

export function httpErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof HttpErrorResponse)) return fallback;
  if (error.status === 413) {
    return 'El archivo es demasiado pesado. Logos hasta 1 MB; fondos hasta 5 MB. PNG, JPEG, WebP o SVG.';
  }
  const raw = error.error?.message;
  const oversized =
    (typeof raw === 'string' && /file too large/i.test(raw)) ||
    (typeof error.message === 'string' && /file too large/i.test(error.message));
  if (oversized) {
    return 'El archivo es demasiado pesado. Logos hasta 1 MB; fondos hasta 5 MB. PNG, JPEG, WebP o SVG.';
  }
  if (Array.isArray(raw) && raw.length) {
    return raw.filter((m) => typeof m === 'string').join(' ') || fallback;
  }
  if (typeof raw === 'string' && raw.trim()) return raw;
  if (typeof error.error === 'string' && error.error.trim() && !error.error.startsWith('<')) {
    return error.error;
  }
  return fallback;
}
