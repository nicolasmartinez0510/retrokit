import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { canMutateAction } from '../../core/action-permissions';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { formatDueDate } from '../../core/dates';
import {
  ACTION_ENTRY_MODE_LABELS,
  ACTION_STATUS_LABELS,
  ActionItem,
  ActionProgressUpdate,
  ActionProgressWrite,
  ActionStatus,
  TeamDetail,
} from '../../core/models';
import { SocketService } from '../../core/socket.service';
import { ActionProgressModalComponent } from '../../shared/action-progress-modal.component';
import { UserAvatarComponent } from '../../shared/user-avatar.component';

type StatusFilter = ActionStatus | 'all';

const STATUS_PLURALS: Record<ActionStatus, string> = {
  pending: 'pendientes',
  doing: 'en curso',
  done: 'cumplidos',
  unmet: 'no cumplidos',
};

@Component({
  selector: 'app-action-progress-page',
  imports: [FormsModule, UserAvatarComponent, ActionProgressModalComponent],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1>Avances</h1>
          <p class="subtitle">{{ subtitle() }}</p>
        </div>
        <div class="header-tools">
          <label class="chip-select">
            <span class="chip-select-label">Retro</span>
            <span class="chip-select-control">
              <select
                [ngModel]="retroFilter()"
                (ngModelChange)="changeRetro($event)"
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
          <label class="chip-select">
            <span class="chip-select-label">Estado</span>
            <span class="chip-select-control">
              <select
                [ngModel]="statusFilter()"
                (ngModelChange)="changeStatus($event)"
                name="statusFilter"
              >
                <option value="all">Todos</option>
                @for (status of statuses; track status) {
                  <option [value]="status">{{ statusLabels[status] }}</option>
                }
              </select>
            </span>
          </label>
        </div>
      </div>

      @if (error()) {
        <p class="form-error">{{ error() }}</p>
      }

      @if (!visibleItems().length) {
        <div class="empty-state card">
          <strong>{{ emptyListMessage() }}</strong>
          Probá con otra retro o cambiá el filtro de estado.
        </div>
      } @else {
        <div class="split">
          <section class="list" role="listbox" aria-label="Accionables">
            @for (item of visibleItems(); track item.id) {
              <button
                type="button"
                class="pick"
                role="option"
                [class.active]="item.id === selectedId()"
                [attr.aria-selected]="item.id === selectedId()"
                (click)="select(item)"
              >
                <span class="pick-main">
                  <span class="pick-title">{{ item.title }}</span>
                  <span class="pick-meta">
                    <span
                      class="dot"
                      [class.doing]="item.status === 'doing'"
                      [class.done]="item.status === 'done'"
                      [class.unmet]="item.status === 'unmet'"
                    ></span>
                    {{ statusLabels[item.status] }}
                    @if (item.owner) {
                      <span class="pick-owner">
                        <app-user-avatar
                          [avatarId]="item.owner.avatarId"
                          [ownerId]="item.owner.id"
                          [seed]="item.owner.id"
                          [name]="item.owner.name"
                          size="sm"
                        />
                        {{ item.owner.name }}
                      </span>
                    } @else {
                      · Sin asignar
                    }
                  </span>
                </span>
                <span class="pick-count" [class.zero]="!item.progressCount">
                  {{ shortCountLabel(item.progressCount ?? 0) }}
                </span>
              </button>
            }
          </section>

          <div class="detail-slot">
            @for (item of selectedList(); track item.id) {
              <section class="card detail">
                <header class="detail-head">
                  <div class="detail-title">
                    <h2>{{ item.title }}</h2>
                    <p class="detail-meta">
                      <span
                        class="dot"
                        [class.doing]="item.status === 'doing'"
                        [class.done]="item.status === 'done'"
                        [class.unmet]="item.status === 'unmet'"
                      ></span>
                      {{ statusLabels[item.status] }}
                      @if (item.owner) {
                        · {{ item.owner.name }}
                      } @else {
                        · Sin asignar
                      }
                      @if (dueLabel(item.dueDate)) {
                        · Vence {{ dueLabel(item.dueDate) }}
                      }
                      · {{ countUpdatesLabel() }}
                    </p>
                  </div>
                  @if (canMutate(item)) {
                    <button
                      type="button"
                      class="btn-primary"
                      (click)="openCreate()"
                    >
                      Agregar avance
                    </button>
                  }
                </header>

                @if (loadingUpdates()) {
                  <p class="empty">Cargando avances…</p>
                } @else if (updates().length) {
                  <ol class="updates">
                    @for (update of updates(); track update.id) {
                      <li class="update">
                        <div class="update-head">
                          <div>
                            <p class="update-title">{{ update.title }}</p>
                            <p class="update-sub">
                              {{ dueLabel(update.createdAt) }}
                              @if (update.author) {
                                · {{ update.author.name }}
                              }
                            </p>
                          </div>
                          <div class="update-tools">
                            <span class="mode">{{ modeLabel(update) }}</span>
                            @if (canMutate(item)) {
                              <button
                                type="button"
                                class="btn-ghost sm"
                                (click)="openEdit(update)"
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                class="btn-ghost sm danger"
                                (click)="removeUpdate(update)"
                              >
                                Borrar
                              </button>
                            }
                          </div>
                        </div>
                        @if (update.progress) {
                          <div class="field-block">
                            <span class="field-label">Avances</span>
                            <p>{{ update.progress }}</p>
                          </div>
                        }
                        @if (update.pending) {
                          <div class="field-block">
                            <span class="field-label">Pendientes</span>
                            <p>{{ update.pending }}</p>
                          </div>
                        }
                      </li>
                    }
                  </ol>
                } @else {
                  <p class="empty">
                    Este accionable todavía no tiene avances. Cargá el primero,
                    o esperá a moverlo de Pendiente en el tablero: ahí el modal
                    se abre solo.
                  </p>
                }
              </section>
            } @empty {
              <section class="card detail">
                <p class="empty">
                  Elegí un accionable de la lista para ver sus avances.
                </p>
              </section>
            }
          </div>
        </div>
      }
    </div>

    @if (modalOpen()) {
      <app-action-progress-modal
        [heading]="modalHeading()"
        [dateLabel]="modalDate()"
        [actionTitle]="selected()?.title || ''"
        [entryMode]="editing()?.entryMode || 'retrospectiva'"
        [entryModeCustom]="editing()?.entryModeCustom || ''"
        [progress]="editing()?.progress || ''"
        [pending]="editing()?.pending || ''"
        [saveLabel]="editing() ? 'Guardar cambios' : 'Guardar avance'"
        [saving]="saving()"
        [error]="modalError()"
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
    .split {
      display: grid;
      grid-template-columns: minmax(0, 18rem) minmax(0, 1fr);
      gap: 0.9rem;
      align-items: start;
    }
    .list {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
      min-width: 0;
    }
    .pick {
      appearance: none;
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 0.5rem;
      width: 100%;
      text-align: left;
      font: inherit;
      color: var(--color-text);
      background: var(--color-bg);
      border: 1.5px solid var(--color-border);
      border-radius: var(--radius-sm);
      padding: 0.6rem 0.65rem;
      cursor: pointer;
      transition: background 0.16s ease, border-color 0.16s ease,
        transform 0.16s ease;
    }
    .pick:hover {
      border-color: color-mix(in srgb, var(--color-brand) 45%, var(--color-border));
    }
    .pick.active {
      background: var(--color-sky-soft);
      border-color: var(--color-brand);
      transform: translateX(2px);
    }
    .pick-main {
      display: flex;
      flex-direction: column;
      gap: 0.3rem;
      min-width: 0;
    }
    .pick-title {
      font-weight: 650;
      font-size: 0.9rem;
    }
    .pick-meta {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.3rem;
      font-size: 0.8rem;
      color: var(--color-text-muted);
    }
    .pick-owner {
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
    }
    .pick-count {
      flex-shrink: 0;
      font-size: 0.72rem;
      font-weight: 700;
      color: var(--color-brand);
      background: var(--color-sky-soft);
      border-radius: 999px;
      padding: 0.15rem 0.5rem;
      white-space: nowrap;
    }
    .pick-count.zero {
      color: var(--color-text-muted);
      background: var(--color-bg-muted);
    }
    .dot {
      width: 0.45rem;
      height: 0.45rem;
      border-radius: 999px;
      background: var(--color-text-muted);
      flex-shrink: 0;
      display: inline-block;
      &.doing { background: var(--color-brand); }
      &.done { background: var(--color-success); }
      &.unmet { background: var(--color-danger); }
    }
    .detail-slot { min-height: 22rem; }
    .detail {
      padding: 1rem 1.1rem 1.1rem;
      display: flex;
      flex-direction: column;
      gap: 0.85rem;
      animation: detail-in 0.22s ease-out;
    }
    @keyframes detail-in {
      from { opacity: 0; transform: translateX(10px); }
      to { opacity: 1; transform: translateX(0); }
    }
    .detail-head {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-start;
      justify-content: space-between;
      gap: 0.6rem;
      padding-bottom: 0.85rem;
      border-bottom: 1px solid var(--color-border);
    }
    .detail-title {
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
      h2 { font-size: 1.05rem; }
    }
    .detail-meta {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.3rem;
      font-size: 0.82rem;
      color: var(--color-text-muted);
    }
    .updates {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 0.9rem;
    }
    .update {
      display: flex;
      flex-direction: column;
      gap: 0.55rem;
      padding-bottom: 0.9rem;
      border-bottom: 1px solid var(--color-border);
      animation: update-in 0.2s ease-out;
      &:last-child {
        padding-bottom: 0;
        border-bottom: none;
      }
    }
    @keyframes update-in {
      from { opacity: 0; transform: translateY(4px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .update-head {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-start;
      justify-content: space-between;
      gap: 0.5rem;
    }
    .update-title {
      margin: 0;
      font-weight: 650;
      font-size: 0.92rem;
    }
    .update-sub {
      margin: 0;
      font-size: 0.78rem;
      color: var(--color-text-muted);
    }
    .update-tools {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.25rem;
    }
    .mode {
      font-size: 0.72rem;
      font-weight: 700;
      color: var(--color-text-muted);
      background: var(--color-bg-muted);
      border: 1px solid var(--color-border);
      border-radius: 999px;
      padding: 0.15rem 0.55rem;
    }
    .btn-ghost.sm {
      padding: 0.3rem 0.55rem;
      font-size: 0.8rem;
    }
    .btn-ghost.danger {
      color: var(--color-danger);
      &:hover:not(:disabled) { background: var(--color-danger-soft); }
    }
    .field-block {
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
      p {
        margin: 0;
        font-size: 0.9rem;
        white-space: pre-wrap;
      }
    }
    .field-label {
      font-size: 0.7rem;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--color-text-muted);
    }
    .empty {
      margin: 0;
      color: var(--color-text-muted);
      font-size: 0.88rem;
    }
    @media (prefers-reduced-motion: reduce) {
      .detail,
      .update { animation: none; }
      .pick { transition: none; }
    }
    @media (max-width: 900px) {
      .split { grid-template-columns: minmax(0, 1fr); }
      .detail-slot { min-height: 0; }
    }
  `,
})
export class ActionProgressPage implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly sockets = inject(SocketService);

  readonly statusLabels = ACTION_STATUS_LABELS;
  readonly statuses = Object.keys(ACTION_STATUS_LABELS) as ActionStatus[];

  teamId = '';
  team = signal<TeamDetail | null>(null);
  items = signal<ActionItem[]>([]);
  retroFilter = signal('');
  statusFilter = signal<StatusFilter>('doing');
  selectedId = signal('');
  updates = signal<ActionProgressUpdate[]>([]);
  loadingUpdates = signal(false);
  error = signal('');
  modalOpen = signal(false);
  editing = signal<ActionProgressUpdate | null>(null);
  saving = signal(false);
  modalError = signal('');

  private teamLoaded = false;
  private itemsLoaded = false;
  private loadedFor = '';
  private socketBound = false;
  private pendingDeepLink: string | null = null;

  private readonly onActionChanged = (payload: unknown) => {
    const teamId = readString(payload, 'teamId');
    if (teamId && teamId !== this.teamId) return;
    this.reloadItems();
  };

  private readonly onProgressChanged = (payload: unknown) => {
    const teamId = readString(payload, 'teamId');
    if (teamId && teamId !== this.teamId) return;
    const actionId = readString(payload, 'actionId');
    this.reloadItems();
    if (actionId && actionId === this.selectedId()) {
      this.loadUpdates(actionId, true);
    }
  };

  ngOnInit() {
    this.teamId = this.route.snapshot.paramMap.get('id')!;
    const queryAction = this.route.snapshot.queryParamMap.get('action');
    const queryRetro = this.route.snapshot.queryParamMap.get('retro');
    const queryStatus = this.route.snapshot.queryParamMap.get('estado');
    if (queryAction) {
      this.selectedId.set(queryAction);
      this.pendingDeepLink = queryAction;
    }
    if (queryStatus && this.isStatusFilter(queryStatus)) {
      this.statusFilter.set(queryStatus);
    }

    this.api.getTeam(this.teamId).subscribe((team) => {
      this.team.set(team);
      this.teamLoaded = true;
      if (queryRetro !== null) this.retroFilter.set(queryRetro);
      else this.retroFilter.set(team.retrospectives[0]?.id ?? '');
      this.resolveSelection();
    });

    this.reloadItems();
    this.attachSocket();
  }

  ngOnDestroy() {
    this.detachSocket();
  }

  reloadItems() {
    this.api.listActions(this.teamId).subscribe((items) => {
      this.items.set(items);
      this.itemsLoaded = true;
      this.resolveSelection();
    });
  }

  hasUnscopedActions() {
    return this.items().some((item) => !item.retroId);
  }

  visibleItems() {
    return this.items().filter(
      (item) => this.matchesRetro(item) && this.matchesStatus(item),
    );
  }

  private matchesRetro(item: ActionItem) {
    const filter = this.retroFilter();
    if (!filter) return true;
    if (filter === '__none__') return !item.retroId;
    return item.retroId === filter;
  }

  private matchesStatus(item: ActionItem) {
    const filter = this.statusFilter();
    return filter === 'all' || item.status === filter;
  }

  selected() {
    return this.visibleItems().find((item) => item.id === this.selectedId());
  }

  /** Un solo elemento, para que el panel se recree (y anime) al cambiar. */
  selectedList() {
    const item = this.selected();
    return item ? [item] : [];
  }

  canMutate(item: ActionItem) {
    return canMutateAction(item, this.auth.user(), this.team());
  }

  dueLabel(iso?: string | null) {
    return formatDueDate(iso);
  }

  countLabel(count: number) {
    return count === 1 ? '1 accionable' : `${count} accionables`;
  }

  emptyListMessage() {
    const status = this.statusFilter();
    if (status === 'all') return 'No hay accionables en esta retro.';
    return `No hay accionables ${STATUS_PLURALS[status]} en esta retro.`;
  }

  subtitle() {
    const name = this.team()?.name ?? '';
    if (!this.itemsLoaded) return name;
    const count = this.countLabel(this.visibleItems().length);
    return name ? `${name} · ${count}` : count;
  }

  shortCountLabel(count: number) {
    if (!count) return 'Sin avances';
    return count === 1 ? '1 avance' : `${count} avances`;
  }

  countUpdatesLabel() {
    return this.shortCountLabel(this.updates().length);
  }

  modeLabel(update: ActionProgressUpdate) {
    if (update.entryMode === 'otro') {
      return update.entryModeCustom || ACTION_ENTRY_MODE_LABELS.otro;
    }
    return ACTION_ENTRY_MODE_LABELS[update.entryMode];
  }

  modalHeading() {
    const editing = this.editing();
    if (editing) return editing.title;
    const next = this.updates().length + 1;
    return `Actualización de avances N°${next}`;
  }

  modalDate() {
    const editing = this.editing();
    return formatDueDate(editing?.createdAt ?? new Date().toISOString());
  }

  changeRetro(value: string) {
    this.retroFilter.set(value);
    this.resolveSelection();
    this.syncQuery();
  }

  changeStatus(value: StatusFilter) {
    this.statusFilter.set(value);
    this.resolveSelection();
    this.syncQuery();
  }

  select(item: ActionItem) {
    if (item.id === this.selectedId()) return;
    this.closeModal();
    this.selectedId.set(item.id);
    this.loadUpdates(item.id);
    this.syncQuery();
  }

  openCreate() {
    this.editing.set(null);
    this.modalError.set('');
    this.saving.set(false);
    this.modalOpen.set(true);
  }

  openEdit(update: ActionProgressUpdate) {
    this.editing.set(update);
    this.modalError.set('');
    this.saving.set(false);
    this.modalOpen.set(true);
  }

  closeModal() {
    this.modalOpen.set(false);
    this.editing.set(null);
    this.saving.set(false);
    this.modalError.set('');
  }

  saveModal(payload: ActionProgressWrite) {
    const actionId = this.selectedId();
    if (!actionId) return;
    const editing = this.editing();
    this.saving.set(true);
    this.modalError.set('');
    const request = editing
      ? this.api.updateActionProgress(editing.id, payload)
      : this.api.createActionProgress(actionId, payload);
    request.subscribe({
      next: () => {
        this.closeModal();
        this.loadUpdates(actionId, true);
        this.reloadItems();
      },
      error: (e) => {
        this.saving.set(false);
        this.modalError.set(
          e?.error?.message || 'No se pudo guardar el avance',
        );
      },
    });
  }

  removeUpdate(update: ActionProgressUpdate) {
    if (
      !confirm(
        `¿Borrar “${update.title}”? Esta acción no se puede deshacer.`,
      )
    ) {
      return;
    }
    this.error.set('');
    this.api.deleteActionProgress(update.id).subscribe({
      next: () => {
        this.loadUpdates(this.selectedId(), true);
        this.reloadItems();
      },
      error: (e) =>
        this.error.set(e?.error?.message || 'No se pudo borrar el avance'),
    });
  }

  private resolveSelection() {
    if (!this.teamLoaded || !this.itemsLoaded) return;
    this.relaxFiltersForDeepLink();
    const visible = this.visibleItems();
    if (!visible.length) {
      this.selectedId.set('');
      this.loadedFor = '';
      this.updates.set([]);
      return;
    }
    const current = visible.find((item) => item.id === this.selectedId());
    const next = current ?? visible[0];
    if (next.id !== this.selectedId()) {
      this.selectedId.set(next.id);
      this.syncQuery();
    }
    if (this.loadedFor !== next.id) this.loadUpdates(next.id);
  }

  /**
   * El tablero linkea un accionable puntual y el filtro de estado por defecto
   * puede esconderlo: si pasa, se abre el filtro a todos los estados.
   */
  private relaxFiltersForDeepLink() {
    const actionId = this.pendingDeepLink;
    if (!actionId) return;
    this.pendingDeepLink = null;
    const target = this.items().find((item) => item.id === actionId);
    if (!target) return;
    if (!this.matchesStatus(target)) {
      this.statusFilter.set('all');
      this.syncQuery();
    }
  }

  private isStatusFilter(value: string): value is StatusFilter {
    return value === 'all' || this.statuses.includes(value as ActionStatus);
  }

  private loadUpdates(actionId: string, force = false) {
    if (!actionId) {
      this.updates.set([]);
      this.loadedFor = '';
      return;
    }
    if (!force && this.loadedFor === actionId) return;
    this.loadedFor = actionId;
    this.loadingUpdates.set(true);
    this.api.listActionProgress(actionId).subscribe({
      next: (list) => {
        if (this.loadedFor !== actionId) return;
        this.updates.set(list.slice().reverse());
        this.loadingUpdates.set(false);
      },
      error: (e) => {
        this.loadingUpdates.set(false);
        this.error.set(
          e?.error?.message || 'No se pudieron cargar los avances',
        );
      },
    });
  }

  private syncQuery() {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        action: this.selectedId() || null,
        retro: this.retroFilter() || null,
        estado: this.statusFilter(),
      },
      replaceUrl: true,
    });
  }

  private attachSocket() {
    if (this.socketBound || !this.teamId) return;
    this.sockets.joinTeam(this.teamId);
    this.sockets.on('action-created', this.onActionChanged);
    this.sockets.on('action-updated', this.onActionChanged);
    this.sockets.on('action-deleted', this.onActionChanged);
    this.sockets.on('action-progress-created', this.onProgressChanged);
    this.sockets.on('action-progress-updated', this.onProgressChanged);
    this.sockets.on('action-progress-deleted', this.onProgressChanged);
    this.socketBound = true;
  }

  private detachSocket() {
    if (!this.socketBound) return;
    this.sockets.off('action-created', this.onActionChanged);
    this.sockets.off('action-updated', this.onActionChanged);
    this.sockets.off('action-deleted', this.onActionChanged);
    this.sockets.off('action-progress-created', this.onProgressChanged);
    this.sockets.off('action-progress-updated', this.onProgressChanged);
    this.sockets.off('action-progress-deleted', this.onProgressChanged);
    this.sockets.leaveTeam(this.teamId);
    this.socketBound = false;
  }
}

function readString(payload: unknown, key: string): string {
  if (!payload || typeof payload !== 'object') return '';
  const value = (payload as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : '';
}
