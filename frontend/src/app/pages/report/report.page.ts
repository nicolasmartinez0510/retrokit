import { DecimalPipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { formatDueDate } from '../../core/dates';
import {
  ACTION_STATUS_LABELS,
  ActionItem,
  RetroReport,
  SemaforoItem,
  SemaforoValue,
} from '../../core/models';
import {
  normalizeSemaforoEmojis,
  SEMAFORO_VALUE_LABELS,
  type SemaforoValueKey,
} from '../../core/phase-rules';
import { UserAvatarComponent } from '../../shared/user-avatar.component';

@Component({
  selector: 'app-report-page',
  imports: [RouterLink, DecimalPipe, UserAvatarComponent],
  template: `
    <div class="page report">
      @if (report(); as r) {
        <div class="page-header no-print">
          <div>
            <h1>Reporte: {{ r.title }}</h1>
            <p class="subtitle">
              {{ r.team?.name }}
              <span class="sep">·</span>
              {{ retroPhaseLabel(r) }}
            </p>
          </div>
          <div class="actions">
            <button type="button" class="btn-primary" (click)="print()">Imprimir / PDF</button>
            <a class="btn-secondary" [routerLink]="['/retros', r.id]">Volver</a>
          </div>
        </div>

        <section class="card block">
          <h2>ROTI</h2>
          <p>
            Promedio:
            <strong>{{ r.rotiAverage != null ? (r.rotiAverage | number: '1.1-1') : '—' }}</strong>
            ({{ r.rotiResponses.length }} respuestas)
          </p>
        </section>

        <section class="card block">
          <h2>Comentarios y votos</h2>
          @for (col of r.columns; track col.id) {
            <h3>
              @if (col.logoUrl) {
                <img class="col-logo-sm" [src]="col.logoUrl" alt="" />
              }
              {{ col.icon }} {{ col.title }}
            </h3>
            <ul>
              @for (card of cardsIn(col.id); track card.id) {
                <li>
                  @if (card.content) {
                    <span>{{ card.content }}</span>
                  }
                  @if (card.imageUrl) {
                    <img class="report-thumb" [src]="card.imageUrl" alt="" />
                  }
                  <span class="badge">{{ votesFor(card.id, card.groupId) }} votos</span>
                </li>
              }
            </ul>
          }
        </section>

        @if (r.semaforoItems?.length) {
          <section class="card block">
            <h2>Semáforo</h2>
            <table class="semaforo-table">
              <thead>
                <tr>
                  <th>Ítem</th>
                  @for (key of semaforoKeys; track key) {
                    <th>
                      {{ semaforoEmojis(r)[key] }}
                      {{ semaforoLabels[key] }}
                    </th>
                  }
                </tr>
              </thead>
              <tbody>
                @for (item of r.semaforoItems; track item.id) {
                  <tr>
                    <td>
                      <strong>{{ item.title }}</strong>
                      @if (item.description) {
                        <div class="item-desc">{{ item.description }}</div>
                      }
                    </td>
                    <td>{{ semaforoCount(item, 'red') }}</td>
                    <td>{{ semaforoCount(item, 'yellow') }}</td>
                    <td>{{ semaforoCount(item, 'green') }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </section>
        }

        <section class="card block">
          <h2>Acciones</h2>
          <ul>
            @for (a of r.actionItems; track a.id) {
              <li>
                {{ a.title }}
                @if (a.description) {
                  — {{ a.description }}
                }
                @if (a.owner) {
                  —
                  <app-user-avatar
                    [avatarId]="a.owner.avatarId"
                    [ownerId]="a.owner.id"
                    [seed]="a.owner.id"
                    [name]="a.owner.name"
                    size="sm"
                  />
                  {{ a.owner.name }}
                }
                @if (dueLabel(a.dueDate)) {
                  <span class="badge">{{ dueLabel(a.dueDate) }}</span>
                }
                @if (originLabel(a); as origin) {
                  <span class="badge">{{ origin }}</span>
                }
                <span class="badge">{{ statusLabel(a.status) }}</span>
              </li>
            } @empty {
              <li>Sin acciones</li>
            }
          </ul>
        </section>
      }
    </div>
  `,
  styles: `
    .block { padding: 1.25rem; margin-bottom: 1rem;
      h2 { margin-bottom: 0.75rem; font-size: 1.15rem; }
      h3 { margin: 0.85rem 0 0.4rem; font-size: 1rem; color: var(--color-brand); }
      ul { margin: 0; padding-left: 1.1rem; }
      li { margin-bottom: 0.35rem; white-space: pre-wrap; display: flex; flex-wrap: wrap; align-items: center; gap: 0.3rem; }
    }
    .subtitle .sep {
      opacity: 0.55;
      margin: 0 0.2rem;
    }
    .semaforo-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.9rem;
      th, td {
        text-align: left;
        padding: 0.45rem 0.55rem;
        border-bottom: 1px solid var(--color-border);
        vertical-align: top;
      }
      th {
        font-size: 0.78rem;
        text-transform: uppercase;
        letter-spacing: 0.03em;
        color: var(--color-text-muted);
      }
      th:nth-child(2),
      th:nth-child(3),
      th:nth-child(4),
      td:nth-child(2),
      td:nth-child(3),
      td:nth-child(4) {
        text-align: center;
        width: 4.5rem;
      }
    }
    .item-desc {
      margin-top: 0.15rem;
      font-size: 0.8rem;
      color: var(--color-text-muted);
    }
    .report-thumb {
      display: block;
      max-width: 160px;
      max-height: 100px;
      margin: 0.35rem 0;
      object-fit: contain;
      border-radius: 4px;
    }
    .col-logo-sm {
      width: 22px;
      height: 22px;
      object-fit: contain;
      vertical-align: middle;
      margin-right: 0.3rem;
    }
    .actions { display: flex; gap: 0.5rem; }
    @media print {
      .no-print { display: none !important; }
      .page { max-width: none; }
      .card { box-shadow: none; border: 1px solid var(--color-border); }
    }
  `,
})
export class ReportPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  report = signal<RetroReport | null>(null);
  readonly semaforoKeys: SemaforoValueKey[] = ['red', 'yellow', 'green'];
  readonly semaforoLabels = SEMAFORO_VALUE_LABELS;

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.api.getReport(id).subscribe((r) => this.report.set(r));
  }

  semaforoEmojis(r: RetroReport): Record<SemaforoValueKey, string> {
    const phase =
      r.phases?.find((p) => p.kind === 'semaforo') ??
      r.phases?.find((p) => p.kind === 'semaforo_review');
    const [red, yellow, green] = normalizeSemaforoEmojis(phase?.semaforoEmojis);
    return { red, yellow, green };
  }

  retroPhaseLabel(r: RetroReport) {
    if (r.closed || r.closedAt) return 'Cerrada';
    return r.currentPhase?.name || '—';
  }

  cardsIn(columnId: string) {
    return this.report()?.cards.filter((c) => c.columnId === columnId) ?? [];
  }

  votesFor(cardId: string, groupId?: string | null) {
    const r = this.report();
    if (!r) return 0;
    return r.votes
      .filter((v) => (groupId ? v.groupId === groupId : v.cardId === cardId))
      .reduce((s, v) => s + v.count, 0);
  }

  semaforoCount(item: SemaforoItem, value: SemaforoValue) {
    if (item.summary) return item.summary[value];
    if (item.votes?.length) {
      return item.votes.filter((v) => v.value === value).length;
    }
    const report = this.report();
    return (
      report?.semaforoVotes?.filter(
        (v) => v.itemId === item.id && v.value === value,
      ).length ?? 0
    );
  }

  statusLabel(status: keyof typeof ACTION_STATUS_LABELS) {
    return ACTION_STATUS_LABELS[status];
  }

  dueLabel(iso?: string | null) {
    return formatDueDate(iso);
  }

  originLabel(action: ActionItem) {
    if (action.group?.cards?.length) {
      return (
        action.group.title?.trim() ||
        action.group.cards.find((c) => c.content.trim())?.content ||
        'Grupo'
      );
    }
    if (action.card?.content?.trim()) return action.card.content;
    if (action.card) return 'Comentario';
    return null;
  }

  print() {
    window.print();
  }
}
