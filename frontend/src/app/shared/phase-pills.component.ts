import { Component, computed, input, output } from '@angular/core';
import {
  CdkDrag,
  CdkDragDrop,
  CdkDragHandle,
  CdkDragPlaceholder,
  CdkDropList,
  moveItemInArray,
} from '@angular/cdk/drag-drop';

export interface PhasePillItem {
  id: string;
  name: string;
  icon?: string | null;
  color?: string | null;
}

export type PhasePillsMode = 'retro' | 'edit';

/** Pick a readable text color for a solid hex background. */
export function phasePillTextColor(hex: string | null | undefined): string | null {
  if (!hex) return null;
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) {
    h = h
      .split('')
      .map((c) => c + c)
      .join('');
  }
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.62 ? '#1a1a1a' : '#ffffff';
}

/**
 * Horizontal row of phase pills.
 *
 * - `mode="retro"`: read-only progress pills (active / done), optionally
 *   clickable for the facilitator (`clickable` + `(pick)`).
 * - `mode="edit"`: sortable pills (CDK drag & drop) with a remove button and
 *   an "add" pill. Emits `(phasesChange)` with the reordered/filtered list,
 *   `(select)` when a pill is clicked, `(remove)` with the id removed and
 *   `(addPhase)` when the add pill is clicked.
 *
 * NOTE: pill styles were copied from `.phases` / `.phase` in
 * `pages/retro/retro.page.scss`; once retro.page uses this component those
 * duplicated rules can be removed from the page stylesheet.
 */
