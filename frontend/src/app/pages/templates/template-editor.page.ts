import { Component, HostListener, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { httpErrorMessage } from '../../core/http-error';
import {
  isBlobUrl,
  isStagingUrl,
  isSvgFile,
  rejectImageFile,
} from '../../core/image-file';
import { Subscription } from 'rxjs';
import { Template, TemplateColumnInput } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { environment } from '../../../environments/environment';
import { EmojiPickerComponent } from '../../shared/emoji-picker.component';
import {
  CropKind,
  ImageCropModalComponent,
} from '../../shared/image-crop-modal.component';

type EditableColumn = TemplateColumnInput & { key: string };

const IMAGE_ACCEPT = 'image/png,image/jpeg,image/webp,image/svg+xml';
const COLUMN_SYMBOLS = [
  '▶',
  '■',
  '↻',
  '♥',
  '★',
  '○',
  '◇',
  '✓',
  '✗',
  '↑',
  '↓',
  '✦',
  '💡',
  '🔥',
  '🚀',
  '🎯',
];

@Component({
  selector: 'app-template-editor-page',
  imports: [
    FormsModule,
    RouterLink,
    EmojiPickerComponent,
    ImageCropModalComponent,
  ],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1>{{ isNew() ? 'Nueva plantilla' : 'Editar plantilla' }}</h1>
          <p class="subtitle">
            Columnas, defaults de facilitación, fondo y logos
          </p>
        </div>
        <a class="btn-secondary" routerLink="/templates">Volver</a>
      </div>

      <form class="card panel" (ngSubmit)="save()">
        <div class="field">
          <label>Nombre</label>
          <input [(ngModel)]="name" name="name" required minlength="2" />
        </div>
        <div class="field">
          <label>Descripción</label>
          <textarea
            [(ngModel)]="description"
            name="description"
            rows="2"
          ></textarea>
        </div>

        <h2>Preferencias por defecto</h2>
        <div class="settings-grid">
          <div class="field">
            <label>Máx. comentarios / persona</label>
            <input
              type="number"
              [(ngModel)]="maxComments"
              name="maxComments"
              min="1"
              placeholder="Ilimitado"
            />
          </div>
          <div class="field">
            <label>Votos por persona</label>
            <input
              type="number"
              [(ngModel)]="votesPerParticipant"
              name="votes"
              min="1"
            />
          </div>
          <div class="field">
            <label>Máx. votos por comentario</label>
            <input
              type="number"
              [(ngModel)]="maxVotesPerCard"
              name="maxVotes"
              min="1"
            />
          </div>
        </div>

        <h2>Fondo del tablero</h2>
        <div class="bg-row">
          <div class="field">
            <label>Color</label>
            <div class="color-row">
              <input
                type="color"
                [ngModel]="colorPickerValue()"
                (ngModelChange)="backgroundColor = $event"
                name="bgColor"
              />
              <input
                [(ngModel)]="backgroundColor"
                name="bgHex"
                placeholder="#0b3d5c"
              />
              <button
                type="button"
                class="btn-ghost btn-sm"
                (click)="backgroundColor = ''"
              >
                Quitar
              </button>
            </div>
          </div>
          <div class="field">
            <label>Imagen</label>
            <div class="file-row">
              <label
                class="btn-secondary btn-sm"
                [class.busy]="uploadingBackground()"
              >
                {{ uploadingBackground() ? 'Subiendo…' : 'Subir imagen' }}
                <input
                  type="file"
                  hidden
                  [accept]="imageAccept"
                  [disabled]="uploadingBackground()"
                  (change)="onBackgroundFile($event)"
                />
              </label>
              @if (backgroundImageUrl) {
                <button
                  type="button"
                  class="btn-danger btn-sm"
                  (click)="clearBackground()"
                >
                  Quitar imagen
                </button>
              }
            </div>
            <p class="hint">PNG, JPEG, WebP o SVG · máx. 5 MB</p>
          </div>
        </div>

        <div class="columns-header">
          <h2>Columnas</h2>
          <button type="button" class="btn-secondary btn-sm" (click)="addColumn()">
            Agregar columna
          </button>
        </div>
        <p class="hint">Cada columna usa un emoji o una imagen, no los dos.</p>

        <div class="columns">
          @for (col of columns(); track col.key; let i = $index) {
            <div class="column-row card">
              <div class="symbol-block">
                <div
                  class="symbol-preview"
                  [class.uploading]="isLogoUploading(col.key)"
                >
                  @if (col.logoUrl) {
                    <img class="col-logo" [src]="col.logoUrl" alt="" />
                  } @else {
                    <span class="icon-fallback">{{ col.icon || '•' }}</span>
                  }
                </div>
                <div class="symbol-actions">
                  <app-emoji-picker
                    iconOnly
                    title="Elegir emoji"
                    placement="down"
                    [prepend]="columnSymbols"
                    (picked)="pickEmoji(col, $event)"
                  />
                  <label
                    class="btn-ghost btn-sm icon-btn"
                    [class.busy]="isLogoUploading(col.key)"
                    [title]="isLogoUploading(col.key) ? 'Subiendo…' : 'Subir imagen'"
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z"
                      />
                    </svg>
                    <span class="sr-only">Subir imagen</span>
                    <input
                      type="file"
                      hidden
                      [accept]="imageAccept"
                      [disabled]="isLogoUploading(col.key)"
                      (change)="onLogoFile($event, col)"
                    />
                  </label>
                  @if (col.logoUrl || col.icon) {
                    <button
                      type="button"
                      class="btn-danger btn-sm icon-btn"
                      title="Quitar símbolo"
                      (click)="clearSymbol(col)"
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path
                          d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
                        />
                      </svg>
                      <span class="sr-only">Quitar símbolo</span>
                    </button>
                  }
                </div>
              </div>
              <div class="col-fields">
                <div class="field grow">
                  <label>Título</label>
                  <input
                    [(ngModel)]="col.title"
                    [name]="'title-' + col.key"
                    required
                  />
                </div>
                <div class="field grow">
                  <label>Descripción</label>
                  <input
                    [(ngModel)]="col.description"
                    [name]="'desc-' + col.key"
                    placeholder="Pregunta guía para el equipo"
                  />
                </div>
              </div>
              <div class="col-actions">
                <button
                  type="button"
                  class="btn-ghost btn-sm"
                  (click)="move(i, -1)"
                  [disabled]="i === 0"
                >
                  ↑
                </button>
                <button
                  type="button"
                  class="btn-ghost btn-sm"
                  (click)="move(i, 1)"
                  [disabled]="i === columns().length - 1"
                >
                  ↓
                </button>
                <button
                  type="button"
                  class="btn-danger btn-sm"
                  (click)="removeColumn(i)"
                  [disabled]="columns().length <= 1"
                >
                  Quitar
                </button>
              </div>
            </div>
          }
        </div>

        <section
          class="preview"
          [class.has-theme]="!!backgroundColor || !!backgroundImageUrl"
          [style.background-color]="backgroundColor || null"
        >
          @if (backgroundImageUrl) {
            <img class="preview-bg" [src]="backgroundImageUrl" alt="" />
          }
          <h3>Vista previa</h3>
          <div class="preview-board">
            @for (col of columns(); track col.key) {
              <div class="preview-col">
                <div class="preview-head">
                  @if (col.logoUrl) {
                    <img class="col-logo sm" [src]="col.logoUrl" alt="" />
                  } @else {
                    <span>{{ col.icon || '•' }}</span>
                  }
                  <strong>{{ col.title || 'Sin título' }}</strong>
                </div>
                @if (col.description) {
                  <p>{{ col.description }}</p>
                }
              </div>
            }
          </div>
        </section>

        <div class="form-actions">
          <button
            class="btn-primary"
            type="submit"
            [disabled]="saving() || busyUploading()"
          >
            {{
              saving()
                ? 'Guardando…'
                : busyUploading()
                  ? 'Subiendo imágenes…'
                  : 'Guardar'
            }}
          </button>
        </div>
      </form>
    </div>

    @if (crop(); as c) {
      <app-image-crop-modal
        [kind]="c.kind"
        [file]="c.file"
        (confirmed)="onCropped($event)"
        (cancelled)="crop.set(null)"
      />
    }
  `,
  styles: `
    .panel {
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    h2 {
      font-size: 1.05rem;
      margin: 0.25rem 0 0;
    }
    .settings-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 0.75rem;
    }
    .hint {
      margin: 0;
      font-size: 0.85rem;
      color: var(--color-text-muted);
    }
    .bg-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.85rem;
    }
    .color-row, .file-row, .symbol-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.45rem;
      align-items: center;
    }
    .file-row label.busy,
    .icon-btn.busy {
      opacity: 0.6;
      pointer-events: none;
    }
    .symbol-preview.uploading {
      opacity: 0.65;
    }
    .icon-btn {
      width: 2rem;
      height: 2rem;
      padding: 0;
      cursor: pointer;
      svg {
        width: 1.15rem;
        height: 1.15rem;
        display: block;
        fill: none;
        stroke: currentColor;
        stroke-width: 1.5;
        stroke-linecap: round;
        stroke-linejoin: round;
      }
    }
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }
    .color-row input[type='color'] {
      width: 42px;
      height: 36px;
      padding: 0;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
      background: transparent;
      cursor: pointer;
    }
    .columns-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .columns {
      display: flex;
      flex-direction: column;
      gap: 0.65rem;
    }
    .column-row {
      padding: 0.85rem;
      display: flex;
      flex-direction: column;
      gap: 0.65rem;
    }
    .symbol-block {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.75rem;
    }
    .col-logo {
      width: 40px;
      height: 40px;
      object-fit: contain;
    }
    .col-logo.sm { width: 28px; height: 28px; }
    .icon-fallback {
      width: 40px;
      height: 40px;
      display: grid;
      place-items: center;
      font-size: 1.25rem;
      background: var(--color-sky-soft);
      border-radius: 8px;
    }
    .col-fields {
      display: flex;
      flex-wrap: wrap;
      gap: 0.65rem;
    }
    .grow { flex: 1 1 160px; }
    .col-actions {
      display: flex;
      gap: 0.35rem;
      justify-content: flex-end;
    }
    .preview {
      position: relative;
      isolation: isolate;
      background: var(--color-sky-soft);
      border-radius: var(--radius-sm);
      padding: 0.85rem 1rem;
      overflow: hidden;
      h3 { font-size: 0.9rem; margin-bottom: 0.5rem; }
    }
    .preview-bg {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      z-index: 0;
      pointer-events: none;
    }
    .preview > :not(.preview-bg) {
      position: relative;
      z-index: 1;
    }
    .preview.has-theme .preview-col {
      background: color-mix(in srgb, var(--color-bg) 82%, transparent);
    }
    .preview-board {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 0.5rem;
    }
    .preview-col {
      background: var(--color-bg);
      border-radius: var(--radius-sm);
      padding: 0.55rem 0.65rem;
      font-size: 0.8rem;
      p {
        margin: 0.25rem 0 0;
        color: var(--color-text-muted);
      }
    }
    .preview-head {
      display: flex;
      align-items: center;
      gap: 0.35rem;
    }
    .form-actions {
      display: flex;
      justify-content: flex-end;
    }
    @media (max-width: 700px) {
      .bg-row { grid-template-columns: 1fr; }
    }
  `,
})
export class TemplateEditorPage implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly imageAccept = IMAGE_ACCEPT;
  readonly columnSymbols = COLUMN_SYMBOLS;

  isNew = signal(true);
  templateId: string | null = null;
  name = '';
  description = '';
  maxComments: number | null = 3;
  votesPerParticipant = 5;
  maxVotesPerCard = 2;
  backgroundColor = '';
  backgroundImageUrl: string | null = null;
  columns = signal<EditableColumn[]>([]);
  saving = signal(false);
  uploadingBackground = signal(false);
  uploadingLogoKeys = signal<ReadonlySet<string>>(new Set());
  crop = signal<{ kind: CropKind; file: File; columnKey?: string } | null>(
    null,
  );
  private keySeq = 0;
  private sessionId = crypto.randomUUID();
  private sessionDiscarded = false;
  private blobUrls = new Set<string>();
  private backgroundHeld: string | null = null;
  private bgUpload?: Subscription;
  private logoUploads = new Map<string, Subscription>();
  private logoHeld = new Map<string, string | null>();

  colorPickerValue() {
    return this.backgroundColor || '#e3f2fd';
  }

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id || id === 'new') {
      this.isNew.set(true);
      this.columns.set([
        this.makeColumn({ title: '', description: '', icon: '▶', position: 0 }),
        this.makeColumn({ title: '', description: '', icon: '■', position: 1 }),
        this.makeColumn({ title: '', description: '', icon: '↻', position: 2 }),
      ]);
      return;
    }

    this.isNew.set(false);
    this.templateId = id;
    this.api.getTemplate(id).subscribe({
      next: (tpl) => this.applyTemplate(tpl),
      error: (e) => this.fail(e, 'No se pudo cargar la plantilla'),
    });
  }

  ngOnDestroy() {
    this.bgUpload?.unsubscribe();
    for (const sub of this.logoUploads.values()) sub.unsubscribe();
    this.discardStagingSession();
    this.revokeAllBlobs();
  }

  @HostListener('window:pagehide')
  onPageHide() {
    this.discardStagingSession();
  }

  addColumn() {
    if (this.columns().length >= 8) {
      this.toast.error('Máximo 8 columnas por plantilla');
      return;
    }
    this.columns.set([
      ...this.columns(),
      this.makeColumn({
        title: '',
        description: '',
        icon: '•',
        position: this.columns().length,
      }),
    ]);
  }

  removeColumn(index: number) {
    if (this.columns().length <= 1) return;
    const removed = this.columns()[index];
    this.logoUploads.get(removed.key)?.unsubscribe();
    this.logoUploads.delete(removed.key);
    this.setLogoUploading(removed.key, false);
    this.revokeBlob(removed.logoUrl);
    this.forgetStaging(removed.logoUrl);
    this.forgetStaging(this.logoHeld.get(removed.key));
    this.logoHeld.delete(removed.key);
    this.columns.set(this.columns().filter((_, i) => i !== index));
  }

  move(index: number, delta: number) {
    const next = [...this.columns()];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    const tmp = next[index];
    next[index] = next[target];
    next[target] = tmp;
    this.columns.set(next);
  }

  save() {
    const cols = this.columns();
    if (!this.name.trim() || this.name.trim().length < 2) {
      this.toast.error('El nombre debe tener al menos 2 caracteres');
      return;
    }
    if (!cols.length || cols.some((c) => !c.title.trim())) {
      this.toast.error('Cada columna necesita un título');
      return;
    }
    const hex = this.backgroundColor.trim();
    if (hex && !/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(hex)) {
      this.toast.error('El color de fondo debe ser un hex válido (#rgb o #rrggbb)');
      return;
    }

    if (this.busyUploading()) {
      this.toast.error('Esperá a que terminen de subir las imágenes');
      return;
    }
    this.saving.set(true);
    const req = this.isNew()
      ? this.api.createTemplate(this.payload())
      : this.api.updateTemplate(this.templateId!, this.payload());

    req.subscribe({
      next: (tpl) => {
        this.saving.set(false);
        this.discardStagingSession();
        if (this.isNew()) {
          this.toast.ok('Plantilla creada');
          void this.router.navigate(['/templates', tpl.id], { replaceUrl: true });
          return;
        }
        this.sessionId = crypto.randomUUID();
        this.sessionDiscarded = false;
        this.applyTemplate(tpl);
        this.toast.ok('Plantilla guardada');
      },
      error: (e) => {
        this.saving.set(false);
        this.fail(e, 'No se pudo guardar');
      },
    });
  }

  pickEmoji(col: EditableColumn, emoji: string) {
    this.cancelLogoUpload(col.key, { forget: true });
    col.icon = emoji;
    col.logoUrl = null;
    this.columns.set([...this.columns()]);
    if (!this.templateId || !col.id) return;
    this.api.updateTemplate(this.templateId, this.payload()).subscribe({
      next: (tpl) => this.applyTemplate(tpl),
      error: (e) => this.fail(e, 'No se pudo guardar el emoji'),
    });
  }

  clearSymbol(col: EditableColumn) {
    const held = this.logoHeld.get(col.key) ?? col.logoUrl;
    this.cancelLogoUpload(col.key, { forget: true });
    col.icon = '';
    col.logoUrl = null;
    this.columns.set([...this.columns()]);
    if (isStagingUrl(held) || isBlobUrl(held) || !held) {
      if (isStagingUrl(held)) this.forgetStaging(held);
      return;
    }
    if (!this.templateId || !col.id) return;
    const persist = () => {
      this.api.updateTemplate(this.templateId!, this.payload()).subscribe({
        next: (tpl) => this.applyTemplate(tpl),
        error: (e) => this.fail(e, 'No se pudo quitar el símbolo'),
      });
    };
    this.api.deleteColumnLogo(this.templateId, col.id).subscribe({
      next: persist,
      error: (e) => this.fail(e, 'No se pudo quitar el logo'),
    });
  }

  onBackgroundFile(ev: Event) {
    const file = this.takeFile(ev);
    if (!file) return;
    const reject = rejectImageFile(file, 'background');
    if (reject) {
      this.toast.error(reject);
      return;
    }
    if (isSvgFile(file)) {
      this.uploadBackground(file);
      return;
    }
    this.crop.set({ kind: 'background', file });
  }

  onLogoFile(ev: Event, col: EditableColumn) {
    const file = this.takeFile(ev);
    if (!file) return;
    const reject = rejectImageFile(file, 'logo');
    if (reject) {
      this.toast.error(reject);
      return;
    }
    if (isSvgFile(file)) {
      this.uploadLogo(file, col.key);
      return;
    }
    this.crop.set({ kind: 'logo', file, columnKey: col.key });
  }

  onCropped(file: File) {
    const pending = this.crop();
    this.crop.set(null);
    if (!pending) return;
    if (pending.kind === 'background') {
      this.uploadBackground(file);
      return;
    }
    if (pending.columnKey) this.uploadLogo(file, pending.columnKey);
  }

  clearBackground() {
    this.bgUpload?.unsubscribe();
    this.bgUpload = undefined;
    this.uploadingBackground.set(false);
    const current = this.backgroundImageUrl;
    const held = this.backgroundHeld;
    this.backgroundHeld = null;
    this.revokeBlob(current);
    this.backgroundImageUrl = null;
    const previous = isBlobUrl(held) ? null : held;
    if (isStagingUrl(current) || isStagingUrl(previous) || !this.templateId) {
      this.forgetStaging(current);
      this.forgetStaging(previous);
      this.toast.ok('Fondo quitado');
      return;
    }
    this.api.deleteTemplateBackground(this.templateId).subscribe({
      next: (tpl) => {
        this.applyTemplate(tpl);
        this.toast.ok('Fondo quitado');
      },
      error: (e) => this.fail(e, 'No se pudo quitar el fondo'),
    });
  }

  busyUploading() {
    return this.uploadingBackground() || this.uploadingLogoKeys().size > 0;
  }

  isLogoUploading(key: string) {
    return this.uploadingLogoKeys().has(key);
  }

  private uploadBackground(file: File) {
    this.bgUpload?.unsubscribe();
    const current = this.backgroundImageUrl;
    if (!isBlobUrl(current)) this.backgroundHeld = current;
    this.revokeBlob(current);
    const local = this.previewUrl(file);
    this.backgroundImageUrl = local;
    this.uploadingBackground.set(true);

    const onOk = (urlOrTpl: string | Template) => {
      this.uploadingBackground.set(false);
      this.bgUpload = undefined;
      this.revokeBlob(local);
      if (typeof urlOrTpl === 'string') {
        this.forgetStaging(this.backgroundHeld);
        this.backgroundHeld = null;
        this.backgroundImageUrl = urlOrTpl;
      } else {
        this.backgroundHeld = null;
        this.applyTemplate(urlOrTpl);
      }
      this.toast.ok('Fondo actualizado');
    };
    const onErr = (e: unknown) => {
      this.uploadingBackground.set(false);
      this.bgUpload = undefined;
      this.revokeBlob(local);
      this.backgroundImageUrl = isBlobUrl(this.backgroundHeld)
        ? null
        : this.backgroundHeld;
      this.backgroundHeld = null;
      this.fail(e, 'No se pudo subir el fondo');
    };

    this.bgUpload = this.templateId
      ? this.api.uploadTemplateBackground(this.templateId, file).subscribe({
          next: (tpl) => onOk(tpl),
          error: onErr,
        })
      : this.api.uploadStagingBackground(this.sessionId, file).subscribe({
          next: ({ url }) => onOk(url),
          error: onErr,
        });
  }

  private uploadLogo(file: File, columnKey: string) {
    const col = this.columns().find((c) => c.key === columnKey);
    if (!col) return;
    this.logoUploads.get(columnKey)?.unsubscribe();
    const current = col.logoUrl;
    if (!isBlobUrl(current)) this.logoHeld.set(columnKey, current ?? null);
    this.revokeBlob(current);
    const local = this.previewUrl(file);
    col.icon = '';
    col.logoUrl = local;
    this.columns.set([...this.columns()]);
    this.setLogoUploading(columnKey, true);

    const onOk = (urlOrTpl: string | Template) => {
      this.logoUploads.delete(columnKey);
      this.setLogoUploading(columnKey, false);
      this.revokeBlob(local);
      const held = this.logoHeld.get(columnKey);
      this.logoHeld.delete(columnKey);
      if (typeof urlOrTpl === 'string') {
        this.forgetStaging(held);
        const live = this.columns().find((c) => c.key === columnKey);
        if (live) {
          live.icon = '';
          live.logoUrl = urlOrTpl;
          this.columns.set([...this.columns()]);
        }
      } else {
        this.applyTemplate(urlOrTpl);
      }
      this.toast.ok('Logo actualizado');
    };
    const onErr = (e: unknown) => {
      this.logoUploads.delete(columnKey);
      this.setLogoUploading(columnKey, false);
      this.revokeBlob(local);
      const held = this.logoHeld.get(columnKey);
      this.logoHeld.delete(columnKey);
      const live = this.columns().find((c) => c.key === columnKey);
      if (live) {
        live.logoUrl = isBlobUrl(held) ? null : (held ?? null);
        this.columns.set([...this.columns()]);
      }
      this.fail(e, 'No se pudo subir el logo');
    };

    const sub =
      this.templateId && col.id
        ? this.api.uploadColumnLogo(this.templateId, col.id, file).subscribe({
            next: (tpl) => onOk(tpl),
            error: onErr,
          })
        : this.api.uploadStagingLogo(this.sessionId, file).subscribe({
            next: ({ url }) => onOk(url),
            error: onErr,
          });
    this.logoUploads.set(columnKey, sub);
  }

  private payload() {
    return {
      name: this.name.trim(),
      description: this.description.trim() || null,
      maxCommentsPerParticipant: this.maxComments || null,
      votesPerParticipant: this.votesPerParticipant,
      maxVotesPerCard: this.maxVotesPerCard,
      backgroundColor: this.backgroundColor.trim() || null,
      ...(isStagingUrl(this.backgroundImageUrl)
        ? { backgroundImageUrl: this.backgroundImageUrl }
        : {}),
      columns: this.columns().map((c, i) => ({
        ...(c.id ? { id: c.id } : {}),
        title: c.title.trim(),
        description: c.description?.trim() || null,
        icon: c.logoUrl ? null : c.icon?.trim() || null,
        position: i,
        ...(isStagingUrl(c.logoUrl) ? { logoUrl: c.logoUrl } : {}),
      })),
    };
  }

  private takeFile(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    return file;
  }

  private fail(e: unknown, fallback: string) {
    this.toast.error(httpErrorMessage(e, fallback));
  }

  private forgetStaging(url: string | null | undefined) {
    if (!isStagingUrl(url)) return;
    this.api.deleteStaging(url).subscribe({ error: () => undefined });
  }

  private previewUrl(file: File) {
    const url = URL.createObjectURL(file);
    this.blobUrls.add(url);
    return url;
  }

  private revokeBlob(url: string | null | undefined) {
    if (!url || !this.blobUrls.has(url)) return;
    URL.revokeObjectURL(url);
    this.blobUrls.delete(url);
  }

  private revokeAllBlobs() {
    for (const url of this.blobUrls) URL.revokeObjectURL(url);
    this.blobUrls.clear();
  }

  private setLogoUploading(key: string, on: boolean) {
    const next = new Set(this.uploadingLogoKeys());
    if (on) next.add(key);
    else next.delete(key);
    this.uploadingLogoKeys.set(next);
  }

  private cancelLogoUpload(key: string, opts: { forget?: boolean } = {}) {
    this.logoUploads.get(key)?.unsubscribe();
    this.logoUploads.delete(key);
    this.setLogoUploading(key, false);
    const col = this.columns().find((c) => c.key === key);
    const held = this.logoHeld.get(key);
    this.logoHeld.delete(key);
    if (col) {
      this.revokeBlob(col.logoUrl);
      if (opts.forget) {
        this.forgetStaging(col.logoUrl);
        this.forgetStaging(held);
        col.logoUrl = null;
      } else {
        col.logoUrl = isBlobUrl(held) ? null : (held ?? null);
      }
      this.columns.set([...this.columns()]);
    } else if (opts.forget) {
      this.forgetStaging(held);
    }
  }

  private discardStagingSession() {
    if (this.sessionDiscarded || this.saving()) return;
    this.sessionDiscarded = true;
    const token = this.auth.token();
    if (!token) return;
    void fetch(
      `${environment.apiUrl}/templates/staging/sessions/${this.sessionId}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
        keepalive: true,
      },
    );
  }

  private applyTemplate(tpl: Template) {
    this.bgUpload?.unsubscribe();
    this.bgUpload = undefined;
    this.uploadingBackground.set(false);
    this.revokeBlob(this.backgroundImageUrl);
    this.backgroundHeld = null;
    for (const sub of this.logoUploads.values()) sub.unsubscribe();
    this.logoUploads.clear();
    this.uploadingLogoKeys.set(new Set());
    this.logoHeld.clear();
    for (const col of this.columns()) this.revokeBlob(col.logoUrl);

    this.isNew.set(false);
    this.templateId = tpl.id;
    this.name = tpl.name;
    this.description = tpl.description || '';
    this.maxComments = tpl.maxCommentsPerParticipant ?? null;
    this.votesPerParticipant = tpl.votesPerParticipant ?? 5;
    this.maxVotesPerCard = tpl.maxVotesPerCard ?? 2;
    this.backgroundColor = tpl.backgroundColor || '';
    this.backgroundImageUrl = tpl.backgroundImageUrl || null;
    this.columns.set(
      tpl.columns.map((c) =>
        this.makeColumn({
          id: c.id,
          title: c.title,
          description: c.description || '',
          icon: c.icon || '',
          logoUrl: c.logoUrl || null,
          position: c.position,
        }),
      ),
    );
  }

  private makeColumn(
    data: Omit<TemplateColumnInput, 'position'> & { position?: number },
  ): EditableColumn {
    this.keySeq += 1;
    return {
      key: `col-${this.keySeq}`,
      id: data.id,
      title: data.title,
      description: data.description ?? '',
      icon: data.icon ?? '',
      logoUrl: data.logoUrl ?? null,
      position: data.position ?? 0,
    };
  }
}
