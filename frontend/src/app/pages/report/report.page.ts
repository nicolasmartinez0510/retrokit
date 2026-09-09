import { DecimalPipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { ACTION_STATUS_LABELS, RetroReport } from '../../core/models';

@Component({
  selector: 'app-report-page',
  imports: [RouterLink, DecimalPipe],
  template: `
    <div class="page report">
      @if (report(); as r) {
        <div class="page-header no-print">
          <div>
            <h1>Reporte: {{ r.title }}</h1>
            <p class="subtitle">{{ r.team?.name }}</p>
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
            <h3>{{ col.icon }} {{ col.title }}</h3>
            <ul>
              @for (card of cardsIn(col.id); track card.id) {
                <li>
                  {{ card.content }}
                  <span class="badge">{{ votesFor(card.id, card.groupId) }} votos</span>
                </li>
              }
            </ul>
          }
        </section>

        <section class="card block">
          <h2>Acciones</h2>
          <ul>
            @for (a of r.actionItems; track a.id) {
              <li>
                {{ a.title }}
                @if (a.owner) {
                  — {{ a.owner.name }}
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
      li { margin-bottom: 0.35rem; }
    }
    .actions { display: flex; gap: 0.5rem; }
    @media print {
      .no-print { display: none !important; }
      .page { max-width: none; }
      .card { box-shadow: none; border: 1px solid #ccc; }
    }
  `,
})
export class ReportPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  report = signal<RetroReport | null>(null);

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.api.getReport(id).subscribe((r) => this.report.set(r));
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

  statusLabel(status: keyof typeof ACTION_STATUS_LABELS) {
    return ACTION_STATUS_LABELS[status];
  }

  print() {
    window.print();
  }
}
