import { Component, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { httpErrorMessage } from '../../core/http-error';
import { PHASE_KIND_LABELS, Phase } from '../../core/models';
import { phaseCapabilities } from '../../core/phase-rules';
import { ToastService } from '../../core/toast.service';

/** Short human summary of what a phase lets people do. */
export function phaseSummaryChips(p: Phase): string[] {
  const caps = phaseCapabilities(p);
  const chips: string[] = [];

  if (!caps.isBoard) {
    if (p.kind === 'action_plan') {
      chips.push('accionables');
      if (caps.allowPresentation) chips.push('presentación');
    }
    if (p.kind === 'roti') chips.push('puntaje 1–5', 'comentario');
    if (p.kind === 'semaforo') {
      const e = caps.semaforoEmojis;
      chips.push(`${e[0]} · ${e[1]} · ${e[2]}`, 'listo');
    }
    if (p.kind === 'semaforo_review') {
      const e = caps.semaforoEmojis;
      chips.push(`${e[0]}${e[1]}${e[2]}`, 'resumen', 'accionables');
    }
    return chips;
  }

  if (caps.allowCreateCards) {
    chips.push(
      caps.cardContent === 'image_only'
        ? 'sólo imágenes'
        : caps.cardContent === 'text_only'
          ? 'escribir (sólo texto)'
          : 'escribir',
    );
    if (caps.maxCardsPerParticipant != null) {
      chips.push(`máx. ${caps.maxCardsPerParticipant} / persona`);
    }
  } else {
    chips.push('sólo lectura');
  }
  if (caps.othersVisibility === 'blurred') chips.push('borrosas');
  if (caps.othersVisibility === 'hidden') chips.push('oculta a otros');
  if (caps.revealOnReady) chips.push('revela al marcar listo');
  if (caps.anonymousCards) chips.push('anónimas');
  if (caps.allowGrouping) {
    chips.push(caps.allowCrossColumnGrouping ? 'agrupar entre columnas' : 'agrupar');
  }
  if (caps.voting === 'single') chips.push('un voto');
  if (caps.voting === 'multi') chips.push('votación múltiple');
  if (caps.allowReactions) {
    chips.push(`reacciones ${caps.reactionEmojis.slice(0, 5).join('')}`);
  }
  if (caps.voting === 'off' && !caps.allowReactions && !caps.allowCreateCards) {
    chips.push('sin votos');
  }
  if (caps.hideVoteCounts) chips.push('conteo oculto');
  if (caps.allowPresentation) chips.push('presentación');
  if (caps.allowActionItems) chips.push('accionables');
  if (caps.showReadyCheck && !caps.revealOnReady) chips.push('listo');
  if (caps.defaultSort === 'most_voted') chips.push('orden: más votadas');
  if (caps.defaultSort === 'least_voted') chips.push('orden: menos votadas');
  if (caps.defaultSort === 'random') chips.push('orden: azar');
  return chips;
}

@Component({
  selector: 'app-phases-page',
  imports: [RouterLink],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1>Fases</h1>
          <p class="subtitle">
            Las fases del sistema no se editan: duplicalas para personalizarlas.
          </p>
        </div>
        @if (canCreate()) {
          <a
            class="btn-primary"
            routerLink="/phases/new"
            [state]="{ returnTo: '/phases' }"
          >
            <svg class="plus-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M12 4.5a.75.75 0 0 1 .75.75v6.75h6.75a.75.75 0 0 1 0 1.5h-6.75v6.75a.75.75 0 0 1-1.5 0v-6.75H4.5a.75.75 0 0 1 0-1.5h6.75V5.25A.75.75 0 0 1 12 4.5Z"
              />
            </svg>
            Nueva fase
          </a>
        }
      </div>

      @for (group of groups(); track group.key) {
        @if (group.items.length) {
          <section class="section">
            <h2 class="section-title">{{ group.label }}</h2>
            <div class="phase-list">
              @for (p of group.items; track p.id) {
                <div
                  class="card phase-card"
                  [class.busy]="busyId() === p.id"
                  [style.--pill-color]="p.color || null"
                >
                  <div class="phase-icon" aria-hidden="true">
                    {{ p.icon || '•' }}
                  </div>
                  <div class="phase-main">
                    <div class="title-row">
                      <h2>{{ p.name }}</h2>
                      @if (p.isSystem) {
                        <span class="badge">Sistema</span>
                      } @else if (p.isGlobal) {
                        <span class="badge">Global</span>
                      } @else if (isAdmin() && p.createdBy) {
                        <span class="badge muted">{{ p.createdBy.name }}</span>
                      } @else {
                        <span class="badge muted">Personal</span>
                      }
                      <span class="badge kind">{{ kindLabel(p) }}</span>
                    </div>
                    @if (p.description) {
                      <p class="desc">{{ p.description }}</p>
                    }
                    <div class="chips">
                      @for (chip of chipsFor(p); track $index) {
                        <span class="chip">{{ chip }}</span>
                      }
                    </div>
                    <p class="meta">
                      @if (p.templateCount) {
                        Usada en {{ p.templateCount }}
                        {{ p.templateCount === 1 ? 'plantilla' : 'plantillas' }}
                      } @else {
                        Sin uso en plantillas
                      }
                    </p>
                  </div>
                  <div class="phase-actions">
                    @if (canCreate()) {
                      <button
                        type="button"
                        class="btn-secondary btn-sm"
                        [disabled]="busyId() === p.id"
                        (click)="duplicate(p)"
                      >
                        Duplicar
                      </button>
                    }
                    @if (canEdit(p)) {
                      <a
                        class="icon-btn edit"
                        [routerLink]="['/phases', p.id]"
                        [state]="{ returnTo: '/phases' }"
                        title="Editar"
                        aria-label="Editar fase"
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path
                            d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10"
                          />
                        </svg>
                      </a>
                    } @else {
                      <a
                        class="btn-ghost btn-sm"
                        [routerLink]="['/phases', p.id]"
                        [state]="{ returnTo: '/phases' }"
                      >
                        Ver
                      </a>
                    }
                    @if (canDelete(p)) {
                      <button
                        type="button"
                        class="icon-btn trash"
                        title="Eliminar fase"
                        aria-label="Eliminar fase"
                        [disabled]="busyId() === p.id"
                        (click)="askRemove(p)"
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path
                            d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
                          />
                        </svg>
                      </button>
                    }
                  </div>
                </div>
              }
            </div>
          </section>
        }
      }

      @if (loaded() && !phases().length) {
        <div class="empty-state card">
          <strong>No hay fases</strong>
          @if (canCreate()) {
            Creá la primera para usarla en tus plantillas.
          } @else {
            Pedile a un facilitator o admin que cree fases personalizadas.
          }
        </div>
      }

      @if (pendingDelete(); as del) {
        <div
          class="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-phase-title"
          (click)="cancelRemove()"
        >
          <div class="card delete-modal" (click)="$event.stopPropagation()">
            <h2 id="delete-phase-title">Eliminar “{{ del.phase.name }}”</h2>
            <p class="delete-lead">
              Las retrospectivas ya creadas no se modifican: conservan su
              snapshot de la fase.
            </p>
            @if (del.loading) {
              <p class="delete-muted">Buscando plantillas…</p>
            } @else if (del.templates.length) {
              <p>
                Al borrarla se va a quitar del listado de fases de
                {{ del.templates.length }}
                {{
                  del.templates.length === 1 ? 'plantilla' : 'plantillas'
                }}:
              </p>
              <ul class="template-usage">
                @for (t of del.templates; track t.id) {
                  <li>{{ t.name }}</li>
                }
              </ul>
            } @else {
              <p class="delete-muted">
                No está en ninguna plantilla ahora mismo.
              </p>
            }
            <div class="modal-actions">
              <button
                type="button"
                class="btn-ghost"
                [disabled]="busyId() === del.phase.id"
                (click)="cancelRemove()"
              >
                Cancelar
              </button>
              <button
                type="button"
                class="btn-danger"
                [disabled]="del.loading || busyId() === del.phase.id"
                (click)="confirmRemove()"
              >
                {{
                  busyId() === del.phase.id ? 'Eliminando…' : 'Eliminar fase'
                }}
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: `
    .section {
      margin-bottom: 1.5rem;
    }
    .section-title {
      font-size: 0.85rem;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--color-text-muted);
      margin: 0 0 0.65rem;
    }
    .phase-list {
      display: flex;
      flex-direction: column;
      gap: 0.85rem;
    }
    .phase-card {
      padding: 1rem 1.15rem;
      display: flex;
      gap: 0.9rem;
      align-items: flex-start;
      border-left: 4px solid var(--pill-color, var(--color-border));
      &.busy {
        opacity: 0.6;
        pointer-events: none;
      }
    }
    .phase-icon {
      width: 2.5rem;
      height: 2.5rem;
      flex-shrink: 0;
      display: grid;
      place-items: center;
      font-size: 1.35rem;
      border-radius: 10px;
      background: color-mix(
        in srgb,
        var(--pill-color, var(--color-brand)) 14%,
        var(--color-bg)
      );
    }
    .phase-main {
      flex: 1;
      min-width: 0;
    }
    .title-row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-wrap: wrap;
      margin-bottom: 0.3rem;
      h2 {
        font-size: 1.05rem;
        margin: 0;
      }
    }
    .badge {
      font-size: 0.7rem;
      font-weight: 700;
      letter-spacing: 0.03em;
      text-transform: uppercase;
      padding: 0.15rem 0.45rem;
      border-radius: 999px;
      background: var(--color-sky-soft);
      color: var(--color-brand);
    }
    .badge.muted {
      background: var(--color-bg-muted);
      color: var(--color-text-muted);
    }
    .badge.kind {
      background: transparent;
      border: 1px solid var(--color-border);
      color: var(--color-text-muted);
    }
    .desc {
      color: var(--color-text-muted);
      font-size: 0.9rem;
      margin: 0 0 0.45rem;
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 0.3rem;
      margin-bottom: 0.45rem;
    }
    .chip {
      font-size: 0.75rem;
      padding: 0.15rem 0.5rem;
      border-radius: 999px;
      background: var(--color-bg-muted);
      color: var(--color-text);
      border: 1px solid var(--color-border);
    }
    .meta {
      font-size: 0.78rem;
      color: var(--color-text-muted);
      margin: 0;
    }
    .phase-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.35rem;
      flex-shrink: 0;
      justify-content: flex-end;
      align-items: center;
    }
    .icon-btn {
      width: 2rem;
      height: 2rem;
      padding: 0;
      border: none;
      border-radius: var(--radius-sm);
      background: transparent;
      cursor: pointer;
      display: grid;
      place-items: center;
      flex-shrink: 0;
      svg {
        width: 1.15rem;
        height: 1.15rem;
        display: block;
        fill: none;
        stroke: currentColor;
        stroke-width: 1.5;
        stroke-linecap: round;
        stroke-linejoin: round;
      }
      &.trash {
        color: var(--color-danger);
      }
      &.trash:hover:not(:disabled) {
        background: var(--color-danger-soft);
      }
      &.edit {
        color: var(--color-text-muted);
        text-decoration: none;
      }
      &.edit:hover {
        background: var(--color-sky-soft);
        color: var(--color-brand);
      }
      &:disabled {
        opacity: 0.45;
        cursor: not-allowed;
      }
    }
    .plus-icon {
      width: 1.05em;
      height: 1.05em;
      display: block;
      flex-shrink: 0;
      fill: currentColor;
    }
    .modal-backdrop {
      position: fixed;
      inset: 0;
      z-index: 60;
      display: grid;
      place-items: center;
      padding: 1.25rem;
      background: var(--color-overlay);
      backdrop-filter: blur(4px);
    }
    .delete-modal {
      width: min(440px, 100%);
      padding: 1.35rem 1.4rem 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      h2 {
        margin: 0;
        font-size: 1.1rem;
      }
      p {
        margin: 0;
        font-size: 0.92rem;
        color: var(--color-text);
        line-height: 1.45;
      }
    }
    .delete-lead {
      color: var(--color-text-muted) !important;
    }
    .delete-muted {
      color: var(--color-text-muted) !important;
    }
    .template-usage {
      margin: 0;
      padding: 0.55rem 0.75rem 0.55rem 1.4rem;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
      background: var(--color-bg-muted);
      max-height: 12rem;
      overflow: auto;
      li {
        font-size: 0.9rem;
        padding: 0.2rem 0;
      }
    }
    .modal-actions {
      display: flex;
      justify-content: flex-end;
      flex-wrap: wrap;
      gap: 0.55rem;
      margin-top: 0.35rem;
    }
    @media (max-width: 640px) {
      .phase-card {
        flex-wrap: wrap;
      }
      .phase-actions {
        width: 100%;
        justify-content: flex-start;
      }
    }
  `,
})
export class PhasesPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  readonly phases = signal<Phase[]>([]);
  readonly loaded = signal(false);
  readonly busyId = signal<string | null>(null);
  readonly pendingDelete = signal<{
    phase: Phase;
    templates: { id: string; name: string }[];
    loading: boolean;
  } | null>(null);
  private readonly canCreateFlag = signal(false);

  readonly groups = computed(() => {
    const all = this.phases();
    return [
      { key: 'system', label: 'Sistema', items: all.filter((p) => p.isSystem) },
      {
        key: 'global',
        label: 'Globales',
        items: all.filter((p) => !p.isSystem && p.isGlobal),
      },
      {
        key: 'personal',
        label: this.isAdmin() ? 'Personales' : 'Mis fases',
        items: all.filter((p) => !p.isSystem && !p.isGlobal),
      },
    ];
  });

  isAdmin() {
    return !!this.auth.user()?.isAdmin;
  }

  canCreate() {
    return this.isAdmin() || this.canCreateFlag();
  }

  canEdit(p: Phase) {
    if (p.isSystem) return false;
    if (this.isAdmin()) return true;
    return p.createdById === this.auth.user()?.id;
  }

  canDelete(p: Phase) {
    // Admin can delete any phase, including system presets.
    if (this.isAdmin()) return true;
    // Facilitators only delete custom phases they created.
    if (p.isSystem) return false;
    return p.createdById === this.auth.user()?.id;
  }

  kindLabel(p: Phase) {
    return PHASE_KIND_LABELS[p.kind] ?? p.kind;
  }

  chipsFor(p: Phase) {
    return phaseSummaryChips(p);
  }

  ngOnInit() {
    this.auth.ensureFacilitator().subscribe((ok) => this.canCreateFlag.set(ok));
    this.reload();
  }

  reload() {
    this.api.listPhases().subscribe({
      next: (list) => {
        this.phases.set(list);
        this.loaded.set(true);
      },
      error: (e) => {
        this.loaded.set(true);
        this.toast.error(httpErrorMessage(e, 'No se pudieron cargar las fases'));
      },
    });
  }

  duplicate(p: Phase) {
    this.busyId.set(p.id);
    this.api.duplicatePhase(p.id).subscribe({
      next: (copy) => {
        this.busyId.set(null);
        this.toast.ok('Fase duplicada');
        void this.router.navigate(['/phases', copy.id]);
      },
      error: (e) => {
        this.busyId.set(null);
        this.toast.error(httpErrorMessage(e, 'No se pudo duplicar la fase'));
      },
    });
  }

  askRemove(p: Phase) {
    if (!this.canDelete(p)) return;
    this.pendingDelete.set({ phase: p, templates: [], loading: true });
    this.api.getPhase(p.id).subscribe({
      next: (detail) => {
        const current = this.pendingDelete();
        if (!current || current.phase.id !== p.id) return;
        this.pendingDelete.set({
          phase: p,
          templates: detail.usedIn ?? [],
          loading: false,
        });
      },
      error: () => {
        const current = this.pendingDelete();
        if (!current || current.phase.id !== p.id) return;
        // Fall back to count-only message if detail fetch fails.
        this.pendingDelete.set({
          phase: p,
          templates: [],
          loading: false,
        });
      },
    });
  }

  cancelRemove() {
    if (this.busyId()) return;
    this.pendingDelete.set(null);
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    if (this.pendingDelete()) this.cancelRemove();
  }

  confirmRemove() {
    const del = this.pendingDelete();
    if (!del || del.loading) return;
    const p = del.phase;
    this.busyId.set(p.id);
    this.api.deletePhase(p.id, true).subscribe({
      next: () => {
        this.pendingDelete.set(null);
        this.onRemoved(p);
      },
      error: (e) => {
        this.busyId.set(null);
        this.toast.error(httpErrorMessage(e, 'No se pudo eliminar la fase'));
      },
    });
  }

  private onRemoved(p: Phase) {
    this.busyId.set(null);
    this.phases.set(this.phases().filter((x) => x.id !== p.id));
    this.toast.ok('Fase eliminada');
  }
}