@Component({
  selector: 'app-phase-pills',
  imports: [CdkDropList, CdkDrag, CdkDragHandle, CdkDragPlaceholder],
  template: `
    @if (mode() === 'edit') {
      <div
        class="phases edit"
        cdkDropList
        cdkDropListOrientation="mixed"
        [cdkDropListData]="phases()"
        (cdkDropListDropped)="drop($event)"
        role="list"
        aria-label="Fases de la plantilla"
      >
        @for (p of phases(); track p.id) {
          <div
            class="phase edit-pill"
            cdkDrag
            [cdkDragData]="p"
            role="listitem"
            [class.selected]="p.id === selectedId()"
            [class.has-color]="!!p.color"
            [style.--pill-color]="p.color || null"
            [attr.aria-selected]="p.id === selectedId()"
            (click)="select.emit(p.id)"
          >
            <span
              class="drag-handle"
              cdkDragHandle
              aria-hidden="true"
              title="Arrastrar para reordenar"
              (click)="$event.stopPropagation()"
              >⠿</span
            >
            @if (p.color) {
              <span class="pill-dot" aria-hidden="true"></span>
            }
            @if (p.icon) {
              <span class="pill-icon" aria-hidden="true">{{ p.icon }}</span>
            }
            <span class="pill-name">{{ p.name }}</span>
            <button
              type="button"
              class="pill-remove"
              [disabled]="phases().length <= 1"
              [attr.aria-label]="'Quitar ' + p.name"
              [title]="
                phases().length <= 1
                  ? 'Tiene que quedar al menos una fase'
                  : 'Quitar'
              "
              (click)="onRemove($event, p.id)"
            >
              ×
            </button>
            <div class="phase edit-pill placeholder" *cdkDragPlaceholder></div>
          </div>
        }
        @if (showAdd()) {
          <button
            type="button"
            class="phase add-pill"
            (click)="addPhase.emit()"
            title="Agregar fase"
          >
            + Agregar fase
          </button>
        }
      </div>
    } @else {
      <nav class="phases" aria-label="Fases">
        @for (p of phases(); track p.id) {
          <button
            type="button"
            class="phase"
            [class.active]="p.id === activeId()"
            [class.done]="isDone(p.id)"
            [class.clickable]="clickable()"
            [class.has-color]="!!p.color"
            [style.--pill-color]="p.color || null"
            [style.--pill-fg]="
              p.id === activeId() ? textColor(p.color) : null
            "
            [disabled]="!clickable() || p.id === activeId()"
            [attr.aria-current]="p.id === activeId() ? 'step' : null"
            (click)="pick.emit(p.id)"
          >
            @if (p.color && p.id !== activeId()) {
              <span class="pill-dot" aria-hidden="true"></span>
            }
            @if (p.icon) {
              <span class="pill-icon" aria-hidden="true">{{ p.icon }}</span>
            }
            <span class="pill-name">{{ p.name }}</span>
          </button>
        }
      </nav>
    }
  `,
  styles: `
    :host {
      display: block;
    }
    /* Copied from pages/retro/retro.page.scss (.phases / .phase). */
    .phases {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
    }
    .phase {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      padding: 0.4rem 0.75rem;
      border-radius: 999px;
      background: var(--color-bg);
      border: 1px solid var(--color-border);
      font-size: 0.8rem;
      color: var(--color-text-muted);
      font-family: inherit;
      line-height: 1.2;
      max-width: 100%;

      &.clickable:not(:disabled) {
        cursor: pointer;

        &:hover {
          border-color: var(--pill-color, var(--color-brand));
          color: var(--pill-color, var(--color-brand));
          background: var(--color-sky-soft);
        }
      }

      &:disabled:not(.active) {
        cursor: default;
        opacity: 0.85;
      }

      &.active {
        background: var(--pill-color, var(--color-brand));
        border-color: var(--pill-color, var(--color-brand));
        color: var(--pill-fg, var(--color-on-brand));
        font-weight: 700;
        cursor: default;
      }

      &.done:not(.active) {
        border-color: var(--pill-color, var(--color-sky-mid));
        color: var(--pill-color, var(--color-brand));
      }
    }
    .pill-name {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .pill-icon {
      font-size: 0.95em;
      line-height: 1;
    }
    .pill-dot {
      width: 0.55rem;
      height: 0.55rem;
      border-radius: 999px;
      background: var(--pill-color, var(--color-brand));
      flex-shrink: 0;
    }

    /* Edit mode */
    .edit-pill {
      position: relative;
      padding: 0.3rem 0.35rem 0.3rem 0.4rem;
      cursor: pointer;
      user-select: none;
      color: var(--color-text);
      transition:
        border-color 0.12s ease,
        box-shadow 0.12s ease;

      &:hover {
        border-color: var(--pill-color, var(--color-brand));
      }
      &.selected {
        border-color: var(--pill-color, var(--color-brand));
        box-shadow: 0 0 0 2px
          color-mix(in srgb, var(--pill-color, var(--color-brand)) 35%, transparent);
        font-weight: 700;
      }
      &.cdk-drag-preview {
        box-shadow: var(--shadow);
        background: var(--color-bg);
      }
      &.placeholder {
        opacity: 0.35;
        border-style: dashed;
        min-width: 5rem;
      }
    }
    .drag-handle {
      cursor: grab;
      color: var(--color-text-muted);
      font-size: 0.85rem;
      line-height: 1;
      padding: 0 0.1rem;
      touch-action: none;
      &:active {
        cursor: grabbing;
      }
    }
    .pill-remove {
      appearance: none;
      border: none;
      background: transparent;
      color: var(--color-text-muted);
      width: 1.25rem;
      height: 1.25rem;
      border-radius: 999px;
      display: grid;
      place-items: center;
      font-size: 0.95rem;
      line-height: 1;
      cursor: pointer;
      padding: 0;
      margin-left: 0.1rem;
      &:hover:not(:disabled) {
        background: var(--color-danger-soft);
        color: var(--color-danger);
      }
      &:disabled {
        opacity: 0.35;
        cursor: not-allowed;
      }
    }
    .add-pill {
      border-style: dashed;
      cursor: pointer;
      color: var(--color-brand);
      background: transparent;
      &:hover {
        background: var(--color-sky-soft);
        border-color: var(--color-brand);
      }
    }
    .cdk-drag-animating {
      transition: transform 0.18s cubic-bezier(0, 0, 0.2, 1);
    }
    .phases.edit.cdk-drop-list-dragging .edit-pill:not(.cdk-drag-placeholder) {
      transition: transform 0.18s cubic-bezier(0, 0, 0.2, 1);
    }
  `,
})
export class PhasePillsComponent {
  readonly phases = input<PhasePillItem[]>([]);
  readonly activeId = input<string | null>(null);
  readonly mode = input<PhasePillsMode>('retro');
  readonly clickable = input(false);
  readonly selectedId = input<string | null>(null);
  readonly doneIds = input<string[]>([]);
  readonly showAdd = input(true);

  readonly pick = output<string>();
  readonly phasesChange = output<PhasePillItem[]>();
  readonly select = output<string>();
  readonly addPhase = output<void>();
  readonly remove = output<string>();

  private readonly doneSet = computed(() => new Set(this.doneIds()));

  isDone(id: string) {
    return this.doneSet().has(id);
  }

  textColor(color: string | null | undefined) {
    return phasePillTextColor(color);
  }

  drop(ev: CdkDragDrop<PhasePillItem[]>) {
    if (ev.previousIndex === ev.currentIndex) return;
    const next = [...this.phases()];
    moveItemInArray(next, ev.previousIndex, ev.currentIndex);
    this.phasesChange.emit(next);
  }

  onRemove(ev: Event, id: string) {
    ev.stopPropagation();
    if (this.phases().length <= 1) return;
    this.remove.emit(id);
    this.phasesChange.emit(this.phases().filter((p) => p.id !== id));
  }
}
