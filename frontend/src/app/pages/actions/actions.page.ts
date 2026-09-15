import { CdkDrag, CdkDragDrop, CdkDropList, CdkDropListGroup } from '@angular/cdk/drag-drop';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { formatDueDate, toDateInputValue } from '../../core/dates';
import {
  ActionAssigneeOption,
  ActionItem,
  ActionLinkedCard,
  ActionStatus,
  TeamDetail,
} from '../../core/models';
import { SocketService } from '../../core/socket.service';
import { ActionItemModalComponent } from '../../shared/action-item-modal.component';
import type { ActionItemSavePayload } from '../../shared/action-item-modal.component';
import { UserAvatarComponent } from '../../shared/user-avatar.component';

@Component({
  selector: 'app-actions-page',
  imports: [
    FormsModule,
    UserAvatarComponent,
    ActionItemModalComponent,
    CdkDropListGroup,
    CdkDropList,
    CdkDrag,
  ],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1>Tablero de acciones</h1>
          <p class="subtitle">{{ team()?.name }}</p>
        </div>
        <div class="header-tools">
          <label class="chip-select">
            <span class="chip-select-label">Retro</span>
            <span class="chip-select-control">
              <select
                [ngModel]="retroFilter()"
                (ngModelChange)="retroFilter.set($event)"
                name="retroFilter"
              >
                <option value="">Todas las retros</option>
                @for (retro of team()?.retrospectives ?? []; track retro.id) {
                  <option [value]="retro.id">{{ retro.title }}</option>
                }
                @if (hasUnscopedActions()) {
                  <option value="__none__">Sin retro</option>
                }
              </select>
            </span>
          </label>
          <button type="button" class="btn-primary" (click)="openCreate()">
            + Agregar acción
          </button>
        </div>
      </div>

      @if (error()) {
        <p class="form-error">{{ error() }}</p>
      }

      <div class="kanban" cdkDropListGroup>
        @for (col of columns; track col.key) {
          <section
            class="card col"
            [class.done]="col.key === 'done'"
            [class.unmet]="col.key === 'unmet'"
            cdkDropList
            [id]="col.key"
            [cdkDropListData]="byStatus(col.key)"
            (cdkDropListDropped)="drop($event, col.key)"
          >
            <h2>{{ col.label }}</h2>
            @for (item of byStatus(col.key); track item.id) {
              <article
                class="item"
                cdkDrag
                [cdkDragData]="item"
                [cdkDragDisabled]="!canMutateAction(item)"
                [class.mutable]="canMutateAction(item)"
                (cdkDragMoved)="onDragMoved()"
                (click)="openEdit(item)"
              >
                <div class="item-head">
                  <strong>{{ item.title }}</strong>
                  @if (canMutateAction(item)) {
                    <div class="item-actions">
                      <button
                        type="button"
                        class="icon-btn"
                        title="Editar"
                        aria-label="Editar acción"
                        (click)="openEdit(item, $event)"
                        (pointerdown)="$event.stopPropagation()"
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path
                            d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10"
                          />
                        </svg>
                      </button>
                      <button
                        type="button"
                        class="icon-btn trash"
                        title="Borrar"
                        aria-label="Borrar acción"
                        (click)="remove($event, item)"
                        (pointerdown)="$event.stopPropagation()"
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path
                            d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
                          />
                        </svg>
                      </button>
                    </div>
                  }
                </div>
                @if (item.description) {
                  <p class="item-desc">{{ item.description }}</p>
                }
                @if (item.retro?.title) {
                  <p class="item-retro">{{ item.retro.title }}</p>
                }
                <div class="item-meta">
                  @if (item.owner) {
                    <span class="badge">
                      <app-user-avatar
                        [avatarId]="item.owner.avatarId"
                        [ownerId]="item.owner.id"
                        [seed]="item.owner.id"
                        [name]="item.owner.name"
                        size="sm"
                      />
                      {{ item.owner.name }}
                    </span>
                  }
                  @if (dueLabel(item.dueDate)) {
                    <span class="due">{{ dueLabel(item.dueDate) }}</span>
                  }
                </div>
              </article>
            } @empty {
              <p class="empty">Vacío</p>
            }
          </section>
        }
      </div>
    </div>

    @if (showModal()) {
      <app-action-item-modal
        [title]="editTitle"
        [description]="editDescription"
        [ownerId]="editOwnerId"
        [dueDate]="editDueDate"
        [assignees]="assignees()"
        [linkedComments]="editLinked"
        [saveLabel]="editingId ? 'Guardar cambios' : 'Guardar acción'"
        [saving]="saving()"
        (save)="saveModal($event)"
        (discard)="closeModal()"
      />
    }
  `,
  styles: `
    .header-tools {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.6rem;
    }
    .chip-select select { max-width: 18rem; }
    .form-error { margin: 0 0 0.85rem; }
    .kanban {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 0.85rem;
    }
    .col {
      padding: 0.85rem;
      background: var(--color-sky-soft);
      min-height: 280px;
      h2 { font-size: 1rem; margin-bottom: 0.75rem; }
      &.done { background: var(--color-sky-soft); }
      &.unmet { background: var(--color-bg-muted); }
    }
    .item {
      position: relative;
      background: var(--color-bg);
      border-radius: 8px;
      padding: 0.7rem;
      margin-bottom: 0.5rem;
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
      cursor: default;
      border: 1px solid var(--color-border);
      &.mutable { cursor: grab; }
      &.mutable:active { cursor: grabbing; }
    }
    .item-head {
      display: flex;
      align-items: flex-start;
      gap: 0.4rem;
      strong {
        flex: 1;
        min-width: 0;
        padding-right: 0.15rem;
      }
    }
    .item-actions {
      display: flex;
      flex-shrink: 0;
      gap: 0.15rem;
    }
    .item-desc {
      margin: 0;
      font-size: 0.85rem;
      color: var(--color-text-muted);
      display: -webkit-box;
      -webkit-line-clamp: 4;
      -webkit-box-orient: vertical;
      overflow: hidden;
      white-space: pre-wrap;
    }
    .item-retro {
      margin: 0;
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--color-text-muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .item-meta {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.35rem;
    }
    .due {
      font-size: 0.8rem;
      color: var(--color-text-muted);
    }
    .icon-btn {
      appearance: none;
      flex-shrink: 0;
      width: 1.85rem;
      height: 1.85rem;
      padding: 0;
      border-radius: 8px;
      display: grid;
      place-items: center;
      background: transparent;
      border: 1.5px solid transparent;
      cursor: pointer;
      color: var(--color-text-muted);
      svg {
        width: 1.1rem;
        height: 1.1rem;
        display: block;
        fill: none;
        stroke: currentColor;
        stroke-width: 1.75;
        stroke-linecap: round;
        stroke-linejoin: round;
      }
      &:hover {
        background: var(--color-bg-muted);
        color: var(--color-text);
      }
      &.trash {
        color: var(--color-danger);
        &:hover { background: var(--color-danger-soft); }
      }
    }
    .empty { color: var(--color-text-muted); font-size: 0.85rem; }
    .cdk-drag-preview {
      box-sizing: border-box;
      border-radius: 8px;
      box-shadow: var(--shadow);
    }
    .cdk-drag-placeholder {
      opacity: 0.35;
    }
    .cdk-drag-animating {
      transition: transform 200ms ease;
    }
    .col.cdk-drop-list-dragging .item:not(.cdk-drag-placeholder) {
      transition: transform 200ms ease;
    }
    @media (max-width: 1100px) {
      .kanban { grid-template-columns: repeat(2, 1fr); }
    }
    @media (max-width: 700px) {
      .kanban { grid-template-columns: 1fr; }
    }
  `,
})
export class ActionsPage implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly sockets = inject(SocketService);

  teamId = '';
  team = signal<TeamDetail | null>(null);
  items = signal<ActionItem[]>([]);
  retroFilter = signal('');
  error = signal('');
  showModal = signal(false);
  saving = signal(false);
  editingId: string | null = null;
  editTitle = '';
  editDescription = '';
  editOwnerId = '';
  editDueDate = '';
  editLinked: ActionLinkedCard[] = [];
  private didDrag = false;
  private socketBound = false;

  private readonly onActionCreated = (payload: unknown) => {
    const item = asActionItem(payload);
    if (!item || item.teamId !== this.teamId) return;
    this.items.update((list) => {
      if (list.some((entry) => entry.id === item.id)) return list;
      return [item, ...list];
    });
  };

  private readonly onActionUpdated = (payload: unknown) => {
    const item = asActionItem(payload);
    if (!item || item.teamId !== this.teamId) return;
    this.items.update((list) => {
      const idx = list.findIndex((entry) => entry.id === item.id);
      if (idx < 0) return [item, ...list];
      const next = list.slice();
      next[idx] = item;
      return next;
    });
  };

  private readonly onActionDeleted = (payload: unknown) => {
    const id = readString(payload, 'id');
    const teamId = readString(payload, 'teamId');
    if (!id || (teamId && teamId !== this.teamId)) return;
    this.items.update((list) => list.filter((entry) => entry.id !== id));
    if (this.editingId === id) this.closeModal();
  };

  columns: { key: ActionStatus; label: string }[] = [
    { key: 'pending', label: 'Pendiente' },
    { key: 'doing', label: 'En curso' },
    { key: 'done', label: 'Cumplido' },
    { key: 'unmet', label: 'No cumplido' },
  ];

  ngOnInit() {
    this.teamId = this.route.snapshot.paramMap.get('id')!;
    this.api.getTeam(this.teamId).subscribe((t) => {
      this.team.set(t);
      const fromQuery = this.route.snapshot.queryParamMap.get('retro');
      if (fromQuery !== null) {
        this.retroFilter.set(fromQuery);
        return;
      }
      const latest = t.retrospectives[0];
      if (latest) this.retroFilter.set(latest.id);
    });
    this.reload();
    this.attachSocket();
  }

  ngOnDestroy() {
    this.detachSocket();
  }

  reload() {
    this.api.listActions(this.teamId).subscribe((items) => this.items.set(items));
  }

  hasUnscopedActions() {
    return this.items().some((item) => !item.retroId);
  }

  visibleItems() {
    const filter = this.retroFilter();
    const items = this.items();
    if (!filter) return items;
    if (filter === '__none__') return items.filter((item) => !item.retroId);
    return items.filter((item) => item.retroId === filter);
  }

  byStatus(status: ActionStatus) {
    return this.visibleItems().filter((i) => i.status === status);
  }

  assignees(): ActionAssigneeOption[] {
    return (
      this.team()?.members.map((member) => ({
        id: member.user.id,
        name: member.user.name,
        avatarId: member.user.avatarId,
      })) ?? []
    );
  }

  isFacilitator() {
    if (this.auth.user()?.isAdmin) return true;
    const userId = this.auth.user()?.id;
    if (!userId) return false;
    return (
      this.team()?.members.some(
        (m) => m.user.id === userId && m.role === 'facilitator',
      ) ?? false
    );
  }

  canMutateAction(item: ActionItem) {
    if (this.isFacilitator()) return true;
    const userId = this.auth.user()?.id;
    if (!userId) return false;
    return item.createdById === userId || item.ownerId === userId;
  }

  dueLabel(iso?: string | null) {
    return formatDueDate(iso);
  }

  onDragMoved() {
    this.didDrag = true;
  }

  drop(event: CdkDragDrop<ActionItem[]>, status: ActionStatus) {
    this.didDrag = true;
    if (event.previousContainer === event.container) return;
    const item = event.item.data as ActionItem;
    if (!item || item.status === status) return;
    if (!this.canMutateAction(item)) return;
    this.move(item, status);
  }

  openEdit(item: ActionItem, event?: Event) {
    event?.stopPropagation();
    if (!event && this.didDrag) {
      this.didDrag = false;
      return;
    }
    this.didDrag = false;
    if (!this.canMutateAction(item)) return;
    this.editingId = item.id;
    this.editTitle = item.title;
    this.editDescription = item.description ?? '';
    this.editOwnerId = item.ownerId ?? '';
    this.editDueDate = toDateInputValue(item.dueDate);
    this.editLinked = linkedCommentsFromAction(item);
    this.showModal.set(true);
  }

  createTargetRetroId() {
    const filter = this.retroFilter();
    if (filter && filter !== '__none__') return filter;
    return this.team()?.retrospectives[0]?.id ?? null;
  }

  openCreate() {
    this.error.set('');
    if (!this.createTargetRetroId()) {
      this.error.set('Elegí una retrospectiva para asociar la acción');
      return;
    }
    this.editingId = null;
    this.editTitle = '';
    this.editDescription = '';
    this.editOwnerId = '';
    this.editDueDate = '';
    this.editLinked = [];
    this.showModal.set(true);
  }

  closeModal() {
    this.showModal.set(false);
    this.editingId = null;
    this.saving.set(false);
  }

  saveModal(payload: ActionItemSavePayload) {
    if (this.editingId) {
      this.saveEdit(this.editingId, payload);
      return;
    }
    const retroId = this.createTargetRetroId();
    if (!retroId) {
      this.error.set('Elegí una retrospectiva para asociar la acción');
      return;
    }
    this.saving.set(true);
    this.error.set('');
    this.api
      .createAction(this.teamId, {
        title: payload.title,
        description: payload.description || undefined,
        ownerId: payload.ownerId || undefined,
        dueDate: payload.dueDate || undefined,
        retroId,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.closeModal();
          this.reload();
        },
        error: (e) => {
          this.saving.set(false);
          this.error.set(e?.error?.message || 'No se pudo crear la acción');
        },
      });
  }

  saveEdit(actionId: string, payload: ActionItemSavePayload) {
    this.saving.set(true);
    this.error.set('');
    this.api
      .updateAction(this.teamId, actionId, {
        title: payload.title,
        description: payload.description,
        ownerId: payload.ownerId || null,
        dueDate: payload.dueDate || null,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.closeModal();
          this.reload();
        },
        error: (e) => {
          this.saving.set(false);
          this.error.set(e?.error?.message || 'No se pudo actualizar la acción');
        },
      });
  }

  remove(event: Event, item: ActionItem) {
    event.stopPropagation();
    if (
      !confirm(
        `¿Borrar la acción “${item.title}”? Esta acción no se puede deshacer.`,
      )
    ) {
      return;
    }
    this.error.set('');
    this.api.deleteAction(item.id).subscribe({
      next: () => this.reload(),
      error: (e) =>
        this.error.set(e?.error?.message || 'No se pudo borrar la acción'),
    });
  }

  move(item: ActionItem, status: ActionStatus) {
    this.error.set('');
    this.items.update((list) =>
      list.map((entry) => (entry.id === item.id ? { ...entry, status } : entry)),
    );
    this.api.updateAction(this.teamId, item.id, { status }).subscribe({
      next: () => this.reload(),
      error: (e) => {
        this.error.set(e?.error?.message || 'No se pudo actualizar la acción');
        this.reload();
      },
    });
  }

  private attachSocket() {
    if (this.socketBound || !this.teamId) return;
    this.sockets.joinTeam(this.teamId);
    this.sockets.on('action-created', this.onActionCreated);
    this.sockets.on('action-updated', this.onActionUpdated);
    this.sockets.on('action-deleted', this.onActionDeleted);
    this.socketBound = true;
  }

  private detachSocket() {
    if (!this.socketBound) return;
    this.sockets.off('action-created', this.onActionCreated);
    this.sockets.off('action-updated', this.onActionUpdated);
    this.sockets.off('action-deleted', this.onActionDeleted);
    this.sockets.leaveTeam(this.teamId);
    this.socketBound = false;
  }
}

function linkedCommentsFromAction(item: ActionItem): ActionLinkedCard[] {
  if (item.group?.cards?.length) return item.group.cards;
  if (item.card) return [item.card];
  return [];
}

function asActionItem(payload: unknown): ActionItem | null {
  if (!payload || typeof payload !== 'object') return null;
  const item = payload as Partial<ActionItem>;
  if (typeof item.id !== 'string' || typeof item.teamId !== 'string') {
    return null;
  }
  if (typeof item.title !== 'string' || typeof item.status !== 'string') {
    return null;
  }
  return item as ActionItem;
}

function readString(payload: unknown, key: string): string {
  if (!payload || typeof payload !== 'object') return '';
  const value = (payload as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : '';
}
