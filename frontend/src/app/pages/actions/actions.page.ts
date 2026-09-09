// This file is part of Retrokit.
//
// Copyright (C) 2026 Nicolas Martinez
//
// Retrokit is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// Retrokit is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with Retrokit.  If not, see <https://www.gnu.org/licenses/>.

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
                <strong>{{ item.title }}</strong>
                @if (item.owner) {
                  <span class="badge">{{ item.owner.name }}</span>
                }
                <div class="outcome">
                  @if (item.status !== 'done') {
                    <button
                      type="button"
                      class="btn-primary btn-sm"
                      (click)="move(item, 'done')"
                    >
                      Cumplido
                    </button>
                  }
                  @if (item.status !== 'unmet') {
                    <button
                      type="button"
                      class="btn-secondary btn-sm"
                      (click)="move(item, 'unmet')"
                    >
                      No cumplido
                    </button>
                  }
                  @if (item.status === 'done' || item.status === 'unmet') {
                    <button
                      type="button"
                      class="btn-ghost btn-sm"
                      (click)="move(item, 'pending')"
                    >
                      Reabrir
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
      &.done { background: #e8f4fc; }
      &.unmet { background: #eef2f5; }
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
