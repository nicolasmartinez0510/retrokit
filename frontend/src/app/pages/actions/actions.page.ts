import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { ActionItem, ActionStatus, TeamDetail } from '../../core/models';

@Component({
  selector: 'app-actions-page',
  imports: [FormsModule, RouterLink],
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
      </form>

      <div class="kanban">
        @for (col of columns; track col.key) {
          <section class="card col">
            <h2>{{ col.label }}</h2>
            @for (item of byStatus(col.key); track item.id) {
              <article class="item">
                <strong>{{ item.title }}</strong>
                @if (item.owner) {
                  <span class="badge">{{ item.owner.name }}</span>
                }
                <div class="moves">
                  @for (s of columns; track s.key) {
                    @if (s.key !== item.status) {
                      <button
                        type="button"
                        class="btn-ghost btn-sm"
                        (click)="move(item, s.key)"
                      >
                        → {{ s.label }}
                      </button>
                    }
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
  `,
  styles: `
    .panel { padding: 1rem; margin-bottom: 1rem; }
    .row { display: flex; gap: 0.5rem;
      input { flex: 1; border: 1px solid var(--color-border); border-radius: 8px; padding: 0.55rem; }
    }
    .kanban {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 0.85rem;
    }
    .col {
      padding: 0.85rem;
      background: var(--color-sky-soft);
      min-height: 240px;
      h2 { font-size: 1rem; margin-bottom: 0.75rem; }
    }
    .item {
      background: white;
      border-radius: 8px;
      padding: 0.7rem;
      margin-bottom: 0.5rem;
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }
    .moves { display: flex; flex-wrap: wrap; gap: 0.25rem; }
    .empty { color: var(--color-text-muted); font-size: 0.85rem; }
    @media (max-width: 800px) {
      .kanban { grid-template-columns: 1fr; }
    }
  `,
})
export class ActionsPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);

  teamId = '';
  team = signal<TeamDetail | null>(null);
  items = signal<ActionItem[]>([]);
  title = '';

  columns: { key: ActionStatus; label: string }[] = [
    { key: 'pending', label: 'Pendiente' },
    { key: 'doing', label: 'En curso' },
    { key: 'done', label: 'Hecho' },
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

  create() {
    this.api.createAction(this.teamId, { title: this.title }).subscribe({
      next: () => {
        this.title = '';
        this.reload();
      },
    });
  }

  move(item: ActionItem, status: ActionStatus) {
    this.api.updateAction(this.teamId, item.id, { status }).subscribe({
      next: () => this.reload(),
    });
  }
}
