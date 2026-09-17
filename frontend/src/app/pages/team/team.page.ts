import {
  Component,
  HostListener,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { parseAvatarChanged } from '../../core/avatars';
import { httpErrorMessage } from '../../core/http-error';
import { Phase, RetroSummary, TeamDetail, Template } from '../../core/models';
import {
  DEFAULT_CLASSIC_PHASE_IDS,
  DEFAULT_SEMAFORO_ITEMS,
} from '../../core/phase-rules';
import { SocketService } from '../../core/socket.service';
import { ToastService } from '../../core/toast.service';
import {
  PhasePillItem,
  PhasePillsComponent,
} from '../../shared/phase-pills.component';
import { UserAvatarComponent } from '../../shared/user-avatar.component';

const MAX_SEMAFORO_ITEMS = 8;

@Component({
  selector: 'app-team-page',
  imports: [FormsModule, RouterLink, UserAvatarComponent, PhasePillsComponent],
  template: `
    <div class="page">
      @if (team(); as t) {
        <div class="page-header">
          <div>
            <h1>Retrospectivas</h1>
            <p class="subtitle">Historial del equipo activo</p>
          </div>
          <div class="header-actions">
            @if (isFacilitator()) {
              <button
                type="button"
                class="btn-primary"
                (click)="openCreateModal()"
              >
                <svg class="plus-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M12 4.5a.75.75 0 0 1 .75.75v6.75h6.75a.75.75 0 0 1 0 1.5h-6.75v6.75a.75.75 0 0 1-1.5 0v-6.75H4.5a.75.75 0 0 1 0-1.5h6.75V5.25A.75.75 0 0 1 12 4.5Z"
                  />
                </svg>
                Nueva retrospectiva
              </button>
            }
          </div>
        </div>

        @if (error() && !showCreateModal()) {
          <p class="form-error">{{ error() }}</p>
        }

        <section class="section">
          <div class="retro-list">
            @for (r of t.retrospectives; track r.id) {
              <div class="card retro-row">
                @if (renamingId() === r.id) {
                  <form class="rename-form" (ngSubmit)="saveRename(r)">
                    <input
                      [(ngModel)]="renameTitle"
                      name="renameTitle"
                      required
                      autofocus
                    />
                    <button type="submit" class="btn-primary btn-sm">Guardar</button>
                    <button
                      type="button"
                      class="btn-ghost btn-sm"
                      (click)="cancelRename()"
                    >
                      Cancelar
                    </button>
                  </form>
                } @else {
                  <a
                    [routerLink]="['/retros', r.id]"
                    [state]="{ returnTo: '/teams/' + t.id }"
                  >
                    <div class="retro-heading">
                      <strong>{{ r.title }}</strong>
                    </div>
                    <p class="retro-meta">
                      @if (r.template?.name) {
                        <span>{{ r.template!.name }}</span>
                        <span class="sep">·</span>
                      }
                      <span
                        >{{ r._count?.cards ?? 0 }}
                        {{ (r._count?.cards ?? 0) === 1 ? 'tarjeta' : 'tarjetas' }}</span
                      >
                      <span class="sep">·</span>
                      <span>{{ formatCreated(r.createdAt) }}</span>
                    </p>
                    @if (r.participants?.length) {
                      <div class="avatar-stack">
                        @for (p of visibleParticipants(r); track p.id) {
                          <app-user-avatar
                            [avatarId]="p.avatarId"
                            [ownerId]="p.ownerId"
                            [seed]="p.id"
                            [name]="p.name"
                            size="sm"
                          />
                        }
                        @if (hiddenParticipantCount(r); as extra) {
                          <span
                            class="avatar-more"
                            [title]="hiddenParticipantNames(r)"
                          >
                            +{{ extra }}
                          </span>
                        }
                      </div>
                    }
                  </a>
                  <div class="retro-actions">
                    <span class="badge">{{ retroPhaseLabel(r) }}</span>
                    @if (isFacilitator()) {
                      <button
                        type="button"
                        class="icon-btn edit"
                        title="Editar nombre"
                        aria-label="Editar nombre"
                        (click)="startRename(r)"
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
                        aria-label="Borrar retrospectiva"
                        (click)="deleteRetro(r.id, r.title)"
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path
                            d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
                          />
                        </svg>
                      </button>
                    }
                  </div>
                }
              </div>
            } @empty {
              <p class="empty-state">Todavía no hay retrospectivas.</p>
            }
          </div>
        </section>
      }
    </div>

    @if (showCreateModal()) {
      <div
        class="modal-backdrop"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-retro-title"
        (click)="closeCreateModal()"
      >
        <div class="card create-modal" (click)="$event.stopPropagation()">
          <h2 id="create-retro-title">Nueva retrospectiva</h2>
          <form class="create-form" (ngSubmit)="createRetro()">
            <div class="field">
              <label>Título</label>
              <input [(ngModel)]="title" name="title" required />
            </div>
            <div class="field">
              <label>Plantilla</label>
              <select
                [ngModel]="templateId"
                (ngModelChange)="onTemplateChange($event)"
                name="templateId"
                required
              >
                @for (tpl of templates(); track tpl.id) {
                  <option [value]="tpl.id">{{ tpl.name }}</option>
                }
              </select>
              @if (selectedTemplate(); as tpl) {
                @if (tpl.description) {
                  <p class="template-hint">{{ tpl.description }}</p>
                }
                <button
                  type="button"
                  class="disclosure"
                  [attr.aria-expanded]="showTemplateCols()"
                  (click)="showTemplateCols.set(!showTemplateCols())"
                >
                  <svg
                    class="disclosure-chevron"
                    [class.open]="showTemplateCols()"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                  <span>{{ tpl.columns.length }} columnas</span>
                </button>
                @if (showTemplateCols()) {
                  <ul class="template-cols">
                    @for (col of tpl.columns; track col.id) {
                      <li>
                        @if (col.logoUrl) {
                          <img class="col-logo-sm" [src]="col.logoUrl" alt="" />
                        }
                        <strong>{{ col.icon }} {{ col.title }}</strong>
                        @if (col.description) {
                          — {{ col.description }}
                        }
                      </li>
                    }
                  </ul>
                }
              }
            </div>
            <div class="field phases-field">
              <div class="phases-header">
                <label>Fases</label>
                <button
                  type="button"
                  class="btn-ghost btn-sm"
                  (click)="restorePhasesFromTemplate()"
                >
                  Restaurar de plantilla
                </button>
              </div>
              <app-phase-pills
                mode="edit"
                [phases]="pillPhases()"
                [showAdd]="availablePhases().length > 0"
                (phasesChange)="onPhasesChange($event)"
                (remove)="onPhaseRemoved($event)"
                (addPhase)="showAddPhases.set(!showAddPhases())"
              />
              @if (showAddPhases() && availablePhases().length) {
                <div class="add-phase-chips">
                  <span class="add-phase-label">Agregar fase:</span>
                  @for (p of availablePhases(); track p.id) {
                    <button
                      type="button"
                      class="add-phase-chip"
                      (click)="addRetroPhase(p)"
                    >
                      + {{ p.name }}
                    </button>
                  }
                </div>
              }
              @if (needsSemaforo()) {
                <div class="semaforo-section">
                  <div class="columns-header">
                    <button
                      type="button"
                      class="disclosure"
                      [attr.aria-expanded]="showSemaforoItems()"
                      (click)="showSemaforoItems.set(!showSemaforoItems())"
                    >
                      <svg
                        class="disclosure-chevron"
                        [class.open]="showSemaforoItems()"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                      </svg>
                      <span
                        >Ítems del semáforo ({{
                          retroSemaforoItems().length
                        }})</span
                      >
                    </button>
                    @if (showSemaforoItems()) {
                      <button
                        type="button"
                        class="btn-secondary btn-sm"
                        (click)="addSemaforoItem()"
                        [disabled]="retroSemaforoItems().length >= maxSemaforoItems"
                      >
                        <svg class="plus-icon" viewBox="0 0 24 24" aria-hidden="true">
                          <path
                            d="M12 4.5a.75.75 0 0 1 .75.75v6.75h6.75a.75.75 0 0 1 0 1.5h-6.75v6.75a.75.75 0 0 1-1.5 0v-6.75H4.5a.75.75 0 0 1 0-1.5h6.75V5.25A.75.75 0 0 1 12 4.5Z"
                          />
                        </svg>
                        Agregar ítem
                      </button>
                    }
                  </div>
                @if (showSemaforoItems()) {
                  <div class="semaforo-editor">
                    @for (
                      item of retroSemaforoItems();
                      track $index;
                      let i = $index
                    ) {
                      <div class="semaforo-row">
                        <div class="semaforo-head">
                          <span class="semaforo-head-spacer" aria-hidden="true"></span>
                          <span class="semaforo-head-label">Título</span>
                          <span class="semaforo-head-label grow">Pregunta</span>
                          <span class="semaforo-head-spacer" aria-hidden="true"></span>
                        </div>
                        <div class="semaforo-controls">
                          <span class="semaforo-badge" aria-hidden="true">🚦</span>
                          <input
                            [(ngModel)]="item.title"
                            [name]="'sem-title-' + i"
                            placeholder="Ej. Comunicación"
                            maxlength="120"
                            required
                            aria-label="Título"
                          />
                          <input
                            class="grow"
                            [(ngModel)]="item.description"
                            [name]="'sem-desc-' + i"
                            placeholder="¿Qué querés que califiquen?"
                            maxlength="500"
                            aria-label="Pregunta"
                          />
                          <button
                            type="button"
                            class="icon-btn trash"
                            title="Quitar ítem"
                            aria-label="Quitar ítem"
                            (click)="removeSemaforoItem(i)"
                            [disabled]="retroSemaforoItems().length <= 1"
                          >
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                              <path
                                d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
                              />
                            </svg>
                          </button>
                        </div>
                      </div>
                    }
                  </div>
                }
                </div>
              }
            </div>

            <button
              type="button"
              class="disclosure options-disclosure"
              [attr.aria-expanded]="showAdvancedOptions()"
              (click)="showAdvancedOptions.set(!showAdvancedOptions())"
            >
              <svg
                class="disclosure-chevron"
                [class.open]="showAdvancedOptions()"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
              <span>Opciones</span>
            </button>
            @if (showAdvancedOptions()) {
            <div class="settings-grid">
              <div class="field">
                <label>Máx. comentarios / persona</label>
                <input
                  type="number"
                  [(ngModel)]="maxComments"
                  name="maxComments"
                  min="1"
                />
              </div>
              <div class="field">
                <label>Votos por persona</label>
                <input
                  type="number"
                  [(ngModel)]="votesPerParticipant"
                  name="votes"
                  min="1"
                />
              </div>
              <div class="field">
                <label>Máx. votos por tarjeta</label>
                <input
                  type="number"
                  [(ngModel)]="maxVotesPerCard"
                  name="maxVotes"
                  min="1"
                  [disabled]="hasSingleVotePhase()"
                />
                @if (hasSingleVotePhase()) {
                  <p class="template-hint">
                    Hay una fase con voto único: máx. 1 voto por tarjeta.
                  </p>
                }
              </div>
              <div class="field">
                <label>Timer por defecto</label>
                <select [(ngModel)]="timerSeconds" name="timerSeconds">
                  <option [ngValue]="300">5 min</option>
                  <option [ngValue]="600">10 min</option>
                  <option [ngValue]="900">15 min</option>
                </select>
              </div>
            </div>
            <label class="check">
              <input type="checkbox" [(ngModel)]="allowAnonymous" name="anon" />
              Permitir comentarios anónimos
            </label>
            <label class="check">
              <input
                type="checkbox"
                [(ngModel)]="allowCrossColumnGrouping"
                name="crossCol"
              />
              Permitir agrupar tarjetas entre columnas
            </label>
            <p class="template-hint">
              Las columnas son temas distintos; activá esto solo si el equipo
              quiere mezclarlas.
            </p>
            }

            @if (error()) {
              <p class="form-error">{{ error() }}</p>
            }
            <div class="modal-actions">
              <button
                type="button"
                class="btn-ghost"
                (click)="closeCreateModal()"
              >
                Cancelar
              </button>
              <button class="btn-primary" type="submit">Crear retrospectiva</button>
            </div>
          </form>
        </div>
      </div>
    }
  `,
  styles: `
    .header-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.65rem;
      align-items: center;
    }
    .plus-icon {
      width: 1.05em;
      height: 1.05em;
      display: block;
      flex-shrink: 0;
      fill: currentColor;
    }
    .create-form { display: flex; flex-direction: column; gap: 0.85rem; margin-top: 0.85rem; }
    .settings-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 0.75rem;
    }
    .check { display: flex; align-items: center; gap: 0.5rem; font-size: 0.9rem; }
    .template-hint {
      margin-top: 0.35rem;
      font-size: 0.85rem;
      color: var(--color-text-muted);
    }
    .template-cols {
      margin: 0.5rem 0 0;
      padding-left: 1.1rem;
      font-size: 0.8rem;
      color: var(--color-text-muted);
      li { margin-bottom: 0.25rem; }
      strong { color: var(--color-text); }
    }
    .col-logo-sm {
      width: 18px;
      height: 18px;
      object-fit: contain;
      vertical-align: middle;
      margin-right: 0.25rem;
    }
    .section { margin-bottom: 1.5rem; }
    .retro-list { display: flex; flex-direction: column; gap: 0.6rem; }
    .retro-row {
      padding: 0.75rem 0.9rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 0.6rem;
      a {
        display: flex;
        flex-direction: column;
        align-items: stretch;
        gap: 0.35rem;
        flex: 1;
        text-decoration: none;
        color: inherit;
        min-width: 0;
        &:hover { text-decoration: none; }
      }
    }
    .retro-heading {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      min-width: 0;
      strong {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }
    .retro-meta {
      margin: 0;
      font-size: 0.82rem;
      color: var(--color-text-muted);
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.25rem;
    }
    .retro-meta .sep {
      opacity: 0.55;
    }
    .retro-actions {
      display: flex;
      align-items: center;
      gap: 0.35rem;
      flex-shrink: 0;
    }
    .retro-actions .badge {
      line-height: 1.85rem;
      height: 1.85rem;
      display: inline-flex;
      align-items: center;
    }
    .rename-form {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem;
      width: 100%;
    }
    .rename-form input {
      flex: 1;
      min-width: 10rem;
      font: inherit;
      padding: 0.45rem 0.6rem;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
      background: var(--color-bg);
    }
    .avatar-stack {
      display: flex;
      align-items: center;
      app-user-avatar {
        position: relative;
        box-shadow: 0 0 0 2px var(--color-bg);
        margin-left: -0.45rem;
        &:first-child { margin-left: 0; }
        &:hover { z-index: 2; }
      }
    }
    .avatar-more {
      margin-left: 0.35rem;
      font-size: 0.75rem;
      font-weight: 700;
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
      color: var(--color-brand);
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
      &.edit:hover {
        background: var(--color-sky-soft);
      }
      &.trash {
        color: var(--color-danger);
      }
      &.trash:hover {
        background: var(--color-danger-soft);
      }
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
    .create-modal {
      width: min(720px, 100%);
      max-height: min(90vh, 900px);
      overflow: auto;
      padding: 1.35rem 1.4rem 1.25rem;
    }
    .create-modal h2 {
      margin: 0;
      font-size: 1.15rem;
    }
    .modal-actions {
      display: flex;
      justify-content: flex-end;
      flex-wrap: wrap;
      gap: 0.65rem;
    }
    .phases-field {
      display: flex;
      flex-direction: column;
      gap: 0.55rem;
    }
    .phases-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      label { margin: 0; }
    }
    .add-phase-chips {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.4rem;
    }
    .add-phase-label {
      font-size: 0.82rem;
      color: var(--color-text-muted);
    }
    .add-phase-chip {
      appearance: none;
      border: 1px dashed var(--color-border);
      background: transparent;
      color: var(--color-brand);
      border-radius: 999px;
      padding: 0.25rem 0.65rem;
      font: inherit;
      font-size: 0.8rem;
      cursor: pointer;
      &:hover {
        background: var(--color-sky-soft);
        border-color: var(--color-brand);
      }
    }
    .semaforo-section {
      display: flex;
      flex-direction: column;
      gap: 0.55rem;
    }
    .columns-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 0.5rem;
      flex-wrap: wrap;
    }
    .columns-header .btn-secondary.btn-sm {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
    }
    .plus-icon {
      width: 1rem;
      height: 1rem;
      display: block;
      fill: currentColor;
    }
    .disclosure {
      appearance: none;
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
      width: 100%;
      margin: 0;
      padding: 0.55rem 0.75rem;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
      background: var(--color-sky-soft);
      font: inherit;
      font-size: 0.88rem;
      font-weight: 650;
      color: var(--color-text);
      cursor: pointer;
      text-align: left;
      transition:
        background 0.15s ease,
        border-color 0.15s ease;
      &:hover {
        background: color-mix(in srgb, var(--color-sky-soft) 70%, var(--color-bg));
        border-color: var(--color-brand);
      }
      &[aria-expanded='true'] {
        border-color: color-mix(in srgb, var(--color-brand) 45%, var(--color-border));
      }
    }
    .columns-header .disclosure {
      width: auto;
      flex: 1 1 auto;
      min-width: 0;
    }
    .disclosure-chevron {
      width: 1rem;
      height: 1rem;
      flex-shrink: 0;
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
      color: var(--color-brand);
      transition: transform 0.15s ease;
      &.open {
        transform: rotate(90deg);
      }
    }
    .options-disclosure {
      margin-top: 0.15rem;
    }
    .semaforo-editor {
      display: flex;
      flex-direction: column;
      gap: 0.55rem;
      align-items: stretch;
    }
    .semaforo-row {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      padding: 0.75rem 0.85rem;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
      background: var(--color-bg-muted, var(--color-sky-soft));
    }
    .semaforo-head,
    .semaforo-controls {
      display: grid;
      grid-template-columns: 2rem minmax(0, 1fr) minmax(0, 1.5fr) 2rem;
      gap: 0.65rem;
      align-items: center;
    }
    .semaforo-head-spacer {
      width: 2rem;
    }
    .semaforo-head-label {
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.03em;
      text-transform: uppercase;
      color: var(--color-text-muted);
    }
    .semaforo-badge {
      display: grid;
      place-items: center;
      width: 2rem;
      height: 2rem;
      border-radius: 0.5rem;
      background: var(--color-bg);
      border: 1px solid var(--color-border);
      font-size: 0.95rem;
      line-height: 1;
    }
    .semaforo-controls input {
      width: 100%;
      min-width: 0;
      box-sizing: border-box;
      border: 1.5px solid var(--color-border);
      border-radius: var(--radius-sm);
      padding: 0.6rem 0.75rem;
      background: var(--color-bg);
      color: var(--color-text);
      outline: none;
      font-size: 0.9rem;
      font-weight: 500;
      transition: border-color 0.15s ease;
      &:focus {
        border-color: var(--color-brand);
      }
    }
    .semaforo-controls .icon-btn {
      width: 2rem;
      height: 2rem;
    }
    @media (max-width: 560px) {
      .semaforo-head,
      .semaforo-controls {
        grid-template-columns: 1fr 2rem;
      }
      .semaforo-head-spacer:first-child,
      .semaforo-badge {
        display: none;
      }
      .semaforo-head-label:not(.grow) {
        grid-column: 1;
      }
      .semaforo-head-label.grow {
        grid-column: 1;
        grid-row: 2;
      }
      .semaforo-head-spacer:last-child {
        grid-column: 2;
        grid-row: 1 / 3;
      }
      .semaforo-controls input:first-of-type {
        grid-column: 1;
      }
      .semaforo-controls input.grow {
        grid-column: 1;
        grid-row: 2;
      }
      .semaforo-controls .icon-btn {
        grid-column: 2;
        grid-row: 1 / 3;
        align-self: center;
      }
    }
  `,
})
export class TeamPage implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly sockets = inject(SocketService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  team = signal<TeamDetail | null>(null);
  templates = signal<Template[]>([]);
  phaseCatalog = signal<Phase[]>([]);
  retroPhases = signal<{ phaseId: string; phase: Phase }[]>([]);
  retroSemaforoItems = signal<{ title: string; description: string }[]>([]);
  showAddPhases = signal(false);
  showSemaforoItems = signal(false);
  showTemplateCols = signal(false);
  showAdvancedOptions = signal(false);
  readonly maxSemaforoItems = MAX_SEMAFORO_ITEMS;
  title = '';
  templateId = '';
  maxComments: number | null = 3;
  votesPerParticipant = 5;
  maxVotesPerCard = 2;
  timerSeconds = 300;
  allowAnonymous = true;
  allowCrossColumnGrouping = false;
  error = signal('');
  showCreateModal = signal(false);
  renamingId = signal<string | null>(null);
  renameTitle = '';

  private readonly maxVisibleParticipants = 6;

  readonly pillPhases = computed<PhasePillItem[]>(() =>
    this.retroPhases().map((p) => ({
      id: p.phaseId,
      name: p.phase.name,
      icon: p.phase.icon,
      color: p.phase.color,
    })),
  );

  readonly availablePhases = computed(() => {
    const used = new Set(this.retroPhases().map((p) => p.phaseId));
    return this.phaseCatalog().filter((p) => !used.has(p.id));
  });

  readonly needsSemaforo = computed(() =>
    this.retroPhases().some(
      (p) => p.phase.kind === 'semaforo' || p.phase.kind === 'semaforo_review',
    ),
  );

  readonly hasSingleVotePhase = computed(() =>
    this.retroPhases().some((p) => p.phase.voting === 'single'),
  );

  retroPhaseLabel(r: RetroSummary) {
    if (r.closed || r.closedAt) return 'Cerrada';
    return r.currentPhaseName || r.currentPhase?.name || '—';
  }

  formatCreated(iso: string) {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('es-AR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }

  selectedTemplate() {
    return this.templates().find((t) => t.id === this.templateId) ?? null;
  }

  onTemplateChange(id: string) {
    this.templateId = id;
    this.applyDefaults(this.selectedTemplate());
  }

  applyDefaults(tpl: Template | null) {
    if (!tpl) return;
    this.maxComments = tpl.maxCommentsPerParticipant ?? null;
    this.votesPerParticipant = tpl.votesPerParticipant ?? 5;
    this.maxVotesPerCard = tpl.maxVotesPerCard ?? 2;
    this.seedPhasesFromTemplate(tpl);
    this.seedSemaforoFromTemplate(tpl);
    this.syncMaxVotesFromPhases();
    this.showAddPhases.set(false);
  }

  restorePhasesFromTemplate() {
    const tpl = this.selectedTemplate();
    if (!tpl) return;
    this.seedPhasesFromTemplate(tpl);
    this.seedSemaforoFromTemplate(tpl);
    this.syncMaxVotesFromPhases();
    this.showAddPhases.set(false);
  }

  private seedPhasesFromTemplate(tpl: Template) {
    if (tpl.phases?.length) {
      this.retroPhases.set(
        tpl.phases.map((link) => ({
          phaseId: link.phaseId,
          phase: link.phase,
        })),
      );
      return;
    }
    const catalog = this.phaseCatalog();
    const seeded: { phaseId: string; phase: Phase }[] = [];
    for (const id of DEFAULT_CLASSIC_PHASE_IDS) {
      const phase = catalog.find((p) => p.id === id);
      if (phase) seeded.push({ phaseId: id, phase });
    }
    this.retroPhases.set(seeded);
  }

  private seedSemaforoFromTemplate(tpl: Template) {
    const needs =
      this.retroPhases().some(
        (p) => p.phase.kind === 'semaforo' || p.phase.kind === 'semaforo_review',
      ) ||
      (tpl.phases ?? []).some(
        (p) =>
          p.phase?.kind === 'semaforo' || p.phase?.kind === 'semaforo_review',
      );
    if (tpl.semaforoItems?.length) {
      this.retroSemaforoItems.set(
        tpl.semaforoItems.map((item) => ({
          title: item.title,
          description: item.description || '',
        })),
      );
      this.showSemaforoItems.set(false);
      return;
    }
    if (needs) {
      this.retroSemaforoItems.set(
        DEFAULT_SEMAFORO_ITEMS.map((item) => ({
          title: item.title,
          description: item.description,
        })),
      );
      this.showSemaforoItems.set(false);
      return;
    }
    this.retroSemaforoItems.set([]);
    this.showSemaforoItems.set(false);
  }

  private syncMaxVotesFromPhases() {
    if (this.hasSingleVotePhase()) {
      this.maxVotesPerCard = 1;
    }
  }

  onPhasesChange(items: PhasePillItem[]) {
    const byId = new Map(this.retroPhases().map((p) => [p.phaseId, p]));
    this.retroPhases.set(
      items
        .map((item) => byId.get(item.id))
        .filter((p): p is { phaseId: string; phase: Phase } => !!p),
    );
    this.ensureSemaforoItems();
    this.syncMaxVotesFromPhases();
  }

  onPhaseRemoved(id: string) {
    this.retroPhases.set(this.retroPhases().filter((p) => p.phaseId !== id));
    this.ensureSemaforoItems();
    this.syncMaxVotesFromPhases();
  }

  addRetroPhase(phase: Phase) {
    if (this.retroPhases().some((p) => p.phaseId === phase.id)) return;
    this.retroPhases.set([
      ...this.retroPhases(),
      { phaseId: phase.id, phase },
    ]);
    this.ensureSemaforoItems();
    this.syncMaxVotesFromPhases();
    if (!this.availablePhases().length) this.showAddPhases.set(false);
  }

  private ensureSemaforoItems() {
    if (!this.needsSemaforo()) {
      this.showSemaforoItems.set(false);
      return;
    }
    if (!this.retroSemaforoItems().length) {
      this.retroSemaforoItems.set(
        DEFAULT_SEMAFORO_ITEMS.map((item) => ({
          title: item.title,
          description: item.description,
        })),
      );
    }
  }

  addSemaforoItem() {
    if (this.retroSemaforoItems().length >= MAX_SEMAFORO_ITEMS) return;
    this.retroSemaforoItems.set([
      ...this.retroSemaforoItems(),
      { title: '', description: '' },
    ]);
    this.showSemaforoItems.set(true);
  }

  removeSemaforoItem(index: number) {
    if (this.retroSemaforoItems().length <= 1) return;
    this.retroSemaforoItems.set(
      this.retroSemaforoItems().filter((_, i) => i !== index),
    );
  }

  isFacilitator() {
    if (this.auth.user()?.isAdmin) return true;
    const userId = this.auth.user()?.id;
    if (!userId) return false;
    return this.team()?.members.some(
      (m) => m.user.id === userId && m.role === 'facilitator',
    );
  }

  visibleParticipants(retro: RetroSummary) {
    return (retro.participants ?? []).slice(0, this.maxVisibleParticipants);
  }

  hiddenParticipantCount(retro: RetroSummary) {
    const extra = (retro.participants?.length ?? 0) - this.maxVisibleParticipants;
    return extra > 0 ? extra : 0;
  }

  hiddenParticipantNames(retro: RetroSummary) {
    return (retro.participants ?? [])
      .slice(this.maxVisibleParticipants)
      .map((p) => p.name)
      .join(', ');
  }

  startRename(r: RetroSummary) {
    this.renamingId.set(r.id);
    this.renameTitle = r.title;
  }

  cancelRename() {
    this.renamingId.set(null);
    this.renameTitle = '';
  }

  saveRename(r: RetroSummary) {
    const title = this.renameTitle.trim();
    if (!title || title === r.title) {
      this.cancelRename();
      return;
    }
    this.api.renameRetro(r.id, title).subscribe({
      next: () => {
        const current = this.team();
        if (!current) return;
        this.team.set({
          ...current,
          retrospectives: current.retrospectives.map((item) =>
            item.id === r.id ? { ...item, title } : item,
          ),
        });
        this.cancelRename();
      },
      error: (e) =>
        this.toast.error(httpErrorMessage(e, 'No se pudo renombrar')),
    });
  }

  openCreateModal() {
    this.error.set('');
    this.allowCrossColumnGrouping = false;
    this.showCreateModal.set(true);
  }

  closeCreateModal() {
    this.showCreateModal.set(false);
    this.showSemaforoItems.set(false);
    this.showAdvancedOptions.set(false);
    this.showTemplateCols.set(false);
    this.showAddPhases.set(false);
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    if (this.renamingId()) {
      this.cancelRename();
      return;
    }
    if (this.showCreateModal()) this.closeCreateModal();
  }

  deleteRetro(id: string, title: string) {
    if (
      !confirm(
        `¿Borrar la retrospectiva “${title}”? Esta acción no se puede deshacer.`,
      )
    ) {
      return;
    }
    this.api.deleteRetro(id).subscribe({
      next: () => {
        const current = this.team();
        if (!current) return;
        this.team.set({
          ...current,
          retrospectives: current.retrospectives.filter((r) => r.id !== id),
        });
      },
      error: (e) =>
        this.error.set(e?.error?.message || 'No se pudo borrar la retrospectiva'),
    });
  }

  ngOnInit() {
    this.route.paramMap.subscribe(() => this.reloadTeam());
    this.sockets.connect();
    this.sockets.on('avatar-changed', this.onAvatarChanged);
    this.api.listTemplates().subscribe((t) => {
      this.templates.set(t);
      if (t[0]) {
        this.templateId = t[0].id;
        this.applyDefaults(t[0]);
      }
    });
    this.api.listPhases().subscribe((phases) => {
      this.phaseCatalog.set(phases);
      const tpl = this.selectedTemplate();
      if (tpl && !this.retroPhases().length) {
        this.seedPhasesFromTemplate(tpl);
        this.seedSemaforoFromTemplate(tpl);
        this.syncMaxVotesFromPhases();
      }
    });
  }

  ngOnDestroy() {
    this.sockets.off('avatar-changed', this.onAvatarChanged);
  }

  private readonly onAvatarChanged = (payload: unknown) => {
    const event = parseAvatarChanged(payload);
    const team = this.team();
    if (!event || !team) return;
    const retrospectives = team.retrospectives.map((r) => ({
      ...r,
      participants: (r.participants ?? []).map((p) =>
        p.ownerId === event.userId ? { ...p, avatarId: event.avatarId } : p,
      ),
    }));
    if (retrospectives.every((r, i) => r === team.retrospectives[i])) {
      return;
    }
    this.team.set({ ...team, retrospectives });
  };

  reloadTeam() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;
    this.api.getTeam(id).subscribe((t) => this.team.set(t));
  }

  createRetro() {
    const team = this.team();
    if (!team) return;
    if (!this.retroPhases().length) {
      this.error.set('Elegí al menos una fase');
      return;
    }
    if (this.needsSemaforo()) {
      const items = this.retroSemaforoItems();
      if (!items.length || items.some((i) => !i.title.trim())) {
        this.error.set('Completá los ítems del semáforo');
        this.showSemaforoItems.set(true);
        return;
      }
    }
    const maxVotes = this.hasSingleVotePhase() ? 1 : this.maxVotesPerCard;
    this.api
      .createRetro({
        teamId: team.id,
        templateId: this.templateId,
        title: this.title,
        maxCommentsPerParticipant: this.maxComments,
        votesPerParticipant: this.votesPerParticipant,
        maxVotesPerCard: maxVotes,
        allowAnonymous: this.allowAnonymous,
        allowCrossColumnGrouping: this.allowCrossColumnGrouping,
        timerSeconds: this.timerSeconds,
        phases: this.retroPhases().map((p, position) => ({
          phaseId: p.phaseId,
          position,
        })),
        ...(this.needsSemaforo()
          ? {
              semaforoItems: this.retroSemaforoItems().map((item) => ({
                title: item.title.trim(),
                description: item.description.trim() || null,
              })),
            }
          : {}),
      })
      .subscribe({
        next: (retro) => {
          this.closeCreateModal();
          void this.router.navigate(['/retros', retro.id], {
            state: { returnTo: `/teams/${team.id}` },
          });
        },
        error: (e) => this.error.set(e?.error?.message || 'Error al crear'),
      });
  }
}
