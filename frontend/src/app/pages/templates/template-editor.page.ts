import {
  Component,
  HostListener,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
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
import {
  Phase,
  PHASE_KIND_LABELS,
  Template,
  TemplateColumnInput,
} from '../../core/models';
import {
  DEFAULT_CLASSIC_PHASE_IDS,
  DEFAULT_SEMAFORO_ITEMS,
} from '../../core/phase-rules';
import { ToastService } from '../../core/toast.service';
import { environment } from '../../../environments/environment';
import { EmojiPickerComponent } from '../../shared/emoji-picker.component';
import {
  CropKind,
  ImageCropModalComponent,
} from '../../shared/image-crop-modal.component';
import {
  PhasePillItem,
  PhasePillsComponent,
} from '../../shared/phase-pills.component';
import { phaseSummaryChips } from '../phases/phases.page';

type EditableColumn = TemplateColumnInput & { key: string };

type EditablePhase = {
  key: string;
  phaseId: string;
  phase: Phase;
  hiddenColumnIds: string[];
};

type EditableSemaforoItem = {
  key: string;
  id?: string;
  title: string;
  description: string;
};

/** Unsaved editor snapshot so we can round-trip to the phase viewer. */
type TemplateEditorDraft = {
  v: 1;
  sessionId: string;
  name: string;
  description: string;
  maxComments: number | null;
  votesPerParticipant: number;
  maxVotesPerCard: number;
  backgroundColor: string;
  backgroundImageUrl: string | null;
  columns: Array<{
    id?: string;
    title: string;
    description: string;
    icon: string;
    logoUrl: string | null;
    position: number;
  }>;
  phases: Array<{ phaseId: string; hiddenColumnIds: string[] }>;
  selectedPhaseId: string | null;
  editorStage: 'general' | 'fases' | 'columnas';
  semaforoItems: Array<{
    id?: string;
    title: string;
    description: string;
  }>;
};

const MAX_SEMAFORO_ITEMS = 8;
const DRAFT_KEY_PREFIX = 'rk:template-draft:';

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
    PhasePillsComponent,
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
        <a class="btn-secondary" routerLink="/templates" (click)="leaveEditor()">
          Volver
        </a>
      </div>

      <form class="editor-form" (ngSubmit)="save()">
        <div class="card panel">
        <nav class="stage-tabs" aria-label="Etapas del editor">
          <button
            type="button"
            class="stage-tab"
            [class.active]="editorStage() === 'general'"
            (click)="goToStage('general')"
          >
            General
          </button>
          <button
            type="button"
            class="stage-tab"
            [class.active]="editorStage() === 'fases'"
            (click)="goToStage('fases')"
          >
            Fases
          </button>
          <button
            type="button"
            class="stage-tab"
            [class.active]="editorStage() === 'columnas'"
            (click)="goToStage('columnas')"
          >
            Columnas
          </button>
        </nav>

          <div class="stage-content">
            @if (editorStage() === 'general') {
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
            }

            @if (editorStage() === 'fases') {
              <h2>Fases</h2>
              <p class="hint">
                Arrastrá para reordenar. Hacé clic en una fase para elegir qué
                columnas se ven durante esa fase.
              </p>
              <app-phase-pills
                mode="edit"
                [phases]="pillPhases()"
                [selectedId]="selectedPhaseKey()"
                [showAdd]="availablePhases().length > 0"
                (phasesChange)="onPhasesChange($event)"
                (select)="togglePhaseSelection($event)"
                (remove)="onPhaseRemoved($event)"
                (addPhase)="showAddMenu.set(true)"
              />

              @if (showAddMenu()) {
                <div class="add-menu card">
                  <div class="add-menu-head">
                    <strong>Agregar fase</strong>
                    <button
                      type="button"
                      class="btn-ghost btn-sm"
                      (click)="showAddMenu.set(false)"
                    >
                      Cerrar
                    </button>
                  </div>
                  @if (availablePhases().length) {
                    <div class="add-options">
                      @for (p of availablePhases(); track p.id) {
                        <button
                          type="button"
                          class="add-option"
                          [style.--pill-color]="p.color || null"
                          (click)="addPhase(p)"
                        >
                          @if (p.icon) {
                            <span aria-hidden="true">{{ p.icon }}</span>
                          }
                          <span class="add-option-name">{{ p.name }}</span>
                          <span class="add-option-kind">{{ kindLabel(p.kind) }}</span>
                        </button>
                      }
                    </div>
                  } @else {
                    <p class="hint">Ya usás todas las fases disponibles.</p>
                  }
                  <a class="link-sm" (click)="openPhaseEditor('new')">
                    Crear una fase nueva
                  </a>
                </div>
              }

              @for (w of phaseWarnings(); track w) {
                <p class="soft-warning">{{ w }}</p>
              }

              @if (selectedPhase(); as sel) {
                <div class="phase-panel card">
                  <div class="phase-panel-head">
                    <div>
                      <strong>
                        @if (sel.phase.icon) {
                          <span aria-hidden="true">{{ sel.phase.icon }} </span>
                        }
                        {{ sel.phase.name }}
                      </strong>
                      <span class="badge">{{ kindLabel(sel.phase.kind) }}</span>
                    </div>
                    <button
                      type="button"
                      class="link-sm"
                      (click)="openPhaseEditor(sel.phaseId)"
                    >
                      {{ sel.phase.isSystem ? 'Ver la fase' : 'Editar la fase' }}
                    </button>
                  </div>
                  @if (sel.phase.description) {
                    <p class="hint">{{ sel.phase.description }}</p>
                  }
                  <div class="chips">
                    @for (chip of chipsFor(sel.phase); track $index) {
                      <span class="chip">{{ chip }}</span>
                    }
                  </div>

                  <h3>Columnas visibles en esta fase</h3>
                  <div class="visible-cols">
                    @for (col of columns(); track col.key) {
                      <label
                        class="check"
                        [class.disabled]="!col.id"
                        [title]="
                          !col.id ? 'Guardá la plantilla para ocultar columnas nuevas' : ''
                        "
                      >
                        <input
                          type="checkbox"
                          [checked]="isColumnVisible(sel, col)"
                          [disabled]="!col.id || (isColumnVisible(sel, col) && visibleColumnCount(sel) <= 1)"
                          (change)="toggleColumnVisible(sel, col, $event)"
                        />
                        <span>
                          @if (col.logoUrl) {
                            <img class="col-logo xs" [src]="col.logoUrl" alt="" />
                          } @else if (col.icon) {
                            <span aria-hidden="true">{{ col.icon }} </span>
                          }
                          {{ col.title || 'Sin título' }}
                        </span>
                      </label>
                    }
                  </div>
                  @if (hasUnsavedColumns()) {
                    <p class="hint">Guardá la plantilla para ocultar columnas nuevas.</p>
                  }
                  <p class="hint">Al menos una columna tiene que quedar visible.</p>
                </div>
              }

              @if (needsSemaforo()) {
                <div class="columns-header">
                  <h2>Ítems del semáforo</h2>
                  <button
                    type="button"
                    class="btn-secondary btn-sm"
                    (click)="addSemaforoItem()"
                    [disabled]="semaforoItems().length >= maxSemaforoItems"
                  >
                    <svg class="plus-icon" viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        d="M12 4.5a.75.75 0 0 1 .75.75v6.75h6.75a.75.75 0 0 1 0 1.5h-6.75v6.75a.75.75 0 0 1-1.5 0v-6.75H4.5a.75.75 0 0 1 0-1.5h6.75V5.25A.75.75 0 0 1 12 4.5Z"
                      />
                    </svg>
                    Agregar ítem
                  </button>
                </div>
                <p class="hint">
                  Cada participante califica estos ítems en rojo, amarillo o verde.
                  Máx. {{ maxSemaforoItems }}.
                </p>
                <div class="semaforo-items">
                  @for (item of semaforoItems(); track item.key; let i = $index) {
                    <div class="semaforo-row">
                      <div class="semaforo-head">
                        <span class="semaforo-head-spacer" aria-hidden="true"></span>
                        <span class="semaforo-head-label">Título</span>
                        <span class="semaforo-head-label grow">Pregunta</span>
                        <span class="semaforo-head-spacer" aria-hidden="true"></span>
                      </div>
                      <div class="semaforo-controls">
                        <span class="semaforo-badge" aria-hidden="true">🚦</span>
                        <input
                          [(ngModel)]="item.title"
                          [name]="'sem-title-' + item.key"
                          required
                          maxlength="120"
                          placeholder="Ej. Comunicación"
                          aria-label="Título"
                        />
                        <input
                          class="grow"
                          [(ngModel)]="item.description"
                          [name]="'sem-desc-' + item.key"
                          maxlength="500"
                          placeholder="¿Qué querés que califiquen?"
                          aria-label="Pregunta"
                        />
                        <button
                          type="button"
                          class="icon-btn trash"
                          title="Quitar ítem"
                          aria-label="Quitar ítem"
                          (click)="removeSemaforoItem(i)"
                          [disabled]="semaforoItems().length <= 1"
                        >
                          <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path
                              d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>
                  }
                </div>
              }
            }

            @if (editorStage() === 'columnas') {
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
            }
          </div>

        <div class="form-actions">
          <button
            type="button"
            class="btn-ghost"
            (click)="prevStage()"
            [disabled]="editorStage() === 'general'"
          >
            Anterior
          </button>
          <div class="form-actions-end">
            @if (editorStage() !== 'columnas') {
              <button
                type="button"
                class="btn-ghost"
                (click)="save()"
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
              <button type="button" class="btn-primary" (click)="nextStage()">
                Siguiente
              </button>
            } @else {
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
            }
          </div>
        </div>
        </div>

        <aside
          class="preview-panel card"
          [class.has-theme]="!!backgroundColor || !!backgroundImageUrl"
          [style.background-color]="backgroundColor || null"
        >
          @if (backgroundImageUrl) {
            <img class="preview-bg" [src]="backgroundImageUrl" alt="" />
          }
          <h3>Vista previa</h3>
          <app-phase-pills mode="retro" [phases]="pillPhases()" />
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
        </aside>
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
    .editor-form {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    .panel {
      padding: 1.25rem 1.25rem 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    h2 {
      font-size: 1.05rem;
      margin: 0.25rem 0 0;
    }
    .stage-tabs {
      display: flex;
      flex-wrap: wrap;
      gap: 0.35rem;
      border-bottom: 1px solid var(--color-border);
      padding-bottom: 0.5rem;
    }
    .stage-tab {
      appearance: none;
      border: none;
      background: transparent;
      font: inherit;
      font-size: 0.9rem;
      color: var(--color-text-muted);
      padding: 0.45rem 0.9rem;
      cursor: pointer;
      border-bottom: 2px solid transparent;
      margin-bottom: -0.5rem;
      border-radius: 999px 999px 0 0;
      &:hover {
        color: var(--color-text);
        background: var(--color-sky-soft);
      }
      &.active {
        color: var(--color-brand);
        font-weight: 600;
        border-bottom-color: var(--color-brand);
        background: transparent;
      }
    }
    .stage-content {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      min-width: 0;
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
      flex-shrink: 0;
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
      &.trash {
        color: var(--color-danger, #c62828);
        background: transparent;
        border: none;
      }
      &.trash:hover:not(:disabled) {
        background: color-mix(in srgb, var(--color-danger, #c62828) 12%, transparent);
      }
      &:disabled {
        opacity: 0.4;
        cursor: not-allowed;
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
    .preview-panel {
      position: relative;
      isolation: isolate;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      gap: 0.85rem;
      padding: 1.15rem 1.25rem 1.25rem;
      h3 { font-size: 0.9rem; margin: 0; }
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
    .preview-panel > :not(.preview-bg) {
      position: relative;
      z-index: 1;
    }
    .preview-panel.has-theme .preview-col {
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
      justify-content: space-between;
      align-items: center;
      gap: 0.75rem;
      flex-wrap: wrap;
      margin-top: 0.35rem;
      padding-top: 1rem;
      padding-bottom: 0.35rem;
      border-top: 1px solid var(--color-border);
    }
    .form-actions-end {
      display: flex;
      gap: 0.5rem;
      align-items: center;
      margin-left: auto;
    }
    .add-menu,
    .phase-panel {
      padding: 0.85rem;
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
    }
    .add-menu-head,
    .phase-panel-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 0.5rem;
      flex-wrap: wrap;
    }
    .phase-panel-head > div {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-wrap: wrap;
    }
    .phase-panel h3 {
      font-size: 0.9rem;
      margin: 0.35rem 0 0;
    }
    .add-options {
      display: flex;
      flex-wrap: wrap;
      gap: 0.45rem;
    }
    .add-option {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.4rem 0.75rem;
      border-radius: 999px;
      border: 1px solid var(--pill-color, var(--color-border));
      background: var(--color-bg);
      color: var(--color-text);
      font: inherit;
      font-size: 0.8rem;
      cursor: pointer;
      &:hover {
        background: var(--color-sky-soft);
        border-color: var(--pill-color, var(--color-brand));
      }
    }
    .add-option-kind {
      color: var(--color-text-muted);
      font-size: 0.72rem;
    }
    .link-sm {
      appearance: none;
      border: none;
      background: none;
      padding: 0;
      font: inherit;
      font-size: 0.85rem;
      color: var(--color-brand);
      cursor: pointer;
      text-decoration: none;
      align-self: flex-start;
      &:hover {
        text-decoration: underline;
      }
    }
    .soft-warning {
      margin: 0;
      font-size: 0.85rem;
      color: var(--color-warning, #9a6700);
      background: var(--color-warning-soft, #fff8e1);
      border-radius: var(--radius-sm);
      padding: 0.45rem 0.65rem;
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 0.3rem;
    }
    .chip {
      font-size: 0.72rem;
      padding: 0.15rem 0.5rem;
      border-radius: 999px;
      background: var(--color-sky-soft);
      color: var(--color-text-muted);
    }
    .visible-cols {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem 1rem;
    }
    .check {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      font-size: 0.88rem;
      cursor: pointer;
      &.disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }
    }
    .col-logo.xs {
      width: 18px;
      height: 18px;
      vertical-align: middle;
    }
    .semaforo-items {
      display: flex;
      flex-direction: column;
      gap: 0.65rem;
    }
    .semaforo-row {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      padding: 0.75rem 0.85rem;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
      background: var(--color-bg-muted, var(--color-sky-soft));
    }
    .semaforo-head,
    .semaforo-controls {
      display: grid;
      grid-template-columns: 2rem minmax(0, 1fr) minmax(0, 1.5fr) 2rem;
      gap: 0.65rem;
      align-items: center;
    }
    .semaforo-head-spacer {
      width: 2rem;
    }
    .semaforo-head-label {
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.03em;
      text-transform: uppercase;
      color: var(--color-text-muted);
      &.grow {
        /* occupies the pregunta column */
      }
    }
    .semaforo-badge {
      display: grid;
      place-items: center;
      width: 2rem;
      height: 2rem;
      border-radius: 0.5rem;
      background: var(--color-bg);
      border: 1px solid var(--color-border);
      font-size: 0.95rem;
      line-height: 1;
    }
    .semaforo-controls input {
      width: 100%;
      min-width: 0;
      box-sizing: border-box;
      border: 1.5px solid var(--color-border);
      border-radius: var(--radius-sm);
      padding: 0.6rem 0.75rem;
      background: var(--color-bg);
      color: var(--color-text);
      outline: none;
      font-size: 0.9rem;
      font-weight: 500;
      transition: border-color 0.15s ease;
      &:focus {
        border-color: var(--color-brand);
      }
    }
    .semaforo-controls .icon-btn {
      width: 2rem;
      height: 2rem;
    }
    .plus-icon {
      width: 1rem;
      height: 1rem;
      display: block;
      fill: currentColor;
    }
    .columns-header .btn-secondary.btn-sm {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
    }
    @media (max-width: 700px) {
      .bg-row { grid-template-columns: 1fr; }
      .semaforo-head,
      .semaforo-controls {
        grid-template-columns: 1fr 2rem;
      }
      .semaforo-head-spacer:first-child,
      .semaforo-badge {
        display: none;
      }
      .semaforo-head-label:not(.grow) {
        grid-column: 1;
      }
      .semaforo-head-label.grow {
        grid-column: 1;
        grid-row: 2;
      }
      .semaforo-head-spacer:last-child {
        grid-column: 2;
        grid-row: 1 / 3;
      }
      .semaforo-controls input:first-of-type {
        grid-column: 1;
      }
      .semaforo-controls input.grow {
        grid-column: 1;
        grid-row: 2;
      }
      .semaforo-controls .icon-btn {
        grid-column: 2;
        grid-row: 1 / 3;
        align-self: center;
      }
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
  templatePhases = signal<EditablePhase[]>([]);
  catalog = signal<Phase[]>([]);
  selectedPhaseKey = signal<string | null>(null);
  showAddMenu = signal(false);
  editorStage = signal<'general' | 'fases' | 'columnas'>('general');
  semaforoItems = signal<EditableSemaforoItem[]>([]);
  readonly maxSemaforoItems = MAX_SEMAFORO_ITEMS;
  /** Phase ids to seed once the catalog arrives (template loaded first). */
  private pendingPhaseSeed: readonly string[] | null = null;
  /** Draft phases awaiting catalog for rehydration. */
  private pendingDraftPhases: TemplateEditorDraft['phases'] | null = null;
  private pendingDraftSelectedPhaseId: string | null = null;

  readonly pillPhases = computed<PhasePillItem[]>(() =>
    this.templatePhases().map((p) => ({
      id: p.key,
      name: p.phase.name,
      icon: p.phase.icon,
      color: p.phase.color,
    })),
  );
  readonly availablePhases = computed(() => {
    const used = new Set(this.templatePhases().map((p) => p.phaseId));
    return this.catalog().filter((p) => !used.has(p.id));
  });
  readonly selectedPhase = computed(
    () =>
      this.templatePhases().find((p) => p.key === this.selectedPhaseKey()) ??
      null,
  );
  readonly needsSemaforo = computed(() =>
    this.templatePhases().some(
      (p) => p.phase.kind === 'semaforo' || p.phase.kind === 'semaforo_review',
    ),
  );
  readonly hasUnsavedColumns = computed(() =>
    this.columns().some((c) => !c.id),
  );
  readonly phaseWarnings = computed(() => {
    const phases = this.templatePhases().map((p) => p.phase);
    const warnings: string[] = [];
    let seenGrouping = false;
    let seenSemaforo = false;
    let votingBeforeGrouping = false;
    let reviewBeforeSemaforo = false;
    for (const p of phases) {
      if (p.kind === 'board' && p.voting !== 'off' && !seenGrouping) {
        votingBeforeGrouping = true;
      }
      if (p.kind === 'board' && p.allowGrouping) seenGrouping = true;
      if (p.kind === 'semaforo_review' && !seenSemaforo) {
        reviewBeforeSemaforo = true;
      }
      if (p.kind === 'semaforo') seenSemaforo = true;
    }
    if (votingBeforeGrouping) {
      warnings.push(
        'Hay una fase con votación antes de una fase que permita agrupar: se votarán tarjetas sueltas.',
      );
    }
    if (reviewBeforeSemaforo) {
      warnings.push(
        'Hay una fase "Analizar semáforo" sin una fase "Semáforo" previa: no va a haber votos para analizar.',
      );
    }
    return warnings;
  });
  saving = signal(false);
  uploadingBackground = signal(false);
  uploadingLogoKeys = signal<ReadonlySet<string>>(new Set());
  crop = signal<{ kind: CropKind; file: File; columnKey?: string } | null>(
    null,
  );
  private keySeq = 0;
  private sessionId: string = crypto.randomUUID();
  private sessionDiscarded = false;
  /** Keep staging uploads alive when navigating to a phase and back. */
  private preserveStaging = false;
  private blobUrls = new Set<string>();
  private backgroundHeld: string | null = null;
  private bgUpload?: Subscription;
  private logoUploads = new Map<string, Subscription>();
  private logoHeld = new Map<string, string | null>();

  colorPickerValue() {
    return this.backgroundColor || '#e3f2fd';
  }

  ngOnInit() {
    this.api.listPhases().subscribe({
      next: (phases) => {
        this.catalog.set(phases);
        if (this.pendingPhaseSeed) {
          const ids = this.pendingPhaseSeed;
          this.pendingPhaseSeed = null;
          this.seedPhases(ids);
        }
        this.rehydrateDraftPhases();
      },
      error: (e) => this.fail(e, 'No se pudieron cargar las fases'),
    });

    const id = this.route.snapshot.paramMap.get('id');
    if (!id || id === 'new') {
      this.isNew.set(true);
      if (this.tryRestoreDraft('new')) return;
      this.columns.set([
        this.makeColumn({ title: '', description: '', icon: '▶', position: 0 }),
        this.makeColumn({ title: '', description: '', icon: '■', position: 1 }),
        this.makeColumn({ title: '', description: '', icon: '↻', position: 2 }),
      ]);
      this.seedPhases(DEFAULT_CLASSIC_PHASE_IDS);
      return;
    }

    this.isNew.set(false);
    this.templateId = id;
    if (this.tryRestoreDraft(id)) return;
    this.api.getTemplate(id).subscribe({
      next: (tpl) => this.applyTemplate(tpl),
      error: (e) => this.fail(e, 'No se pudo cargar la plantilla'),
    });
  }

  ngOnDestroy() {
    this.bgUpload?.unsubscribe();
    for (const sub of this.logoUploads.values()) sub.unsubscribe();
    if (!this.preserveStaging) this.discardStagingSession();
    this.revokeAllBlobs();
  }

  @HostListener('window:pagehide')
  onPageHide() {
    if (!this.preserveStaging) this.discardStagingSession();
  }

  /** Leave the editor for the templates list: drop draft + staging. */
  leaveEditor() {
    this.clearDraft();
    this.preserveStaging = false;
  }

  /**
   * Snapshot the in-progress template and open a phase. Volver on the phase
   * page returns here with the draft restored.
   */
  openPhaseEditor(phaseId: string) {
    this.persistDraft();
    this.preserveStaging = true;
    const returnTo =
      this.isNew() || !this.templateId
        ? '/templates/new'
        : `/templates/${this.templateId}`;
    void this.router.navigate(
      phaseId === 'new' ? ['/phases', 'new'] : ['/phases', phaseId],
      { state: { returnTo } },
    );
  }

  goToStage(stage: 'general' | 'fases' | 'columnas') {
    const order = ['general', 'fases', 'columnas'] as const;
    const from = order.indexOf(this.editorStage());
    const to = order.indexOf(stage);
    if (to <= from) {
      this.editorStage.set(stage);
      return;
    }
    for (let i = from; i < to; i++) {
      if (!this.validateStage(order[i])) return;
    }
    this.editorStage.set(stage);
  }

  prevStage() {
    const order = ['general', 'fases', 'columnas'] as const;
    const i = order.indexOf(this.editorStage());
    if (i <= 0) return;
    this.editorStage.set(order[i - 1]);
  }

  nextStage() {
    const order = ['general', 'fases', 'columnas'] as const;
    const i = order.indexOf(this.editorStage());
    if (i < 0 || i >= order.length - 1) return;
    if (!this.validateStage(order[i])) return;
    this.editorStage.set(order[i + 1]);
  }

  private validateStage(stage: 'general' | 'fases' | 'columnas'): boolean {
    if (stage === 'general') {
      if (!this.name.trim() || this.name.trim().length < 2) {
        this.toast.error('El nombre debe tener al menos 2 caracteres');
        return false;
      }
      return true;
    }
    if (stage === 'fases') {
      if (!this.templatePhases().length) {
        this.toast.error('La plantilla necesita al menos una fase');
        return false;
      }
      if (
        this.needsSemaforo() &&
        this.semaforoItems().some((s) => !s.title.trim())
      ) {
        this.toast.error('Cada ítem del semáforo necesita un título');
        return false;
      }
      return true;
    }
    return true;
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

  kindLabel(kind: Phase['kind']) {
    return PHASE_KIND_LABELS[kind] ?? kind;
  }

  chipsFor(phase: Phase) {
    return phaseSummaryChips(phase);
  }

  seedPhases(ids: readonly string[]) {
    if (!this.catalog().length) {
      this.pendingPhaseSeed = ids;
      return;
    }
    const byId = new Map(this.catalog().map((p) => [p.id, p]));
    const next: EditablePhase[] = [];
    for (const id of ids) {
      const phase = byId.get(id);
      if (!phase) continue;
      next.push(this.makeEditablePhase(phase, []));
    }
    if (!next.length) return;
    this.templatePhases.set(next);
    if (!this.selectedPhaseKey()) {
      this.selectedPhaseKey.set(next[0]?.key ?? null);
    }
    this.ensureSemaforoItems();
  }

  onPhasesChange(items: PhasePillItem[]) {
    const byKey = new Map(this.templatePhases().map((p) => [p.key, p]));
    const next = items
      .map((item) => byKey.get(item.id))
      .filter((p): p is EditablePhase => !!p);
    if (!next.length) return;
    this.templatePhases.set(next);
    if (
      this.selectedPhaseKey() &&
      !next.some((p) => p.key === this.selectedPhaseKey())
    ) {
      this.selectedPhaseKey.set(next[0]?.key ?? null);
    }
    this.ensureSemaforoItems();
  }

  togglePhaseSelection(key: string) {
    this.selectedPhaseKey.set(
      this.selectedPhaseKey() === key ? null : key,
    );
  }

  onPhaseRemoved(key: string) {
    const next = this.templatePhases().filter((p) => p.key !== key);
    if (!next.length) return;
    this.templatePhases.set(next);
    if (this.selectedPhaseKey() === key) {
      this.selectedPhaseKey.set(next[0]?.key ?? null);
    }
    this.ensureSemaforoItems();
  }

  addPhase(phase: Phase) {
    if (this.templatePhases().some((p) => p.phaseId === phase.id)) return;
    const entry = this.makeEditablePhase(phase, []);
    this.templatePhases.set([...this.templatePhases(), entry]);
    this.selectedPhaseKey.set(entry.key);
    this.showAddMenu.set(false);
    this.ensureSemaforoItems();
  }

  isColumnVisible(sel: EditablePhase, col: EditableColumn) {
    if (!col.id) return true;
    return !sel.hiddenColumnIds.includes(col.id);
  }

  visibleColumnCount(sel: EditablePhase) {
    return this.columns().filter((c) => this.isColumnVisible(sel, c)).length;
  }

  toggleColumnVisible(
    sel: EditablePhase,
    col: EditableColumn,
    ev: Event,
  ) {
    if (!col.id) return;
    const checked = (ev.target as HTMLInputElement).checked;
    const next = this.templatePhases().map((p) => {
      if (p.key !== sel.key) return p;
      const hidden = new Set(p.hiddenColumnIds);
      if (checked) hidden.delete(col.id!);
      else hidden.add(col.id!);
      const hiddenColumnIds = [...hidden];
      if (
        this.columns().filter((c) => c.id && !hiddenColumnIds.includes(c.id))
          .length < 1
      ) {
        return p;
      }
      return { ...p, hiddenColumnIds };
    });
    this.templatePhases.set(next);
  }

  addSemaforoItem() {
    if (this.semaforoItems().length >= MAX_SEMAFORO_ITEMS) return;
    this.semaforoItems.set([
      ...this.semaforoItems(),
      this.makeSemaforoItem({ title: '', description: '' }),
    ]);
  }

  removeSemaforoItem(index: number) {
    if (this.semaforoItems().length <= 1) return;
    this.semaforoItems.set(
      this.semaforoItems().filter((_, i) => i !== index),
    );
  }

  private ensureSemaforoItems() {
    if (!this.needsSemaforo()) {
      return;
    }
    if (this.semaforoItems().length) return;
    this.semaforoItems.set(
      DEFAULT_SEMAFORO_ITEMS.map((item) =>
        this.makeSemaforoItem({
          title: item.title,
          description: item.description ?? '',
        }),
      ),
    );
  }

  private makeEditablePhase(
    phase: Phase,
    hiddenColumnIds: string[],
  ): EditablePhase {
    this.keySeq += 1;
    return {
      key: `phase-${this.keySeq}`,
      phaseId: phase.id,
      phase,
      hiddenColumnIds: [...hiddenColumnIds],
    };
  }

  private makeSemaforoItem(data: {
    id?: string;
    title: string;
    description?: string;
  }): EditableSemaforoItem {
    this.keySeq += 1;
    return {
      key: `sem-${this.keySeq}`,
      id: data.id,
      title: data.title,
      description: data.description ?? '',
    };
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
    if (!this.templatePhases().length) {
      this.toast.error('La plantilla necesita al menos una fase');
      return;
    }
    if (
      this.needsSemaforo() &&
      this.semaforoItems().some((s) => !s.title.trim())
    ) {
      this.toast.error('Cada ítem del semáforo necesita un título');
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
        this.clearDraft();
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
    const columnIds = new Set(
      this.columns()
        .map((c) => c.id)
        .filter((id): id is string => !!id),
    );
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
      phases: this.templatePhases().map((p, i) => ({
        phaseId: p.phaseId,
        position: i,
        hiddenColumnIds: p.hiddenColumnIds.filter((id) => columnIds.has(id)),
      })),
      ...(this.needsSemaforo()
        ? {
            semaforoItems: this.semaforoItems().map((s, i) => ({
              ...(s.id ? { id: s.id } : {}),
              title: s.title.trim(),
              description: s.description.trim() || null,
              position: i,
            })),
          }
        : { semaforoItems: [] }),
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

    const catalogById = new Map(this.catalog().map((p) => [p.id, p]));
    if (tpl.phases?.length) {
      const mapped = tpl.phases
        .slice()
        .sort((a, b) => a.position - b.position)
        .map((tp) => {
          const phase = tp.phase ?? catalogById.get(tp.phaseId);
          if (!phase) return null;
          return this.makeEditablePhase(phase, tp.hiddenColumnIds ?? []);
        })
        .filter((p): p is EditablePhase => !!p);
      if (mapped.length) {
        this.templatePhases.set(mapped);
        this.selectedPhaseKey.set(mapped[0]?.key ?? null);
      } else {
        this.seedPhases(DEFAULT_CLASSIC_PHASE_IDS);
      }
    } else if (this.catalog().length) {
      this.seedPhases(DEFAULT_CLASSIC_PHASE_IDS);
    } else {
      this.pendingPhaseSeed = DEFAULT_CLASSIC_PHASE_IDS;
    }

    if (tpl.semaforoItems?.length) {
      this.semaforoItems.set(
        tpl.semaforoItems.map((s) =>
          this.makeSemaforoItem({
            id: s.id,
            title: s.title,
            description: s.description || '',
          }),
        ),
      );
    } else {
      this.semaforoItems.set([]);
      this.ensureSemaforoItems();
    }
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

  private draftStorageKey(id: string | null | undefined = this.templateId) {
    return `${DRAFT_KEY_PREFIX}${id ?? 'new'}`;
  }

  private persistDraft() {
    const draft: TemplateEditorDraft = {
      v: 1,
      sessionId: this.sessionId,
      name: this.name,
      description: this.description,
      maxComments: this.maxComments,
      votesPerParticipant: this.votesPerParticipant,
      maxVotesPerCard: this.maxVotesPerCard,
      backgroundColor: this.backgroundColor,
      backgroundImageUrl: this.backgroundImageUrl,
      columns: this.columns().map((c) => ({
        id: c.id,
        title: c.title,
        description: c.description ?? '',
        icon: c.icon ?? '',
        logoUrl: c.logoUrl ?? null,
        position: c.position,
      })),
      phases: this.templatePhases().map((p) => ({
        phaseId: p.phaseId,
        hiddenColumnIds: [...p.hiddenColumnIds],
      })),
      selectedPhaseId:
        this.templatePhases().find((p) => p.key === this.selectedPhaseKey())
          ?.phaseId ?? null,
      editorStage: this.editorStage(),
      semaforoItems: this.semaforoItems().map((s) => ({
        id: s.id,
        title: s.title,
        description: s.description,
      })),
    };
    try {
      sessionStorage.setItem(this.draftStorageKey(), JSON.stringify(draft));
    } catch {
      /* ignore quota / private mode */
    }
  }

  private clearDraft() {
    try {
      sessionStorage.removeItem(this.draftStorageKey());
      if (this.templateId) {
        sessionStorage.removeItem(this.draftStorageKey('new'));
      }
    } catch {
      /* ignore */
    }
    this.pendingDraftPhases = null;
    this.pendingDraftSelectedPhaseId = null;
  }

  private readDraft(id: string): TemplateEditorDraft | null {
    try {
      const raw = sessionStorage.getItem(this.draftStorageKey(id));
      if (!raw) return null;
      const parsed = JSON.parse(raw) as TemplateEditorDraft;
      if (!parsed || parsed.v !== 1) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  /** @returns true if a draft was restored. */
  private tryRestoreDraft(id: string): boolean {
    const draft = this.readDraft(id);
    if (!draft) return false;
    this.applyDraft(draft);
    return true;
  }

  private applyDraft(draft: TemplateEditorDraft) {
    this.sessionId = draft.sessionId || crypto.randomUUID();
    this.sessionDiscarded = false;
    this.name = draft.name ?? '';
    this.description = draft.description ?? '';
    this.maxComments = draft.maxComments ?? null;
    this.votesPerParticipant = draft.votesPerParticipant ?? 5;
    this.maxVotesPerCard = draft.maxVotesPerCard ?? 2;
    this.backgroundColor = draft.backgroundColor ?? '';
    this.backgroundImageUrl = draft.backgroundImageUrl ?? null;
    this.editorStage.set(draft.editorStage ?? 'fases');
    this.columns.set(
      (draft.columns ?? []).map((c) =>
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
    this.semaforoItems.set(
      (draft.semaforoItems ?? []).map((s) =>
        this.makeSemaforoItem({
          id: s.id,
          title: s.title,
          description: s.description || '',
        }),
      ),
    );
    this.pendingDraftSelectedPhaseId = draft.selectedPhaseId ?? null;
    this.pendingDraftPhases = draft.phases ?? [];
    if (this.catalog().length) {
      this.rehydrateDraftPhases();
    }
  }

  private rehydrateDraftPhases() {
    const phases = this.pendingDraftPhases;
    if (!phases) return;
    const catalogById = new Map(this.catalog().map((p) => [p.id, p]));
    const mapped = phases
      .map((tp) => {
        const phase = catalogById.get(tp.phaseId);
        if (!phase) return null;
        return this.makeEditablePhase(phase, tp.hiddenColumnIds ?? []);
      })
      .filter((p): p is EditablePhase => !!p);
    this.pendingDraftPhases = null;
    if (mapped.length) {
      this.templatePhases.set(mapped);
      const selectedId = this.pendingDraftSelectedPhaseId;
      this.pendingDraftSelectedPhaseId = null;
      const selected =
        mapped.find((p) => p.phaseId === selectedId) ?? mapped[0];
      this.selectedPhaseKey.set(selected?.key ?? null);
    } else if (!this.templatePhases().length) {
      this.seedPhases(DEFAULT_CLASSIC_PHASE_IDS);
    }
    this.ensureSemaforoItems();
  }
}
