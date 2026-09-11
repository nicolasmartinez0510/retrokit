import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { httpErrorMessage } from '../../core/http-error';
import { isSvgFile, rejectImageFile } from '../../core/image-file';
import { Template, TemplateColumnInput } from '../../core/models';
import { ToastService } from '../../core/toast.service';
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
        @if (isNew()) {
          <p class="hint">Guardá la plantilla para subir una imagen de fondo.</p>
        }
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
              <label class="btn-secondary btn-sm" [class.disabled]="isNew()">
                Subir imagen
                <input
                  type="file"
                  hidden
                  [accept]="imageAccept"
                  [disabled]="isNew()"
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
                <div class="symbol-preview">
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
                  @if (col.id) {
                    <label
                      class="btn-ghost btn-sm icon-btn"
                      title="Subir imagen"
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
                        (change)="onLogoFile($event, col)"
                      />
                    </label>
                  } @else {
                    <span class="hint tiny">Guardá para subir imagen</span>
                  }
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
          [style.background-image]="
            backgroundImageUrl ? 'url(' + backgroundImageUrl + ')' : null
          "
        >
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
          <button class="btn-primary" type="submit" [disabled]="saving()">
            {{ saving() ? 'Guardando…' : 'Guardar' }}
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
    .hint.tiny { font-size: 0.75rem; }
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
    label.disabled { opacity: 0.5; pointer-events: none; }
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
      border-radius: 8px;
      background: var(--color-bg-muted);
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
      background: var(--color-sky-soft);
      background-size: cover;
      background-position: center;
      border-radius: var(--radius-sm);
      padding: 0.85rem 1rem;
      h3 { font-size: 0.9rem; margin-bottom: 0.5rem; }
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
export class TemplateEditorPage implements OnInit {
  private readonly api = inject(ApiService);
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
  crop = signal<{ kind: CropKind; file: File; columnKey?: string } | null>(
    null,
  );
  private keySeq = 0;

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

    this.saving.set(true);
    const req = this.isNew()
      ? this.api.createTemplate(this.payload())
      : this.api.updateTemplate(this.templateId!, this.payload());

    req.subscribe({
      next: (tpl) => {
        this.saving.set(false);
        if (this.isNew()) {
          this.toast.ok('Plantilla creada. Ya podés subir fondo y logos.');
          void this.router.navigate(['/templates', tpl.id], { replaceUrl: true });
          return;
        }
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
    col.icon = '';
    const hadLogo = !!col.logoUrl;
    col.logoUrl = null;
    this.columns.set([...this.columns()]);
    if (!this.templateId || !col.id) return;
    const persist = () => {
      this.api.updateTemplate(this.templateId!, this.payload()).subscribe({
        next: (tpl) => this.applyTemplate(tpl),
        error: (e) => this.fail(e, 'No se pudo quitar el símbolo'),
      });
    };
    if (hadLogo) {
      this.api.deleteColumnLogo(this.templateId, col.id).subscribe({
        next: persist,
        error: (e) => this.fail(e, 'No se pudo quitar el logo'),
      });
      return;
    }
    persist();
  }

  onBackgroundFile(ev: Event) {
    const file = this.takeFile(ev);
    if (!file || !this.templateId) return;
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
    if (!file || !this.templateId || !col.id) return;
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
    if (!this.templateId) return;
    this.api.deleteTemplateBackground(this.templateId).subscribe({
      next: (tpl) => {
        this.applyTemplate(tpl);
        this.toast.ok('Fondo quitado');
      },
      error: (e) => this.fail(e, 'No se pudo quitar el fondo'),
    });
  }

  private uploadBackground(file: File) {
    if (!this.templateId) return;
    this.api.uploadTemplateBackground(this.templateId, file).subscribe({
      next: (tpl) => {
        this.applyTemplate(tpl);
        this.toast.ok('Fondo actualizado');
      },
      error: (e) => this.fail(e, 'No se pudo subir el fondo'),
    });
  }

  private uploadLogo(file: File, columnKey: string) {
    const col = this.columns().find((c) => c.key === columnKey);
    if (!this.templateId || !col?.id) return;
    this.api.uploadColumnLogo(this.templateId, col.id, file).subscribe({
      next: (tpl) => {
        this.applyTemplate(tpl);
        this.toast.ok('Logo actualizado');
      },
      error: (e) => this.fail(e, 'No se pudo subir el logo'),
    });
  }

  private payload() {
    return {
      name: this.name.trim(),
      description: this.description.trim() || null,
      maxCommentsPerParticipant: this.maxComments || null,
      votesPerParticipant: this.votesPerParticipant,
      maxVotesPerCard: this.maxVotesPerCard,
      backgroundColor: this.backgroundColor.trim() || null,
      columns: this.columns().map((c, i) => ({
        ...(c.id ? { id: c.id } : {}),
        title: c.title.trim(),
        description: c.description?.trim() || null,
        icon: c.logoUrl ? null : c.icon?.trim() || null,
        position: i,
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

  private applyTemplate(tpl: Template) {
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
