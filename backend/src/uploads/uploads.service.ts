import { BadRequestException, Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import * as path from 'path';

export const CARD_IMAGE_MIMES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
]);

export const CARD_IMAGE_MAX_BYTES = 3 * 1024 * 1024; // 3 MB

export const LOGO_MIMES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml',
]);
export const LOGO_MAX_BYTES = 1 * 1024 * 1024; // 1 MB

export const BACKGROUND_MIMES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml',
]);
export const BACKGROUND_MAX_BYTES = 5 * 1024 * 1024; // 5 MB

const EXT_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
};

function mb(bytes: number) {
  return (bytes / (1024 * 1024)).toFixed(1);
}

function sniffMime(file: Express.Multer.File): string | null {
  const buf = file.buffer;
  if (buf && buf.length >= 12) {
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
      return 'image/png';
    }
    if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
      return 'image/jpeg';
    }
    if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) {
      return 'image/gif';
    }
    const ascii = buf.toString('ascii', 0, 12);
    if (ascii.startsWith('RIFF') && buf.toString('ascii', 8, 12) === 'WEBP') {
      return 'image/webp';
    }
    if (buf.toString('ascii', 4, 8) === 'ftyp') {
      const brand = buf.toString('ascii', 8, 12).toLowerCase();
      if (brand.startsWith('heic') || brand.startsWith('heif') || brand.startsWith('mif1')) {
        return 'image/heic';
      }
      if (brand.startsWith('avif')) return 'image/avif';
    }
    const head = buf.toString('utf8', 0, Math.min(buf.length, 256)).toLowerCase();
    if (head.includes('<svg')) return 'image/svg+xml';
  }
  const declared = (file.mimetype || '').toLowerCase();
  if (declared === 'image/jpg') return 'image/jpeg';
  if (LOGO_MIMES.has(declared) || BACKGROUND_MIMES.has(declared)) return declared;
  const name = (file.originalname || '').toLowerCase();
  if (name.endsWith('.png')) return 'image/png';
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg';
  if (name.endsWith('.webp')) return 'image/webp';
  if (name.endsWith('.svg')) return 'image/svg+xml';
  if (name.endsWith('.gif')) return 'image/gif';
  if (name.endsWith('.heic') || name.endsWith('.heif')) return 'image/heic';
  if (name.endsWith('.avif')) return 'image/avif';
  return declared || null;
}

function unsupportedImageMessage(
  mime: string | null,
  file: Express.Multer.File,
  kind: 'logo' | 'background',
) {
  const label = kind === 'logo' ? 'logo' : 'fondo';
  const shown = mime || file.mimetype || file.originalname || 'desconocido';
  if (mime === 'image/gif' || shown.toLowerCase().includes('gif')) {
    return `No se aceptan GIF. El ${label} debe ser PNG, JPEG, WebP o SVG.`;
  }
  if (
    mime === 'image/heic' ||
    /hei[cf]/i.test(shown) ||
    shown.toLowerCase().includes('heic')
  ) {
    return `No se aceptan HEIC. Exportá la foto a JPEG o PNG para el ${label}.`;
  }
  if (mime === 'image/avif' || shown.toLowerCase().includes('avif')) {
    return `No se aceptan AVIF. El ${label} debe ser PNG, JPEG, WebP o SVG.`;
  }
  return `Tipo no válido (${shown}). El ${label} debe ser PNG, JPEG, WebP o SVG.`;
}

@Injectable()
export class UploadsService implements OnModuleInit {
  readonly uploadDir: string;

  constructor(private readonly config: ConfigService) {
    this.uploadDir = path.resolve(
      this.config.get<string>('UPLOAD_DIR') || './uploads',
    );
  }

  async onModuleInit() {
    await fs.mkdir(this.uploadDir, { recursive: true });
  }

  assertCardImage(file: Express.Multer.File | undefined) {
    if (!file) return;
    if (!CARD_IMAGE_MIMES.has(file.mimetype)) {
      throw new BadRequestException(
        'Solo se permiten PNG, JPEG, WebP o GIF',
      );
    }
    if (file.size > CARD_IMAGE_MAX_BYTES) {
      throw new BadRequestException('La imagen no puede superar 3 MB');
    }
  }

  /** Public URL path under /api/uploads/... */
  toPublicUrl(relativePath: string): string {
    const normalized = relativePath.replace(/\\/g, '/').replace(/^\/+/, '');
    return `/api/uploads/${normalized}`;
  }

