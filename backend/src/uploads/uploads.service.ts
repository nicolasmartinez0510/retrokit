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

const EXT_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

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
}
