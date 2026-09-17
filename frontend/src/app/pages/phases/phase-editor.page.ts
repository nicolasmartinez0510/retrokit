import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { httpErrorMessage } from '../../core/http-error';
import { PHASE_KIND_LABELS, Phase } from '../../core/models';
import {
  CardContentMode,
  CardSort,
  OthersVisibility,
  PhaseCapabilitiesInput,
  PhaseKind,
  VotingMode,
  normalizePhase,
  normalizeSemaforoEmojis,
  phaseCapabilities,
  SEMAFORO_VALUE_LABELS,
  SEMAFORO_VALUE_ORDER,
} from '../../core/phase-rules';
import { ToastService } from '../../core/toast.service';
import { EmojiPickerComponent } from '../../shared/emoji-picker.component';
import {
  PhasePillItem,
  PhasePillsComponent,
} from '../../shared/phase-pills.component';

interface PhaseForm extends PhaseCapabilitiesInput {
  name: string;
  description: string;
  icon: string;
  color: string;
  instructions: string;
  timerSeconds: number | null;
  isGlobal: boolean;
}

const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const MAX_REACTION_EMOJIS = 12;

const KIND_ORDER: PhaseKind[] = [
  'board',
  'action_plan',
  'roti',
  'semaforo',
  'semaforo_review',
];

const KIND_NOTES: Record<Exclude<PhaseKind, 'board'>, string> = {
  action_plan:
    'Se muestran las tarjetas más votadas y el facilitador crea accionables.',
  roti: 'Cada participante puntúa la retro de 1 a 5 y deja un comentario opcional.',
  semaforo:
    'Cada participante marca rojo, amarillo o verde en los ítems del semáforo definidos en la plantilla.',
  semaforo_review:
    'Se muestra el resumen del semáforo por ítem y se pueden crear accionables.',
};

const CARD_CONTENT_OPTIONS: { value: CardContentMode; label: string }[] = [
  { value: 'text_and_image', label: 'Texto e imagen' },
  { value: 'image_only', label: 'Sólo imagen' },
  { value: 'text_only', label: 'Sólo texto' },
];
const VISIBILITY_OPTIONS: { value: OthersVisibility; label: string }[] = [
  { value: 'visible', label: 'Visibles' },
  { value: 'blurred', label: 'Borrosas' },
  { value: 'hidden', label: 'Ocultas' },
];
const VOTING_OPTIONS: { value: VotingMode; label: string }[] = [
  { value: 'off', label: 'Sin votos' },
  { value: 'single', label: 'Un voto (like)' },
  { value: 'multi', label: 'Múltiple (−/+)' },
];
const SORT_OPTIONS: { value: CardSort; label: string; needsVotes: boolean }[] = [
  { value: 'original', label: 'Original', needsVotes: false },
  { value: 'most_voted', label: 'Más votadas', needsVotes: true },
  { value: 'least_voted', label: 'Menos votadas', needsVotes: true },
  { value: 'random', label: 'Azar', needsVotes: false },
];
const TIMER_OPTIONS: { value: number | null; label: string }[] = [
  { value: null, label: 'Sin timer' },
  { value: 60, label: '1 min' },
  { value: 120, label: '2 min' },
  { value: 180, label: '3 min' },
  { value: 300, label: '5 min' },
  { value: 600, label: '10 min' },
  { value: 900, label: '15 min' },
  { value: 1200, label: '20 min' },
  { value: 1800, label: '30 min' },
];
const ICON_SUGGESTIONS = ['💬', '🗂', '🗳', '✅', '📊', '🚦', '🔍', '🔥', '💡', '🎯', '😀', '⭐'];

function emptyForm(): PhaseForm {
  return {
    name: '',
    description: '',
    kind: 'board',
    icon: '',
    color: '',
    instructions: '',
    timerSeconds: null,
    isGlobal: false,
    allowCreateCards: true,
    cardContent: 'text_and_image',
    maxCardsPerParticipant: null,
    allowEditOwnCards: true,
    anonymousCards: false,
    othersVisibility: 'visible',
    revealOnReady: false,
    allowGrouping: false,
    allowCrossColumnGrouping: false,
    voting: 'off',
    hideVoteCounts: false,
    allowReactions: false,
    reactionEmojis: ['👍', '❤️', '🎉', '😮', '😕'],
    semaforoEmojis: ['🔴', '🟡', '🟢'],
    allowPresentation: false,
    allowActionItems: false,
    showReadyCheck: true,
    defaultSort: 'original',
  };
}