  /** Relative path from a public URL, or null if not under our uploads. */
  relativeFromPublicUrl(publicUrl: string | null | undefined): string | null {
    if (!publicUrl) return null;
    const prefix = '/api/uploads/';
    if (!publicUrl.startsWith(prefix)) return null;
    return publicUrl.slice(prefix.length);
  }

  async saveCardImage(
    retroId: string,
    file: Express.Multer.File,
  ): Promise<string> {
    this.assertCardImage(file);
    const ext = EXT_BY_MIME[file.mimetype];
    if (!ext) {
      throw new BadRequestException('Tipo de imagen no soportado');
    }
    const relative = path.join('cards', retroId, `${randomUUID()}.${ext}`);
    const absolute = path.join(this.uploadDir, relative);
    await fs.mkdir(path.dirname(absolute), { recursive: true });
    await fs.writeFile(absolute, file.buffer);
    return this.toPublicUrl(relative);
  }

  async deleteByPublicUrl(publicUrl: string | null | undefined) {
    const relative = this.relativeFromPublicUrl(publicUrl);
    if (!relative) return;
    const absolute = path.join(this.uploadDir, relative);
    // Prevent path traversal
    const resolved = path.resolve(absolute);
    if (!resolved.startsWith(this.uploadDir + path.sep) && resolved !== this.uploadDir) {
      return;
    }
    try {
      await fs.unlink(resolved);
    } catch {
      /* missing file is fine */
    }
  }

  async deleteRetroCardDir(retroId: string) {
    const dir = path.join(this.uploadDir, 'cards', retroId);
    try {
      await fs.rm(dir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }

  assertLogo(file: Express.Multer.File | undefined) {
    if (!file) {
      throw new BadRequestException(
        'No se recibió el archivo. El logo debe ser PNG, JPEG, WebP o SVG de hasta 1 MB.',
      );
    }
    const mime = sniffMime(file);
    if (!mime || !LOGO_MIMES.has(mime)) {
      throw new BadRequestException(unsupportedImageMessage(mime, file, 'logo'));
    }
    if (file.size > LOGO_MAX_BYTES) {
      throw new BadRequestException(
        `El logo pesa ${mb(file.size)} MB y el máximo es 1 MB.`,
      );
    }
    file.mimetype = mime;
  }

  assertBackground(file: Express.Multer.File | undefined) {
    if (!file) {
      throw new BadRequestException(
        'No se recibió el archivo. El fondo debe ser PNG, JPEG, WebP o SVG de hasta 5 MB.',
      );
    }
    const mime = sniffMime(file);
    if (!mime || !BACKGROUND_MIMES.has(mime)) {
      throw new BadRequestException(
        unsupportedImageMessage(mime, file, 'background'),
      );
    }
    if (file.size > BACKGROUND_MAX_BYTES) {
      throw new BadRequestException(
        `El fondo pesa ${mb(file.size)} MB y el máximo es 5 MB.`,
      );
    }
    file.mimetype = mime;
  }

  async saveTemplateBackground(
    templateId: string,
    file: Express.Multer.File,
  ): Promise<string> {
    this.assertBackground(file);
    return this.writeTemplateFile(templateId, 'bg', file);
  }

  async saveColumnLogo(
    templateId: string,
    columnId: string,
    file: Express.Multer.File,
  ): Promise<string> {
    this.assertLogo(file);
    return this.writeTemplateFile(templateId, `col-${columnId}`, file);
  }

  async deleteTemplateDir(templateId: string) {
    const dir = path.join(this.uploadDir, 'templates', templateId);
    try {
      await fs.rm(dir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }

  private async writeTemplateFile(
    templateId: string,
    prefix: string,
    file: Express.Multer.File,
  ): Promise<string> {
    const ext = EXT_BY_MIME[file.mimetype];
    if (!ext) {
      throw new BadRequestException('Tipo de imagen no soportado');
    }
    const relative = path.join(
      'templates',
      templateId,
      `${prefix}-${randomUUID()}.${ext}`,
    );
    const absolute = path.join(this.uploadDir, relative);
    await fs.mkdir(path.dirname(absolute), { recursive: true });
    await fs.writeFile(absolute, file.buffer);
    return this.toPublicUrl(relative);
  }
}
