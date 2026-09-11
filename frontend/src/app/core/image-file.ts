export function guessImageType(file: File): string {
  const t = (file.type || '').toLowerCase();
  if (t === 'image/jpg') return 'image/jpeg';
  if (t) return t;
  const n = file.name.toLowerCase();
  if (n.endsWith('.png')) return 'image/png';
  if (n.endsWith('.jpg') || n.endsWith('.jpeg')) return 'image/jpeg';
  if (n.endsWith('.webp')) return 'image/webp';
  if (n.endsWith('.svg')) return 'image/svg+xml';
  if (n.endsWith('.gif')) return 'image/gif';
  if (n.endsWith('.heic') || n.endsWith('.heif')) return 'image/heic';
  if (n.endsWith('.avif')) return 'image/avif';
  return '';
}

export function isSvgFile(file: File) {
  const type = guessImageType(file);
  return type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg');
}

export function rejectImageFile(
  file: File,
  kind: 'logo' | 'background',
): string | null {
  const max = kind === 'logo' ? 1024 * 1024 : 5 * 1024 * 1024;
  const maxLabel = kind === 'logo' ? '1 MB para logos' : '5 MB para fondos';
  const type = guessImageType(file);
  const allowed = new Set([
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/svg+xml',
  ]);

  if (file.size > max) {
    return `La imagen pesa ${(file.size / (1024 * 1024)).toFixed(1)} MB. El máximo es ${maxLabel}.`;
  }
  if (!allowed.has(type)) {
    if (type.includes('gif') || file.name.toLowerCase().endsWith('.gif')) {
      return 'No se aceptan GIF. Usá PNG, JPEG, WebP o SVG.';
    }
    if (
      type.includes('heic') ||
      type.includes('heif') ||
      /\.hei[cf]$/i.test(file.name)
    ) {
      return 'No se aceptan HEIC. Exportá la foto a JPEG o PNG.';
    }
    if (type.includes('avif') || file.name.toLowerCase().endsWith('.avif')) {
      return 'No se aceptan AVIF. Usá PNG, JPEG, WebP o SVG.';
    }
    return `No se pudo usar este archivo (${type || file.name}). Tipos válidos: PNG, JPEG, WebP o SVG.`;
  }
  return null;
}