@Component({
  selector: 'app-phase-editor-page',
  imports: [
    NgTemplateOutlet,
    FormsModule,
    RouterLink,
    EmojiPickerComponent,
    PhasePillsComponent,
  ],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1>
            {{
              isNew()
                ? 'Nueva fase'
                : readOnly()
                  ? 'Ver fase'
                  : 'Editar fase'
            }}
          </h1>
          <p class="subtitle">
            Qué pueden hacer los participantes mientras esta fase está activa
          </p>
        </div>
        <div class="header-actions">
          @if (readOnly() && canCreate()) {
            <button
              type="button"
              class="btn-primary"
              [disabled]="saving()"
              (click)="duplicate()"
            >
              {{ saving() ? 'Duplicando…' : 'Duplicar para editar' }}
            </button>
          }
          <button type="button" class="btn-secondary" (click)="goBack()">
            Volver
          </button>
        </div>
      </div>

      @if (readOnly()) {
        <p class="banner card">
          @if (loaded()?.isSystem) {
            Esta es una fase del sistema: no se edita.
            @if (canCreate()) {
              Duplicala para personalizarla.
            }
          } @else if (canCreate()) {
            No podés editar esta fase. Duplicala para tener tu propia copia.
          } @else {
            Solo lectura: no podés crear ni editar fases.
          }
        </p>
      }

      <form class="card panel" (ngSubmit)="save()">
        <fieldset class="bare" [disabled]="readOnly()">
          <div class="head-grid">
            <div class="field grow">
              <label for="ph-name">Nombre</label>
              <input
                id="ph-name"
                [ngModel]="form().name"
                (ngModelChange)="patch({ name: $event })"
                name="name"
                required
                minlength="2"
                maxlength="80"
                placeholder="Brainwriting privado"
              />
            </div>
            <div class="field">
              <label for="ph-icon">Ícono</label>
              <div class="icon-row">
                <input
                  id="ph-icon"
                  class="icon-input"
                  [ngModel]="form().icon"
                  (ngModelChange)="patch({ icon: $event })"
                  name="icon"
                  maxlength="16"
                  placeholder="🔥"
                />
                @if (!readOnly()) {
                  <app-emoji-picker
                    iconOnly
                    title="Elegir emoji"
                    placement="down"
                    [prepend]="iconSuggestions"
                    (picked)="patch({ icon: $event })"
                  />
                }
              </div>
            </div>
            <div class="field">
              <label for="ph-color">Color</label>
              <div class="color-row">
                <input
                  type="color"
                  [ngModel]="colorPickerValue()"
                  (ngModelChange)="patch({ color: $event })"
                  name="colorPick"
                  aria-label="Elegir color"
                />
                <input
                  id="ph-color"
                  class="hex-input"
                  [ngModel]="form().color"
                  (ngModelChange)="patch({ color: $event })"
                  name="color"
                  placeholder="#f97316"
                />
                @if (form().color && !readOnly()) {
                  <button
                    type="button"
                    class="btn-ghost btn-sm"
                    (click)="patch({ color: '' })"
                  >
                    Quitar
                  </button>
                }
              </div>
            </div>
          </div>

          <div class="field">
            <label>Tipo</label>
            <div class="radio-row" role="radiogroup" aria-label="Tipo de fase">
              @for (k of kinds; track k) {
                <label class="radio" [class.on]="form().kind === k">
                  <input
                    type="radio"
                    name="kind"
                    [value]="k"
                    [checked]="form().kind === k"
                    (change)="setKind(k)"
                  />
                  {{ kindLabels[k] }}
                </label>
              }
            </div>
          </div>

          <div class="field">
            <label for="ph-desc">Descripción</label>
            <input
              id="ph-desc"
              [ngModel]="form().description"
              (ngModelChange)="patch({ description: $event })"
              name="description"
              maxlength="500"
              placeholder="Para qué sirve esta fase (se ve en el listado)"
            />
          </div>

          <div class="field">
            <label for="ph-instr">Consigna</label>
            <textarea
              id="ph-instr"
              [ngModel]="form().instructions"
              (ngModelChange)="patch({ instructions: $event })"
              name="instructions"
              rows="2"
              maxlength="1000"
              placeholder="Lo que ven los participantes al entrar a la fase"
            ></textarea>
          </div>

          @if (
            form().kind === 'semaforo' || form().kind === 'semaforo_review'
          ) {
            <section class="group semaforo-emojis-group">
              <h2 class="group-title">Emojis del semáforo</h2>
              <p class="field-hint">
                Se usan al votar y al mostrar el resumen. El valor interno sigue
                siendo rojo / amarillo / verde.
              </p>
              <div class="semaforo-emoji-row">
                @for (key of semaforoValueOrder; track key; let i = $index) {
                  <div class="semaforo-emoji-slot">
                    <span class="semaforo-emoji-label">{{
                      semaforoValueLabels[key]
                    }}</span>
                    @if (readOnly()) {
                      <span class="semaforo-emoji-preview" aria-hidden="true">{{
                        form().semaforoEmojis[i]
                      }}</span>
                    } @else {
                      <app-emoji-picker
                        [label]="form().semaforoEmojis[i]"
                        [title]="'Cambiar emoji ' + semaforoValueLabels[key]"
                        placement="down"
                        [prepend]="semaforoEmojiSuggestions"
                        (picked)="setSemaforoEmoji(i, $event)"
                      />
                    }
                  </div>
                }
              </div>
            </section>
          }

          <div class="settings-grid">
            <div class="field">
              <label for="ph-timer">Timer sugerido</label>
              <select
                id="ph-timer"
                name="timer"
                [ngModel]="form().timerSeconds"
                (ngModelChange)="patch({ timerSeconds: $event })"
              >
                @for (t of timerOptions; track t.label) {
                  <option [ngValue]="t.value">{{ t.label }}</option>
                }
              </select>
            </div>
            @if (isAdmin()) {
              <div class="field">
                <label>Alcance</label>
                <div class="radio-row">
                  <label class="radio" [class.on]="!form().isGlobal">
                    <input
                      type="radio"
                      name="scope"
                      [checked]="!form().isGlobal"
                      (change)="patch({ isGlobal: false })"
                    />
                    Personal
                  </label>
                  <label class="radio" [class.on]="form().isGlobal">
                    <input
                      type="radio"
                      name="scope"
                      [checked]="form().isGlobal"
                      (change)="patch({ isGlobal: true })"
                    />
                    Global
                  </label>
                </div>
              </div>
            }
          </div>

          @if (!caps().isBoard) {
            <section class="group">
              <h2 class="group-title">
                {{ kindLabels[form().kind] }}
              </h2>
              <p class="note">
                Esta fase no usa el tablero de tarjetas, así que las opciones
                de escritura, visibilidad e interacción no aplican.
                {{ kindNote() }}
              </p>
              @if (form().kind === 'action_plan') {
                <label class="check">
                  <input
                    type="checkbox"
                    name="allowPresentation"
                    [checked]="form().allowPresentation"
                    [disabled]="readOnly()"
                    (change)="patch({ allowPresentation: checked($event) })"
                  />
                  Modo presentación de tarjetas
                </label>
                <p class="why" style="margin-left: 0">
                  ⓘ El facilitador puede recorrer las tarjetas más votadas en
                  pantalla completa.
                </p>
              }
              <div class="chips">
                @if (caps().showReadyCheck) {
                  <span class="chip">checkbox “Estoy listo”</span>
                }
                @if (caps().allowPresentation) {
                  <span class="chip">modo presentación</span>
                }
                @if (caps().allowActionItems) {
                  <span class="chip">crear accionables</span>
                }
              </div>
            </section>
          } @else {
            <!-- Escritura -->
            <section class="group">
              <h2 class="group-title">Escritura</h2>
              <label class="check">
                <input
                  type="checkbox"
                  name="allowCreateCards"
                  [checked]="caps().allowCreateCards"
                  (change)="patch({ allowCreateCards: checked($event) })"
                />
                Permitir crear tarjetas
              </label>
              <div class="sub" [class.off]="!caps().allowCreateCards">
                <div class="field inline">
                  <label>Contenido</label>
                  <div class="radio-row">
                    @for (o of cardContentOptions; track o.value) {
                      <label
                        class="radio"
                        [class.on]="caps().cardContent === o.value"
                      >
                        <input
                          type="radio"
                          name="cardContent"
                          [value]="o.value"
                          [checked]="caps().cardContent === o.value"
                          [disabled]="readOnly() || !!why('cardContent')"
                          (change)="patch({ cardContent: o.value })"
                        />
                        {{ o.label }}
                      </label>
                    }
                  </div>
                </div>
                <div class="field inline">
                  <label for="ph-max">Máx. por persona en esta fase</label>
                  <input
                    id="ph-max"
                    class="num"
                    type="number"
                    min="1"
                    name="maxCards"
                    [ngModel]="caps().maxCardsPerParticipant"
                    [disabled]="readOnly() || !!why('maxCardsPerParticipant')"
                    (ngModelChange)="patch({ maxCardsPerParticipant: intOrNull($event) })"
                    placeholder="—"
                  />
                  <span class="hint">vacío = el de la retro</span>
                </div>
                @if (why('cardContent'); as w) {
                  <p class="why">ⓘ {{ w }}</p>
                }
              </div>
              <label class="check" [class.off]="!!why('allowEditOwnCards')">
                <input
                  type="checkbox"
                  name="allowEditOwnCards"
                  [checked]="caps().allowEditOwnCards"
                  [disabled]="readOnly() || !!why('allowEditOwnCards')"
                  (change)="patch({ allowEditOwnCards: checked($event) })"
                />
                Permitir editar y borrar las tarjetas propias
              </label>
              @if (why('allowEditOwnCards'); as w) {
                <p class="why">ⓘ {{ w }}</p>
              }
            </section>

            <!-- Visibilidad -->
            <section class="group">
              <h2 class="group-title">Visibilidad</h2>
              <div class="field inline">
                <label>Tarjetas de otros</label>
                <div class="radio-row">
                  @for (o of visibilityOptions; track o.value) {
                    <label
                      class="radio"
                      [class.on]="caps().othersVisibility === o.value"
                    >
                      <input
                        type="radio"
                        name="othersVisibility"
                        [value]="o.value"
                        [checked]="caps().othersVisibility === o.value"
                        (change)="patch({ othersVisibility: o.value })"
                      />
                      {{ o.label }}
                    </label>
                  }
                </div>
              </div>
              <label class="check" [class.off]="!!why('revealOnReady')">
                <input
                  type="checkbox"
                  name="revealOnReady"
                  [checked]="caps().revealOnReady"
                  [disabled]="readOnly() || !!why('revealOnReady')"
                  (change)="patch({ revealOnReady: checked($event) })"
                />
                Revelar las de cada persona cuando marca “listo”
              </label>
              @if (why('revealOnReady'); as w) {
                <p class="why">ⓘ {{ w }}</p>
              }
              <label class="check" [class.off]="!!why('anonymousCards')">
                <input
                  type="checkbox"
                  name="anonymousCards"
                  [checked]="caps().anonymousCards"
                  [disabled]="readOnly() || !!why('anonymousCards')"
                  (change)="patch({ anonymousCards: checked($event) })"
                />
                Mostrar todas como anónimas (menos las propias)
              </label>
              @if (why('anonymousCards'); as w) {
                <p class="why">ⓘ {{ w }}</p>
              }
            </section>

            <!-- Interacción -->
            <section class="group">
              <h2 class="group-title">Interacción</h2>
              <label class="check" [class.off]="!!why('allowGrouping')">
                <input
                  type="checkbox"
                  name="allowGrouping"
                  [checked]="caps().allowGrouping"
                  [disabled]="readOnly() || !!why('allowGrouping')"
                  (change)="patch({ allowGrouping: checked($event) })"
                />
                Permitir agrupar tarjetas
              </label>
              @if (why('allowGrouping'); as w) {
                <p class="why">ⓘ {{ w }}</p>
              }
              <div class="sub">
                <label
                  class="check"
                  [class.off]="!!why('allowCrossColumnGrouping')"
                >
                  <input
                    type="checkbox"
                    name="allowCrossColumnGrouping"
                    [checked]="caps().allowCrossColumnGrouping"
                    [disabled]="readOnly() || !!why('allowCrossColumnGrouping')"
                    (change)="patch({ allowCrossColumnGrouping: checked($event) })"
                  />
                  Agrupar entre columnas distintas
                </label>
                @if (why('allowCrossColumnGrouping'); as w) {
                  <p class="why">ⓘ {{ w }}</p>
                }
              </div>

              <div class="field inline" [class.off]="!!why('voting')">
                <label>Votación</label>
                <div class="radio-row">
                  @for (o of votingOptions; track o.value) {
                    <label class="radio" [class.on]="caps().voting === o.value">
                      <input
                        type="radio"
                        name="voting"
                        [value]="o.value"
                        [checked]="caps().voting === o.value"
                        [disabled]="readOnly() || !!why('voting')"
                        (change)="patch({ voting: o.value })"
                      />
                      {{ o.label }}
                    </label>
                  }
                </div>
              </div>
              @if (why('voting'); as w) {
                <p class="why">ⓘ {{ w }}</p>
              } @else if (caps().voting === 'single') {
                <p class="why">
                  ⓘ “Un voto” fija en 1 el máximo de votos por comentario.
                </p>
              }
              <label class="check" [class.off]="!!why('hideVoteCounts')">
                <input
                  type="checkbox"
                  name="hideVoteCounts"
                  [checked]="caps().hideVoteCounts"
                  [disabled]="readOnly() || !!why('hideVoteCounts')"
                  (change)="patch({ hideVoteCounts: checked($event) })"
                />
                Ocultar el conteo hasta cambiar de fase
              </label>
              @if (why('hideVoteCounts'); as w) {
                <p class="why">ⓘ {{ w }}</p>
              }

              <div class="reactions-row" [class.off]="!!why('allowReactions')">
                <label class="check">
                  <input
                    type="checkbox"
                    name="allowReactions"
                    [checked]="caps().allowReactions"
                    [disabled]="readOnly() || !!why('allowReactions')"
                    (change)="patch({ allowReactions: checked($event) })"
                  />
                  Reacciones con emoji
                </label>
                @if (caps().allowReactions) {
                  <div class="emoji-chips">
                    @for (e of form().reactionEmojis; track $index) {
                      <span class="emoji-chip">
                        {{ e }}
                        @if (!readOnly()) {
                          <button
                            type="button"
                            class="emoji-x"
                            [disabled]="form().reactionEmojis.length <= 1"
                            [attr.aria-label]="'Quitar ' + e"
                            (click)="removeEmoji($index)"
                          >
                            ×
                          </button>
                        }
                      </span>
                    }
                    @if (
                      !readOnly() &&
                      form().reactionEmojis.length < maxReactionEmojis
                    ) {
                      <app-emoji-picker
                        label="+"
                        title="Agregar emoji"
                        placement="down"
                        (picked)="addEmoji($event)"
                      />
                    }
                  </div>
                }
              </div>
              @if (why('allowReactions'); as w) {
                <p class="why">ⓘ {{ w }}</p>
              } @else if (caps().allowReactions) {
                <p class="why">
                  ⓘ Las reacciones reemplazan la votación.
                </p>
              }

              <label class="check" [class.off]="!!why('allowPresentation')">
                <input
                  type="checkbox"
                  name="allowPresentation"
                  [checked]="caps().allowPresentation"
                  [disabled]="readOnly() || !!why('allowPresentation')"
                  (change)="patch({ allowPresentation: checked($event) })"
                />
                Modo presentación de tarjetas
              </label>
              @if (why('allowPresentation'); as w) {
                <p class="why">ⓘ {{ w }}</p>
              }
              <label class="check">
                <input
                  type="checkbox"
                  name="allowActionItems"
                  [checked]="caps().allowActionItems"
                  (change)="patch({ allowActionItems: checked($event) })"
                />
                Permitir crear accionables desde las tarjetas
              </label>
            </section>

            <!-- Facilitación -->
            <section class="group">
              <h2 class="group-title">Facilitación</h2>
              <label class="check" [class.off]="!!why('showReadyCheck')">
                <input
                  type="checkbox"
                  name="showReadyCheck"
                  [checked]="caps().showReadyCheck"
                  [disabled]="readOnly() || !!why('showReadyCheck')"
                  (change)="patch({ showReadyCheck: checked($event) })"
                />
                Checkbox “Estoy listo” y panel de progreso
                @if (why('showReadyCheck')) {
                  <span class="tag">forzado</span>
                }
              </label>
              @if (why('showReadyCheck'); as w) {
                <p class="why">ⓘ {{ w }}</p>
              }
              <div class="field inline" [class.off]="!!why('defaultSort')">
                <label>Orden de las tarjetas</label>
                <div class="radio-row">
                  @for (o of sortOptions; track o.value) {
                    <label
                      class="radio"
                      [class.on]="caps().defaultSort === o.value"
                      [class.off]="o.needsVotes && !!why('defaultSortVoted')"
                    >
                      <input
                        type="radio"
                        name="defaultSort"
                        [value]="o.value"
                        [checked]="caps().defaultSort === o.value"
                        [disabled]="
                          readOnly() ||
                          !!why('defaultSort') ||
                          (o.needsVotes && !!why('defaultSortVoted'))
                        "
                        (change)="patch({ defaultSort: o.value })"
                      />
                      {{ o.label }}
                    </label>
                  }
                </div>
              </div>
              @if (why('defaultSort'); as w) {
                <p class="why">ⓘ {{ w }}</p>
              } @else if (why('defaultSortVoted'); as w) {
                <p class="why">ⓘ {{ w }}</p>
              }
            </section>
          }
        </fieldset>

        <!-- Vista previa -->
        <section class="group preview">
          <h2 class="group-title">Vista previa</h2>
          <div class="preview-row">
            <span class="preview-label">Pastilla</span>
            <app-phase-pills
              mode="retro"
              [phases]="previewPills()"
              activeId="preview"
              [doneIds]="['prev']"
            />
          </div>
          @if (caps().isBoard) {
            <div class="preview-row">
              <span class="preview-label">Tablero</span>
              <div class="preview-board">
                <div
                  class="p-card other"
                  [class.blurred]="caps().othersVisibility === 'blurred'"
                  [class.hidden]="caps().othersVisibility === 'hidden'"
                >
                  <span class="p-author">{{
                    caps().anonymousCards ? 'Anónimo' : 'Ana'
                  }}</span>
                  <span class="p-text">Faltó tiempo para probar</span>
                  <ng-container *ngTemplateOutlet="footer" />
                </div>
                <div class="p-card mine">
                  <span class="p-author">Vos</span>
                  <span class="p-text">Buen trabajo en equipo</span>
                  <ng-container *ngTemplateOutlet="footer" />
                </div>
                <div
                  class="p-card other"
                  [class.blurred]="caps().othersVisibility === 'blurred'"
                  [class.hidden]="caps().othersVisibility === 'hidden'"
                >
                  <span class="p-author">{{
                    caps().anonymousCards ? 'Anónimo' : 'Leo'
                  }}</span>
                  <span class="p-text">Más demos cortas</span>
                  <ng-container *ngTemplateOutlet="footer" />
                </div>
              </div>
            </div>
            @if (caps().allowCreateCards) {
              <div class="preview-row">
                <span class="preview-label"></span>
                <div class="p-composer">
                  @if (caps().cardContent !== 'image_only') {
                    <span class="p-input">Escribí una tarjeta…</span>
                  } @else {
                    <span class="p-input">Subí una imagen o GIF…</span>
                  }
                  @if (caps().cardContent !== 'text_only') {
                    <span class="p-btn">Imagen/GIF</span>
                  }
                  <span class="p-btn primary">Añadir</span>
                </div>
              </div>
            }
            <ng-template #footer>
              @if (caps().voting !== 'off' || caps().allowReactions) {
                <span class="p-footer">
                  @if (caps().allowReactions) {
                    @for (e of caps().reactionEmojis.slice(0, 3); track $index) {
                      <span>{{ e }}</span>
                    }
                  } @else if (caps().voting === 'single') {
                    <span>♥ {{ caps().hideVoteCounts ? '·' : '2' }}</span>
                  } @else {
                    <span>− {{ caps().hideVoteCounts ? '·' : '3' }} +</span>
                  }
                </span>
              }
            </ng-template>
          } @else {
            <div class="preview-row">
              <span class="preview-label">Pantalla</span>
              <p class="note">{{ kindNote() }}</p>
            </div>
            @if (
              form().kind === 'semaforo' || form().kind === 'semaforo_review'
            ) {
              <div class="preview-row">
                <span class="preview-label">Emojis</span>
                <span class="semaforo-preview-emojis">
                  @for (e of form().semaforoEmojis; track $index) {
                    <span>{{ e }}</span>
                  }
                </span>
              </div>
            }
          }
        </section>

        @if (loaded()?.usedIn?.length) {
          <p class="hint">
            Usada en:
            @for (t of loaded()!.usedIn!; track t.id; let last = $last) {
              <a [routerLink]="['/templates', t.id]">{{ t.name }}</a
              >{{ last ? '' : ', ' }}
            }
          </p>
        }

        @if (!readOnly()) {
          <div class="form-actions">
            <button class="btn-primary" type="submit" [disabled]="saving()">
              {{ saving() ? 'Guardando…' : 'Guardar fase' }}
            </button>
          </div>
        }
      </form>
    </div>
  `,
  styles: `
    .header-actions {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
    }
    .banner {
      padding: 0.75rem 1rem;
      margin: 0 0 1rem;
      font-size: 0.9rem;
      color: var(--color-text-muted);
      border-left: 4px solid var(--color-sky-mid);
    }
    .panel {
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    fieldset.bare {
      border: none;
      padding: 0;
      margin: 0;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    .head-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 0.85rem;
      align-items: flex-start;
    }
    .grow {
      flex: 1 1 220px;
    }
    .icon-row,
    .color-row {
      display: flex;
      align-items: center;
      gap: 0.45rem;
    }
    .icon-input {
      width: 4.5rem;
      text-align: center;
    }
    .hex-input {
      width: 7rem;
    }
    .color-row input[type='color'] {
      width: 42px;
      height: 38px;
      padding: 0;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
      background: transparent;
      cursor: pointer;
    }
    .settings-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 0.85rem;
    }
    .radio-row {
      display: flex;
      flex-wrap: wrap;
      gap: 0.35rem;
    }
    .radio {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.35rem 0.7rem;
      border: 1.5px solid var(--color-border);
      border-radius: 999px;
      font-size: 0.85rem;
      font-weight: 500;
      color: var(--color-text-muted);
      cursor: pointer;
      user-select: none;
      input {
        margin: 0;
        accent-color: var(--color-brand);
      }
      &.on {
        border-color: var(--color-brand);
        color: var(--color-brand);
        background: var(--color-sky-soft);
        font-weight: 650;
      }
      &.off,
      &:has(input:disabled) {
        opacity: 0.55;
        cursor: not-allowed;
      }
    }
    .group {
      display: flex;
      flex-direction: column;
      gap: 0.55rem;
      padding-top: 0.75rem;
      border-top: 1px solid var(--color-border);
    }
    .group-title {
      font-size: 0.8rem;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--color-text-muted);
      margin: 0 0 0.15rem;
    }
    .check {
      display: flex;
      align-items: center;
      gap: 0.55rem;
      font-size: 0.925rem;
      cursor: pointer;
      input {
        margin: 0;
        width: 1rem;
        height: 1rem;
        accent-color: var(--color-brand);
      }
      &.off {
        opacity: 0.6;
        cursor: not-allowed;
      }
    }
    .field.inline {
      flex-direction: row;
      align-items: center;
      flex-wrap: wrap;
      gap: 0.6rem;
      > label {
        min-width: 9rem;
      }
    }
    .field.inline.off {
      opacity: 0.6;
    }
    .num {
      width: 5.5rem;
    }
    .sub {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      margin-left: 1.55rem;
      padding-left: 0.75rem;
      border-left: 2px solid var(--color-border);
      &.off {
        opacity: 0.6;
      }
    }
    .why {
      margin: -0.2rem 0 0 1.55rem;
      font-size: 0.8rem;
      color: var(--color-text-muted);
    }
    .hint {
      margin: 0;
      font-size: 0.8rem;
      color: var(--color-text-muted);
    }
    .note {
      margin: 0;
      font-size: 0.9rem;
      color: var(--color-text-muted);
    }
    .semaforo-preview-emojis {
      display: inline-flex;
      gap: 0.45rem;
      font-size: 1.35rem;
      line-height: 1;
    }
    .tag {
      font-size: 0.68rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      padding: 0.1rem 0.4rem;
      border-radius: 999px;
      background: var(--color-bg-muted);
      color: var(--color-text-muted);
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 0.3rem;
    }
    .chip {
      font-size: 0.75rem;
      padding: 0.15rem 0.5rem;
      border-radius: 999px;
      background: var(--color-bg-muted);
      border: 1px solid var(--color-border);
    }
    .reactions-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.6rem 1rem;
      &.off {
        opacity: 0.6;
      }
    }
    .emoji-chips {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.3rem;
    }
    .semaforo-emojis-group {
      margin-top: 0.25rem;
    }
    .field-hint {
      margin: 0;
      font-size: 0.8rem;
      color: var(--color-text-muted);
    }
    .semaforo-emoji-row {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem 1.25rem;
    }
    .semaforo-emoji-slot {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
      min-width: 6.5rem;
    }
    .semaforo-emoji-label {
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      color: var(--color-text-muted);
    }
    .semaforo-emoji-pick {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
    }
    .semaforo-emoji-preview {
      font-size: 1.5rem;
      line-height: 1;
    }
    .emoji-chip {
      display: inline-flex;
      align-items: center;
      gap: 0.15rem;
      padding: 0.15rem 0.3rem 0.15rem 0.5rem;
      border-radius: 999px;
      border: 1px solid var(--color-border);
      background: var(--color-bg);
      font-size: 1rem;
      line-height: 1;
    }
    .emoji-x {
      appearance: none;
      border: none;
      background: transparent;
      color: var(--color-text-muted);
      width: 1.1rem;
      height: 1.1rem;
      border-radius: 999px;
      display: grid;
      place-items: center;
      font-size: 0.85rem;
      cursor: pointer;
      padding: 0;
      &:hover:not(:disabled) {
        background: var(--color-danger-soft);
        color: var(--color-danger);
      }
      &:disabled {
        opacity: 0.35;
        cursor: not-allowed;
      }
    }
    /* Preview */
    .preview {
      background: var(--color-sky-soft);
      border-radius: var(--radius-sm);
      padding: 0.85rem 1rem;
      border-top: none;
    }
    .preview-row {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
    }
    .preview-label {
      flex: 0 0 5.5rem;
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--color-text-muted);
      padding-top: 0.45rem;
    }
    .preview-board {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 0.5rem;
      flex: 1;
      min-width: 0;
    }
    .p-card {
      background: var(--color-bg);
      border-radius: var(--radius-sm);
      border: 1px solid var(--color-border);
      padding: 0.5rem 0.6rem;
      font-size: 0.78rem;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      min-height: 3.4rem;
      &.mine {
        border-color: var(--color-brand);
      }
      &.blurred .p-text,
      &.blurred .p-author {
        filter: blur(4px);
        user-select: none;
      }
      &.hidden {
        background: repeating-linear-gradient(
          -45deg,
          var(--color-bg-muted),
          var(--color-bg-muted) 6px,
          var(--color-bg) 6px,
          var(--color-bg) 12px
        );
        .p-text,
        .p-author,
        .p-footer {
          visibility: hidden;
        }
      }
    }
    .p-author {
      font-size: 0.68rem;
      color: var(--color-text-muted);
      font-weight: 600;
    }
    .p-footer {
      margin-top: auto;
      display: flex;
      gap: 0.3rem;
      font-size: 0.72rem;
      color: var(--color-text-muted);
    }
    .p-composer {
      flex: 1;
      display: flex;
      gap: 0.4rem;
      align-items: center;
      flex-wrap: wrap;
    }
    .p-input {
      flex: 1 1 8rem;
      padding: 0.4rem 0.6rem;
      border: 1.5px dashed var(--color-border);
      border-radius: var(--radius-sm);
      background: var(--color-bg);
      color: var(--color-text-muted);
      font-size: 0.78rem;
    }
    .p-btn {
      padding: 0.3rem 0.6rem;
      border-radius: var(--radius-sm);
      border: 1px solid var(--color-border);
      background: var(--color-bg);
      font-size: 0.75rem;
      color: var(--color-text-muted);
      &.primary {
        background: var(--color-brand);
        border-color: var(--color-brand);
        color: var(--color-on-brand);
      }
    }
    .form-actions {
      display: flex;
      justify-content: flex-end;
    }
    @media (max-width: 640px) {
      .preview-row {
        flex-direction: column;
        gap: 0.35rem;
      }
      .preview-label {
        padding-top: 0;
      }
      .field.inline > label {
        min-width: 100%;
      }
    }
  `,
})
export class PhaseEditorPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly kinds = KIND_ORDER;
  readonly kindLabels = PHASE_KIND_LABELS;
  readonly cardContentOptions = CARD_CONTENT_OPTIONS;
  readonly visibilityOptions = VISIBILITY_OPTIONS;
  readonly votingOptions = VOTING_OPTIONS;
  readonly sortOptions = SORT_OPTIONS;
  readonly timerOptions = TIMER_OPTIONS;
  readonly iconSuggestions = ICON_SUGGESTIONS;
  readonly maxReactionEmojis = MAX_REACTION_EMOJIS;
  readonly semaforoValueOrder = SEMAFORO_VALUE_ORDER;
  readonly semaforoValueLabels = SEMAFORO_VALUE_LABELS;
  readonly semaforoEmojiSuggestions = [
    '🔴',
    '🟡',
    '🟢',
    '🟥',
    '🟨',
    '🟩',
    '😡',
    '😐',
    '😊',
    '❌',
    '⚠️',
    '✅',
    '👎',
    '👍',
    '🔥',
    '❄️',
  ];

  readonly isNew = signal(true);
  readonly saving = signal(false);
  readonly loaded = signal<Phase | null>(null);
  readonly form = signal<PhaseForm>(emptyForm());
  private readonly canCreateFlag = signal(false);
  private phaseId: string | null = null;
  private returnTo: string | null = null;

  readonly caps = computed(() => phaseCapabilities(this.form()));

  readonly readOnly = computed(() => {
    const p = this.loaded();
    if (!p) return false;
    if (p.isSystem) return true;
    return !(this.isAdmin() || p.createdById === this.auth.user()?.id);
  });

  readonly previewPills = computed<PhasePillItem[]>(() => {
    const f = this.form();
    return [
      { id: 'prev', name: 'Fase anterior' },
      {
        id: 'preview',
        name: f.name.trim() || 'Nueva fase',
        icon: f.icon.trim() || null,
        color: HEX_COLOR.test(f.color.trim()) ? f.color.trim() : null,
      },
      { id: 'next', name: 'Siguiente' },
    ];
  });

  readonly kindNote = computed(() => {
    const k = this.form().kind;
    return k === 'board' ? '' : KIND_NOTES[k];
  });

  isAdmin() {
    return !!this.auth.user()?.isAdmin;
  }

  canCreate() {
    return this.isAdmin() || this.canCreateFlag();
  }

  colorPickerValue() {
    const c = this.form().color.trim();
    return HEX_COLOR.test(c) ? c : '#008ace';
  }

  why(key: string): string | undefined {
    return this.caps().disabledReasons[key];
  }

  checked(ev: Event) {
    return (ev.target as HTMLInputElement).checked;
  }

  intOrNull(v: unknown): number | null {
    if (v === '' || v === null || v === undefined) return null;
    const n = Number(v);
    return Number.isFinite(n) && n >= 1 ? Math.floor(n) : null;
  }

  patch(partial: Partial<PhaseForm>) {
    this.form.update((f) => ({ ...f, ...partial }));
  }

  setKind(kind: PhaseKind) {
    const prev = this.form().kind;
    const partial: Partial<PhaseForm> = { kind };
    // Sensible default when entering Plan de acción.
    if (kind === 'action_plan' && prev !== 'action_plan') {
      partial.allowPresentation = true;
    }
    this.patch(partial);
  }

  addEmoji(emoji: string) {
    const e = emoji.trim();
    if (!e) return;
    const list = this.form().reactionEmojis;
    if (list.includes(e) || list.length >= MAX_REACTION_EMOJIS) return;
    this.patch({ reactionEmojis: [...list, e] });
  }

  removeEmoji(index: number) {
    const list = this.form().reactionEmojis;
    if (list.length <= 1) return;
    this.patch({ reactionEmojis: list.filter((_, i) => i !== index) });
  }

  setSemaforoEmoji(index: number, emoji: string) {
    const e = emoji.trim();
    if (!e || index < 0 || index > 2) return;
    const next = normalizeSemaforoEmojis(this.form().semaforoEmojis);
    next[index] = e;
    this.patch({ semaforoEmojis: next });
  }

  ngOnInit() {
    this.auth.ensureFacilitator().subscribe((ok) => this.canCreateFlag.set(ok));
    const id = this.route.snapshot.paramMap.get('id');
    this.returnTo = this.captureReturnTo(id === 'new' || !id ? 'new' : id);
    if (!id || id === 'new') {
      this.isNew.set(true);
      return;
    }
    this.isNew.set(false);
    this.phaseId = id;
    this.api.getPhase(id).subscribe({
      next: (p) => this.applyPhase(p),
      error: (e) => {
        this.toast.error(httpErrorMessage(e, 'No se pudo cargar la fase'));
        this.goBack();
      },
    });
  }

  goBack() {
    const dest = this.returnTo ?? '/phases';
    this.clearReturnTo(this.phaseId ?? 'new');
    void this.router.navigateByUrl(dest);
  }

  private captureReturnTo(phaseKey: string): string | null {
    const key = `rk:phase-return:${phaseKey}`;
    const fromNav = (history.state as { returnTo?: string } | null)?.returnTo;
    if (fromNav && this.isSafeReturnTo(fromNav)) {
      try {
        sessionStorage.setItem(key, fromNav);
      } catch {
        /* ignore */
      }
      return fromNav;
    }
    try {
      const stored = sessionStorage.getItem(key);
      if (stored && this.isSafeReturnTo(stored)) return stored;
    } catch {
      /* ignore */
    }
    return null;
  }

  private clearReturnTo(phaseKey: string) {
    try {
      sessionStorage.removeItem(`rk:phase-return:${phaseKey}`);
    } catch {
      /* ignore */
    }
  }

  private isSafeReturnTo(path: string): boolean {
    return (
      path === '/phases' ||
      path === '/templates' ||
      path === '/templates/new' ||
      /^\/templates\/[a-zA-Z0-9_-]+$/.test(path)
    );
  }

  duplicate() {
    if (!this.phaseId) return;
    this.saving.set(true);
    this.api.duplicatePhase(this.phaseId).subscribe({
      next: (copy) => {
        this.saving.set(false);
        this.toast.ok('Fase duplicada');
        this.transferReturnTo(this.phaseId!, copy.id);
        void this.router
          .navigate(['/phases', copy.id], {
            state: this.returnTo ? { returnTo: this.returnTo } : undefined,
          })
          .then(() => {
            this.phaseId = copy.id;
            this.applyPhase(copy);
          });
      },
      error: (e) => {
        this.saving.set(false);
        this.toast.error(httpErrorMessage(e, 'No se pudo duplicar la fase'));
      },
    });
  }

  save() {
    if (this.readOnly()) return;
    const f = this.form();
    const name = f.name.trim();
    if (name.length < 2) {
      this.toast.error('El nombre debe tener al menos 2 caracteres');
      return;
    }
    const color = f.color.trim();
    if (color && !HEX_COLOR.test(color)) {
      this.toast.error('El color debe ser un hex válido (#rgb o #rrggbb)');
      return;
    }
    if (f.kind === 'board' && f.allowReactions && !f.reactionEmojis.length) {
      this.toast.error('Elegí al menos un emoji para las reacciones');
      return;
    }

    const payload = this.payload();
    this.saving.set(true);
    const req = this.isNew()
      ? this.api.createPhase(payload)
      : this.api.updatePhase(this.phaseId!, payload);

    req.subscribe({
      next: (p) => {
        this.saving.set(false);
        if (this.isNew()) {
          this.toast.ok('Fase creada');
          this.transferReturnTo('new', p.id);
          void this.router.navigate(['/phases', p.id], {
            replaceUrl: true,
            state: this.returnTo ? { returnTo: this.returnTo } : undefined,
          });
          this.phaseId = p.id;
          this.applyPhase(p);
          return;
        }
        this.applyPhase(p);
        this.toast.ok('Fase guardada');
      },
      error: (e) => {
        this.saving.set(false);
        this.toast.error(httpErrorMessage(e, 'No se pudo guardar la fase'));
      },
    });
  }

  private transferReturnTo(fromKey: string, toKey: string) {
    if (fromKey === toKey) return;
    try {
      const from = `rk:phase-return:${fromKey}`;
      const to = `rk:phase-return:${toKey}`;
      const value =
        this.returnTo ??
        sessionStorage.getItem(from) ??
        null;
      if (value && this.isSafeReturnTo(value)) {
        sessionStorage.setItem(to, value);
      }
      sessionStorage.removeItem(from);
    } catch {
      /* ignore */
    }
  }

  private payload(): Partial<Phase> & { name: string; kind: PhaseKind } {
    const f = this.form();
    const n = normalizePhase(f);
    return {
      name: f.name.trim(),
      description: f.description.trim() || null,
      kind: n.kind,
      icon: f.icon.trim() || null,
      color: f.color.trim() || null,
      instructions: f.instructions.trim() || null,
      timerSeconds: f.timerSeconds ?? null,
      ...(this.isAdmin() ? { isGlobal: f.isGlobal } : {}),
      allowCreateCards: n.allowCreateCards,
      cardContent: n.cardContent,
      maxCardsPerParticipant: n.maxCardsPerParticipant,
      allowEditOwnCards: n.allowEditOwnCards,
      anonymousCards: n.anonymousCards,
      othersVisibility: n.othersVisibility,
      revealOnReady: n.revealOnReady,
      allowGrouping: n.allowGrouping,
      allowCrossColumnGrouping: n.allowCrossColumnGrouping,
      voting: n.voting,
      hideVoteCounts: n.hideVoteCounts,
      allowReactions: n.allowReactions,
      reactionEmojis: n.reactionEmojis,
      semaforoEmojis: n.semaforoEmojis,
      allowPresentation: n.allowPresentation,
      allowActionItems: n.allowActionItems,
      showReadyCheck: n.showReadyCheck,
      defaultSort: n.defaultSort,
    };
  }

  private applyPhase(p: Phase) {
    this.isNew.set(false);
    this.phaseId = p.id;
    this.loaded.set(p);
    this.form.set({
      name: p.name,
      description: p.description ?? '',
      kind: p.kind,
      icon: p.icon ?? '',
      color: p.color ?? '',
      instructions: p.instructions ?? '',
      timerSeconds: p.timerSeconds ?? null,
      isGlobal: !!p.isGlobal,
      allowCreateCards: p.allowCreateCards,
      cardContent: p.cardContent,
      maxCardsPerParticipant: p.maxCardsPerParticipant ?? null,
      allowEditOwnCards: p.allowEditOwnCards,
      anonymousCards: p.anonymousCards,
      othersVisibility: p.othersVisibility,
      revealOnReady: p.revealOnReady,
      allowGrouping: p.allowGrouping,
      allowCrossColumnGrouping: p.allowCrossColumnGrouping,
      voting: p.voting,
      hideVoteCounts: p.hideVoteCounts,
      allowReactions: p.allowReactions,
      reactionEmojis: p.reactionEmojis?.length
        ? [...p.reactionEmojis]
        : emptyForm().reactionEmojis,
      semaforoEmojis: normalizeSemaforoEmojis(p.semaforoEmojis),
      allowPresentation: p.allowPresentation,
      allowActionItems: p.allowActionItems,
      showReadyCheck: p.showReadyCheck,
      defaultSort: p.defaultSort,
    });
  }
}
