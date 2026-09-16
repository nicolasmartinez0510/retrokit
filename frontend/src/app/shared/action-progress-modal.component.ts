import { Component, OnInit, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  ACTION_ENTRY_MODE_LABELS,
  ActionEntryMode,
  ActionProgressWrite,
} from '../core/models';

const ENTRY_MODES = Object.keys(ACTION_ENTRY_MODE_LABELS) as ActionEntryMode[];

@Component({
  selector: 'app-action-progress-modal',
  imports: [FormsModule],
  template: `
    <div
      class="action-modal-backdrop"
      role="dialog"
      aria-modal="true"
      [attr.aria-labelledby]="titleId"
      (click)="discard.emit()"
    >
      <div class="card action-modal" (click)="$event.stopPropagation()">
        <form (ngSubmit)="submit()">
          <div class="modal-head">
            <h2 [id]="titleId">{{ heading() }}</h2>
            <p class="modal-sub">
              {{ dateLabel() }}
              @if (actionTitle()) {
                · {{ actionTitle() }}
              }
            </p>
            <p class="modal-hint">El título y la fecha los pone el sistema.</p>
          </div>

          <label class="field">
            <span>Modo de ingreso</span>
            <select
              [ngModel]="draftMode()"
              (ngModelChange)="onModeChange($event)"
              name="progressMode"
            >
              @for (mode of entryModes; track mode) {
                <option [value]="mode">{{ modeLabels[mode] }}</option>
              }
            </select>
          </label>

          @if (draftMode() === 'otro') {
            <label class="field">
              <span>¿Cuál?</span>
              <input
                [ngModel]="draftCustom()"
                (ngModelChange)="onCustomChange($event)"
                name="progressModeCustom"
                maxlength="120"
                autocomplete="off"
                placeholder="Mesa de trabajo con Infra"
              />
            </label>
          }

          <label class="field">
            <span>Avances</span>
            <textarea
              [ngModel]="draftProgress()"
              (ngModelChange)="onProgressChange($event)"
              name="progressText"
              maxlength="4000"
              rows="3"
              placeholder="Qué se logró desde la última actualización."
            ></textarea>
          </label>

          <label class="field">
            <span>Pendientes</span>
            <textarea
              [ngModel]="draftPending()"
              (ngModelChange)="onPendingChange($event)"
              name="pendingText"
              maxlength="4000"
              rows="3"
              placeholder="Qué queda por hacer y quién lo sigue."
            ></textarea>
          </label>

          @if (localError() || error()) {
            <p class="form-error">{{ localError() || error() }}</p>
          }

          <div class="actions">
            <button type="button" class="btn-ghost" (click)="discard.emit()">
              Descartar
            </button>
            <button type="submit" class="btn-primary" [disabled]="saving()">
              {{ saveLabel() }}
            </button>
          </div>
        </form>
      </div>
    </div>
  `,
  styles: `
    .action-modal-backdrop {
      position: fixed;
      inset: 0;
      z-index: 55;
      display: grid;
      place-items: center;
      padding: 1.25rem;
      background: var(--color-overlay);
      backdrop-filter: blur(4px);
      animation: progress-modal-in 0.16s ease;
    }
    @keyframes progress-modal-in {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    .action-modal {
      width: min(460px, 100%);
      padding: 1.35rem 1.4rem 1.2rem;
      box-shadow: var(--shadow);
    }
    form {
      display: flex;
      flex-direction: column;
      gap: 0.9rem;
    }
    .modal-head {
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
    }
    h2 {
      margin: 0;
      font-size: 1.15rem;
    }
    .modal-sub {
      margin: 0;
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--color-text-muted);
    }
    .modal-hint {
      margin: 0;
      font-size: 0.78rem;
      color: var(--color-text-muted);
    }
    .field {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--color-text-muted);
      input,
      textarea,
      select {
        font: inherit;
        font-weight: 500;
        color: var(--color-text);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-sm);
        padding: 0.55rem 0.65rem;
        background: var(--color-bg);
      }
      textarea {
        resize: vertical;
        min-height: 4.5rem;
      }
    }
    .form-error {
      margin: 0;
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;
      margin-top: 0.25rem;
    }
  `,
})
export class ActionProgressModalComponent implements OnInit {
  readonly titleId = 'action-progress-modal-title';
  readonly entryModes = ENTRY_MODES;
  readonly modeLabels = ACTION_ENTRY_MODE_LABELS;

  heading = input('Actualización de avances');
  dateLabel = input('');
  actionTitle = input('');
  entryMode = input<ActionEntryMode>('retrospectiva');
  entryModeCustom = input('');
  progress = input('');
  pending = input('');
  saveLabel = input('Guardar avance');
  saving = input(false);
  error = input('');

  save = output<ActionProgressWrite>();
  discard = output<void>();

  draftMode = signal<ActionEntryMode>('retrospectiva');
  draftCustom = signal('');
  draftProgress = signal('');
  draftPending = signal('');
  localError = signal('');

  ngOnInit() {
    this.draftMode.set(this.entryMode());
    this.draftCustom.set(this.entryModeCustom());
    this.draftProgress.set(this.progress());
    this.draftPending.set(this.pending());
  }

  onModeChange(value: ActionEntryMode) {
    this.draftMode.set(value);
    if (value !== 'otro') this.draftCustom.set('');
    this.localError.set('');
  }

  onCustomChange(value: string) {
    this.draftCustom.set(value);
    this.localError.set('');
  }

  onProgressChange(value: string) {
    this.draftProgress.set(value);
    this.localError.set('');
  }

  onPendingChange(value: string) {
    this.draftPending.set(value);
    this.localError.set('');
  }

  submit() {
    if (this.saving()) return;
    const progress = this.draftProgress().trim();
    const pending = this.draftPending().trim();
    if (!progress && !pending) {
      this.localError.set('Escribí al menos un avance o un pendiente.');
      return;
    }
    const mode = this.draftMode();
    const custom = this.draftCustom().trim();
    if (mode === 'otro' && !custom) {
      this.localError.set('Escribí el modo de ingreso para la opción Otro.');
      return;
    }
    this.localError.set('');
    this.save.emit({
      entryMode: mode,
      ...(mode === 'otro' ? { entryModeCustom: custom } : {}),
      ...(progress ? { progress } : {}),
      ...(pending ? { pending } : {}),
    });
  }
}
