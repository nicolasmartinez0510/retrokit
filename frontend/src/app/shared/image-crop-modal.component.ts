import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ToastService } from '../core/toast.service';

export type CropKind = 'logo' | 'background';

@Component({
  selector: 'app-image-crop-modal',
  imports: [FormsModule],
  template: `
    <div class="crop-backdrop" role="dialog" aria-modal="true" (click)="cancel()">
      <div class="card crop-modal" (click)="$event.stopPropagation()">
        <h2>{{ kind() === 'logo' ? 'Recortar logo' : 'Recortar fondo' }}</h2>
        <p class="hint">
          Arrastrá para encuadrar y usá el zoom. El recorte se exporta como
          {{ kind() === 'logo' ? 'PNG cuadrado' : 'JPEG 16:9' }}.
        </p>
        <div
          class="viewport"
          [class.logo]="kind() === 'logo'"
          [class.bg]="kind() === 'background'"
          #viewport
          (pointerdown)="onPointerDown($event)"
        >
          @if (src()) {
            <img
              [src]="src()"
              alt=""
              draggable="false"
              [style.width.px]="drawnW()"
              [style.height.px]="drawnH()"
              [style.left.px]="originX()"
              [style.top.px]="originY()"
            />
          }
        </div>
        <label class="zoom">
          Zoom
          <input
            type="range"
            min="1"
            max="3"
            step="0.05"
            [ngModel]="zoom()"
            (ngModelChange)="setZoom($event)"
          />
        </label>
        <div class="actions">
          <button type="button" class="btn-ghost" (click)="cancel()">
            Cancelar
          </button>
          <button type="button" class="btn-primary" (click)="confirm()">
            Usar recorte
          </button>
        </div>
      </div>
    </div>
  `,
  styles: `
    .crop-backdrop {
      position: fixed;
      inset: 0;
      z-index: 60;
      display: grid;
      place-items: center;
      padding: 1.25rem;
      background: var(--color-overlay);
      backdrop-filter: blur(4px);
    }
    .crop-modal {
      width: min(560px, 100%);
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 0.85rem;
    }
    h2 { margin: 0; font-size: 1.15rem; }
    .hint {
      margin: 0;
      color: var(--color-text-muted);
      font-size: 0.85rem;
    }
    .viewport {
      position: relative;
      overflow: hidden;
      background: #111;
      border-radius: var(--radius-sm);
      touch-action: none;
      cursor: grab;
      user-select: none;
      img {
        position: absolute;
        max-width: none;
        pointer-events: none;
      }
    }
    .viewport.logo {
      width: min(320px, 100%);
      aspect-ratio: 1;
      margin: 0 auto;
    }
    .viewport.bg {
      width: 100%;
      aspect-ratio: 16 / 9;
    }
    .viewport:active { cursor: grabbing; }
    .zoom {
      display: flex;
      align-items: center;
      gap: 0.65rem;
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--color-text-muted);
      input { flex: 1; }
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;
    }
  `,
})
export class ImageCropModalComponent implements AfterViewInit, OnDestroy {
  private readonly toast = inject(ToastService);
  readonly kind = input.required<CropKind>();
  readonly file = input.required<File>();
  readonly confirmed = output<File>();
  readonly cancelled = output<void>();

  private readonly viewport = viewChild<ElementRef<HTMLDivElement>>('viewport');

  readonly src = signal('');
  readonly zoom = signal(1);
  readonly originX = signal(0);
  readonly originY = signal(0);
  readonly drawnW = signal(0);
  readonly drawnH = signal(0);

  private natW = 0;
  private natH = 0;
  private viewW = 0;
  private viewH = 0;
  private baseScale = 1;
  private dragging = false;
  private lastX = 0;
  private lastY = 0;
  private objectUrl = '';
  private resizeObserver: ResizeObserver | null = null;

  ngAfterViewInit() {
    this.objectUrl = URL.createObjectURL(this.file());
    this.src.set(this.objectUrl);
    const img = new Image();
    img.onload = () => {
      this.natW = img.naturalWidth;
      this.natH = img.naturalHeight;
      this.layout();
    };
    img.onerror = () => {
      this.toast.error('No se pudo leer la imagen para recortar.');
      this.cancel();
    };
    img.src = this.objectUrl;

    const el = this.viewport()?.nativeElement;
    if (el && typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.layout());
      this.resizeObserver.observe(el);
    }
  }

  ngOnDestroy() {
    this.resizeObserver?.disconnect();
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
  }

  setZoom(value: string | number) {
    this.zoom.set(Number(value));
    this.applyTransform(false);
  }

  onPointerDown(ev: PointerEvent) {
    this.dragging = true;
    this.lastX = ev.clientX;
    this.lastY = ev.clientY;
    (ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId);
  }

  @HostListener('pointermove', ['$event'])
  onPointerMove(ev: PointerEvent) {
    if (!this.dragging) return;
    const dx = ev.clientX - this.lastX;
    const dy = ev.clientY - this.lastY;
    this.lastX = ev.clientX;
    this.lastY = ev.clientY;
    this.originX.set(this.originX() + dx);
    this.originY.set(this.originY() + dy);
    this.clamp();
  }

  @HostListener('pointerup')
  @HostListener('pointercancel')
  onPointerUp() {
    this.dragging = false;
  }

  cancel() {
    this.cancelled.emit();
  }

  async confirm() {
    const outW = this.kind() === 'logo' ? 256 : 1920;
    const outH = this.kind() === 'logo' ? 256 : 1080;
    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d');
    if (!ctx || !this.natW || !this.viewW) {
      this.toast.error('Todavía se está cargando la imagen.');
      return;
    }
    const img = new Image();
    img.src = this.src();
    try {
      await img.decode();
    } catch {
      this.toast.error('No se pudo recortar esta imagen. Probá con PNG o JPEG.');
      return;
    }
    if (this.kind() === 'background') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, outW, outH);
    }
    const scale = this.baseScale * this.zoom();
    const sx = -this.originX() / scale;
    const sy = -this.originY() / scale;
    const sw = this.viewW / scale;
    const sh = this.viewH / scale;
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);
    const mime = this.kind() === 'logo' ? 'image/png' : 'image/jpeg';
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, mime, 0.9),
    );
    if (!blob) {
      this.toast.error('No se pudo exportar el recorte.');
      return;
    }
    const name = this.kind() === 'logo' ? 'logo.png' : 'background.jpg';
    this.confirmed.emit(new File([blob], name, { type: mime }));
  }

  private layout() {
    const el = this.viewport()?.nativeElement;
    if (!el || !this.natW) return;
    const first = this.viewW === 0;
    this.viewW = el.clientWidth;
    this.viewH = el.clientHeight;
    if (!this.viewW || !this.viewH) {
      this.viewW = 0;
      this.viewH = 0;
      return;
    }
    this.baseScale = Math.max(this.viewW / this.natW, this.viewH / this.natH);
    this.applyTransform(first);
  }

  private applyTransform(center: boolean) {
    const scale = this.baseScale * this.zoom();
    this.drawnW.set(this.natW * scale);
    this.drawnH.set(this.natH * scale);
    if (center) {
      this.originX.set((this.viewW - this.drawnW()) / 2);
      this.originY.set((this.viewH - this.drawnH()) / 2);
    }
    this.clamp();
  }

  private clamp() {
    const minX = this.viewW - this.drawnW();
    const minY = this.viewH - this.drawnH();
    this.originX.set(Math.min(0, Math.max(minX, this.originX())));
    this.originY.set(Math.min(0, Math.max(minY, this.originY())));
  }
}
