import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { ActionItem, ActionStatus, TeamDetail } from '../../core/models';
import { UserAvatarComponent } from '../../shared/user-avatar.component';

@Component({
  selector: 'app-actions-page',
  imports: [FormsModule, RouterLink, UserAvatarComponent],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1>Tablero de acciones</h1>
          <p class="subtitle">{{ team()?.name }}</p>
        </div>
        <a class="btn-secondary" [routerLink]="['/teams', teamId]">Volver al equipo</a>
      </div>

      <form class="card panel" (ngSubmit)="create()">
        <div class="row">
          <input [(ngModel)]="title" name="title" placeholder="Nueva acción" required />
          <button class="btn-primary" type="submit">Agregar</button>
        </div>
        @if (error()) {
          <p class="form-error">{{ error() }}</p>
        }
      </form>

      <div class="kanban">
        @for (col of columns; track col.key) {
          <section class="card col" [class.done]="col.key === 'done'" [class.unmet]="col.key === 'unmet'">
            <h2>{{ col.label }}</h2>
            @for (item of byStatus(col.key); track item.id) {
              <article class="item">
                <div class="item-head">
                  <strong>{{ item.title }}</strong>
                  @if (isFacilitator()) {
                    <button
                      type="button"
                      class="icon-btn trash"
                      title="Borrar"
                      aria-label="Borrar acción"
                      (click)="remove(item)"
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path
                          d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
                        />
                      </svg>
                    </button>
                  }
                </div>
                @if (item.owner) {
                  <span class="badge">
                    <app-user-avatar
                      [avatarId]="item.owner.avatarId"
                      [seed]="item.owner.id"
                      [name]="item.owner.name"
                      size="sm"
                    />
                    {{ item.owner.name }}
                  </span>
                }
                <div class="outcome">
                  @if (item.status !== 'done') {
                    <button
                      type="button"
                      class="icon-btn ok"
                      title="Cumplido"
                      aria-label="Marcar como cumplido"
                      (click)="move(item, 'done')"
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    </button>
                  }
                  @if (item.status !== 'unmet') {
                    <button
                      type="button"
                      class="icon-btn no"
                      title="No cumplido"
                      aria-label="Marcar como no cumplido"
                      (click)="move(item, 'unmet')"
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M6 18 18 6M6 6l12 12" />
                      </svg>
                    </button>
                  }
                  @if (item.status === 'done' || item.status === 'unmet') {
                    <button
                      type="button"
                      class="icon-btn reopen"
                      title="Reabrir"
                      aria-label="Reabrir acción"
                      (click)="move(item, 'pending')"
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" />
                      </svg>
                    </button>
                  }
                </div>
                @if (item.status === 'pending' || item.status === 'doing') {
                  <div class="moves">
                    @if (item.status !== 'doing') {
                      <button
                        type="button"
                        class="btn-ghost btn-sm"
                        (click)="move(item, 'doing')"
                      >
                        En curso
                      </button>
                    }
                    @if (item.status !== 'pending') {
                      <button
                        type="button"
                        class="btn-ghost btn-sm"
                        (click)="move(item, 'pending')"
                      >
                        Pendiente
                      </button>
                    }
                  </div>
                }
              </article>
            } @empty {
              <p class="empty">Vacío</p>
            }
          </section>
        }
      </div>
    </div>
  `,
  styles: `
    .panel { padding: 1rem; margin-bottom: 1rem; }
    .row { display: flex; gap: 0.5rem;
      input { flex: 1; border: 1px solid var(--color-border); border-radius: 8px; padding: 0.55rem; }
    }
    .kanban {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 0.85rem;
    }
    .col {
      padding: 0.85rem;
      background: var(--color-sky-soft);
      min-height: 240px;
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
      }
      &.ok {
        color: var(--color-success);
        border-color: color-mix(in srgb, var(--color-success) 45%, transparent);
        &:hover { background: color-mix(in srgb, var(--color-success) 16%, transparent); }
      }
      &.no {
        color: var(--color-danger);
        border-color: color-mix(in srgb, var(--color-danger) 45%, transparent);
        &:hover { background: var(--color-danger-soft); }
      }
      &.reopen:hover {
        color: var(--color-text);
      }
      &.trash {
        color: var(--color-danger);
        &:hover { background: var(--color-danger-soft); }
      }
    }
    .outcome, .moves { display: flex; flex-wrap: wrap; gap: 0.25rem; }
    .empty { color: var(--color-text-muted); font-size: 0.85rem; }
    @media (max-width: 1100px) {
      .kanban { grid-template-columns: repeat(2, 1fr); }
    }
    @media (max-width: 700px) {
      .kanban { grid-template-columns: 1fr; }
    }
  `,
})
export class ActionsPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);

  teamId = '';
  team = signal<TeamDetail | null>(null);
  items = signal<ActionItem[]>([]);
  title = '';
  error = signal('');

  columns: { key: ActionStatus; label: string }[] = [
    { key: 'pending', label: 'Pendiente' },
    { key: 'doing', label: 'En curso' },
    { key: 'done', label: 'Cumplido' },
    { key: 'unmet', label: 'No cumplido' },
  ];

  ngOnInit() {
    this.teamId = this.route.snapshot.paramMap.get('id')!;
    this.api.getTeam(this.teamId).subscribe((t) => this.team.set(t));
    this.reload();
  }

  reload() {
    this.api.listActions(this.teamId).subscribe((items) => this.items.set(items));
  }

  byStatus(status: ActionStatus) {
    return this.items().filter((i) => i.status === status);
  }

  isFacilitator() {
    const userId = this.auth.user()?.id;
    if (!userId) return false;
    return (
      this.team()?.members.some(
        (m) => m.user.id === userId && m.role === 'facilitator',
      ) ?? false
    );
  }

  remove(item: ActionItem) {
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

  create() {
    this.error.set('');
    this.api.createAction(this.teamId, { title: this.title }).subscribe({
      next: () => {
        this.title = '';
        this.reload();
      },
      error: (e) =>
        this.error.set(e?.error?.message || 'No se pudo crear la acción'),
    });
  }

  move(item: ActionItem, status: ActionStatus) {
    this.error.set('');
    this.api.updateAction(this.teamId, item.id, { status }).subscribe({
      next: () => this.reload(),
      error: (e) =>
        this.error.set(e?.error?.message || 'No se pudo actualizar la acción'),
    });
  }
}
