import { Component, OnInit, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  ActionAssigneeOption,
  ActionLinkedCard,
} from '../core/models';
import { UserAvatarComponent } from './user-avatar.component';

export type ActionItemSavePayload = {
  title: string;
  description: string;
  ownerId: string;
  dueDate: string;
};

@Component({
  selector: 'app-action-item-modal',
  imports: [FormsModule, UserAvatarComponent],
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
          <h2 [id]="titleId">{{ saveLabel() }}</h2>
          <label class="field">
            <span>Nombre de la acción</span>
            <input
              [ngModel]="draftTitle()"
              (ngModelChange)="draftTitle.set($event)"
              name="actionTitle"
              required
              maxlength="300"
              autocomplete="off"
            />
          </label>

          <label class="field">
            <span>Descripción</span>
            <textarea
              [ngModel]="draftDescription()"
              (ngModelChange)="draftDescription.set($event)"
              name="actionDescription"
              maxlength="2000"
              rows="3"
              placeholder="Resultado esperado o contexto."
            ></textarea>
          </label>

          <div class="row">
            <label class="field">
              <span>Asignado</span>
              <select
                [ngModel]="draftOwnerId()"
                (ngModelChange)="draftOwnerId.set($event)"
                name="actionOwner"
              >
                <option value="">Sin asignar</option>
                @for (person of assignees(); track person.id) {
                  <option [value]="person.id">{{ person.name }}</option>
                }
              </select>
            </label>
            <label class="field">
              <span>Fecha de fin</span>
              <input
                type="date"
                [ngModel]="draftDueDate()"
                (ngModelChange)="draftDueDate.set($event)"
                name="actionDue"
              />
            </label>
          </div>

          @if (linkedComments().length) {
            <div class="linked">
              <span class="linked-label">
                Comentario vinculado ({{ linkedComments().length }})
              </span>
              <ul>
                @for (comment of linkedComments(); track comment.id) {
                  <li>
                    @if (comment.content) {
                      <p>{{ comment.content }}</p>
                    }
                    @if (comment.imageUrl) {
                      <img [src]="comment.imageUrl" alt="" />
                    }
                    <div class="linked-author">
                      @if (!comment.isAnonymous) {
                        <app-user-avatar
                          [avatarId]="comment.authorAvatarId"
                          [ownerId]="comment.ownerId"
                          [seed]="comment.id"
                          [name]="comment.authorName || ''"
                          size="sm"
                        />
                      }
                      <span>{{ comment.authorName }}</span>
                    </div>
                  </li>
                }
              </ul>
            </div>
          }

          <div class="actions">
            <button type="button" class="btn-ghost" (click)="discard.emit()">
              Descartar
            </button>
            <button
              type="submit"
              class="btn-primary"
              [disabled]="!canSave() || saving()"
            >
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
    }
    .action-modal {
      width: min(480px, 100%);
      padding: 1.35rem 1.4rem 1.2rem;
      box-shadow: var(--shadow);
    }
    form {
      display: flex;
      flex-direction: column;
      gap: 0.9rem;
    }
    h2 {
      margin: 0;
      font-size: 1.15rem;
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
    .row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.75rem;
    }
    .linked {
      display: flex;
      flex-direction: column;
      gap: 0.45rem;
    }
    .linked-label {
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--color-text-muted);
    }
    .linked ul {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .linked li {
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
      padding: 0.7rem 0.8rem;
      background: var(--color-bg-muted);
    }
    .linked p {
      margin: 0 0 0.4rem;
      white-space: pre-wrap;
      color: var(--color-text);
      font-weight: 500;
    }
    .linked img {
      display: block;
      max-width: 100%;
      max-height: 120px;
      object-fit: contain;
      border-radius: 6px;
      margin-bottom: 0.4rem;
    }
    .linked-author {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      font-size: 0.85rem;
      color: var(--color-text-muted);
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;
      margin-top: 0.25rem;
    }
    @media (max-width: 560px) {
      .row {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class ActionItemModalComponent implements OnInit {
  readonly titleId = 'action-item-modal-title';

  title = input('');
  description = input('');
  ownerId = input('');
  dueDate = input('');
  assignees = input<ActionAssigneeOption[]>([]);
  linkedComments = input<ActionLinkedCard[]>([]);
  saveLabel = input('Guardar acción');
  saving = input(false);

  save = output<ActionItemSavePayload>();
  discard = output<void>();

  draftTitle = signal('');
  draftDescription = signal('');
  draftOwnerId = signal('');
  draftDueDate = signal('');

  ngOnInit() {
    this.draftTitle.set(this.title());
    this.draftDescription.set(this.description());
    this.draftOwnerId.set(this.ownerId());
    this.draftDueDate.set(this.dueDate());
  }

  canSave() {
    return this.draftTitle().trim().length >= 2;
  }

  submit() {
    if (!this.canSave() || this.saving()) return;
    this.save.emit({
      title: this.draftTitle().trim(),
      description: this.draftDescription().trim(),
      ownerId: this.draftOwnerId(),
      dueDate: this.draftDueDate(),
    });
  }
}
