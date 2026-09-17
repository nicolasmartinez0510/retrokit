/**
 * Phase capability rules.
 * Keep in sync with frontend/src/app/core/phase-rules.ts
 */

export type PhaseKind =
  | 'board'
  | 'action_plan'
  | 'roti'
  | 'semaforo'
  | 'semaforo_review';

export type CardContentMode = 'text_and_image' | 'image_only' | 'text_only';
export type OthersVisibility = 'visible' | 'blurred' | 'hidden';
export type VotingMode = 'off' | 'single' | 'multi';
export type CardSort = 'original' | 'most_voted' | 'least_voted' | 'random';

export interface PhaseCapabilitiesInput {
  kind: PhaseKind;
  allowCreateCards: boolean;
  cardContent: CardContentMode;
  maxCardsPerParticipant: number | null;
  allowEditOwnCards: boolean;
  anonymousCards: boolean;
  othersVisibility: OthersVisibility;
  revealOnReady: boolean;
  allowGrouping: boolean;
  allowCrossColumnGrouping: boolean;
  voting: VotingMode;
  hideVoteCounts: boolean;
  allowReactions: boolean;
  reactionEmojis: string[];
  /** Ordered [red, yellow, green] display emojis. */
  semaforoEmojis: string[];
  allowPresentation: boolean;
  allowActionItems: boolean;
  showReadyCheck: boolean;
  defaultSort: CardSort;
}

export interface PhaseCapabilityFlags {
  isBoard: boolean;
  allowCreateCards: boolean;
  cardContent: CardContentMode;
  maxCardsPerParticipant: number | null;
  allowEditOwnCards: boolean;
  anonymousCards: boolean;
  othersVisibility: OthersVisibility;
  revealOnReady: boolean;
  allowGrouping: boolean;
  allowCrossColumnGrouping: boolean;
  voting: VotingMode;
  hideVoteCounts: boolean;
  allowReactions: boolean;
  reactionEmojis: string[];
  semaforoEmojis: string[];
  allowPresentation: boolean;
  allowActionItems: boolean;
  showReadyCheck: boolean;
  defaultSort: CardSort;
  /** Soft warnings for the editor UI */
  warnings: string[];
  /** Reasons why certain controls are disabled */
  disabledReasons: Record<string, string>;
}

const DEFAULT_EMOJIS = ['👍', '❤️', '🎉', '😮', '😕'];

export const DEFAULT_SEMAFORO_EMOJIS = ['🔴', '🟡', '🟢'] as const;

export type SemaforoValueKey = 'red' | 'yellow' | 'green';

export const SEMAFORO_VALUE_ORDER: readonly SemaforoValueKey[] = [
  'red',
  'yellow',
  'green',
];

export const SEMAFORO_VALUE_LABELS: Record<SemaforoValueKey, string> = {
  red: 'Rojo',
  yellow: 'Amarillo',
  green: 'Verde',
};

/** Ensure exactly 3 emojis [red, yellow, green], filling gaps with defaults. */
export function normalizeSemaforoEmojis(
  input?: string[] | null,
): [string, string, string] {
  const defaults = [...DEFAULT_SEMAFORO_EMOJIS] as [string, string, string];
  if (!input?.length) return defaults;
  return [
    input[0]?.trim() || defaults[0],
    input[1]?.trim() || defaults[1],
    input[2]?.trim() || defaults[2],
  ];
}

export function semaforoEmojiMap(
  input?: string[] | null,
): Record<SemaforoValueKey, string> {
  const [red, yellow, green] = normalizeSemaforoEmojis(input);
  return { red, yellow, green };
}

const BOARD_DEFAULTS: Omit<PhaseCapabilitiesInput, 'kind'> = {
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
  reactionEmojis: [...DEFAULT_EMOJIS],
  semaforoEmojis: [...DEFAULT_SEMAFORO_EMOJIS],
  allowPresentation: false,
  allowActionItems: false,
  showReadyCheck: true,
  defaultSort: 'original',
};

/** Normalize a phase config applying hard invalidation rules. */
export function normalizePhase<T extends PhaseCapabilitiesInput>(
  input: T,
): T & PhaseCapabilitiesInput {
  const warnings: string[] = [];
  const out: PhaseCapabilitiesInput = {
    kind: input.kind,
    allowCreateCards: input.allowCreateCards,
    cardContent: input.cardContent,
    maxCardsPerParticipant: input.maxCardsPerParticipant,
    allowEditOwnCards: input.allowEditOwnCards,
    anonymousCards: input.anonymousCards,
    othersVisibility: input.othersVisibility,
    revealOnReady: input.revealOnReady,
    allowGrouping: input.allowGrouping,
    allowCrossColumnGrouping: input.allowCrossColumnGrouping,
    voting: input.voting,
    hideVoteCounts: input.hideVoteCounts,
    allowReactions: input.allowReactions,
    reactionEmojis:
      input.reactionEmojis?.length > 0
        ? [...input.reactionEmojis]
        : [...DEFAULT_EMOJIS],
    semaforoEmojis: normalizeSemaforoEmojis(input.semaforoEmojis),
    allowPresentation: input.allowPresentation,
    allowActionItems: input.allowActionItems,
    showReadyCheck: input.showReadyCheck,
    defaultSort: input.defaultSort,
  };

  if (out.kind !== 'board') {
    Object.assign(out, {
      ...BOARD_DEFAULTS,
      allowCreateCards: false,
      allowEditOwnCards: false,
      showReadyCheck: out.kind === 'semaforo',
      // Plan de acción: presentación opt-in (default on al crear / elegir el tipo).
      allowPresentation:
        out.kind === 'action_plan' ? !!input.allowPresentation : false,
      allowActionItems:
        out.kind === 'action_plan' || out.kind === 'semaforo_review',
      defaultSort: out.kind === 'action_plan' ? 'most_voted' : 'original',
      // Keep custom semáforo emojis on fixed-design phases.
      semaforoEmojis: normalizeSemaforoEmojis(input.semaforoEmojis),
    });
    // Preserve kind-specific flags set above; ignore board toggles from input.
    return { ...input, ...out };
  }

  if (!out.allowCreateCards) {
    out.cardContent = 'text_and_image';
    out.maxCardsPerParticipant = null;
    out.allowEditOwnCards = false;
  }

  if (out.othersVisibility !== 'visible') {
    if (out.anonymousCards) {
      warnings.push(
        'Con tarjetas borrosas/ocultas el anónimo no tiene efecto.',
      );
    }
    out.anonymousCards = false;
  }

  if (out.revealOnReady) {
    if (out.othersVisibility === 'visible') {
      out.revealOnReady = false;
    } else {
      out.showReadyCheck = true;
    }
  }

  const canInteract =
    out.othersVisibility === 'visible' || out.revealOnReady === true;

  if (!canInteract) {
    out.allowGrouping = false;
    out.allowCrossColumnGrouping = false;
    out.voting = 'off';
    out.allowReactions = false;
    out.allowPresentation = false;
    out.defaultSort = 'original';
    out.hideVoteCounts = false;
  }

  if (!out.allowGrouping) {
    out.allowCrossColumnGrouping = false;
  }

  if (out.voting !== 'off' && out.allowReactions) {
    // Reactions replace voting — prefer the last intent: keep reactions, turn off voting.
    out.voting = 'off';
    warnings.push('Las reacciones reemplazan la votación.');
  }

  if (out.voting === 'off' && !out.allowReactions) {
    out.hideVoteCounts = false;
    if (
      out.defaultSort === 'most_voted' ||
      out.defaultSort === 'least_voted'
    ) {
      out.defaultSort = 'original';
    }
  }

  if (out.allowReactions) {
    const cleaned = out.reactionEmojis
      .map((e) => e.trim())
      .filter(Boolean);
    out.reactionEmojis = cleaned.length ? cleaned : [...DEFAULT_EMOJIS];
  }

  void warnings;
  return { ...input, ...out };
}

/** Derive effective capability flags + UI disabled reasons for an already-normalized phase. */
export function phaseCapabilities(
  input: PhaseCapabilitiesInput,
): PhaseCapabilityFlags {
  const phase = normalizePhase(input);
  const disabledReasons: Record<string, string> = {};
  const warnings: string[] = [];
  const isBoard = phase.kind === 'board';

  if (!isBoard) {
    return {
      isBoard: false,
      allowCreateCards: false,
      cardContent: 'text_and_image',
      maxCardsPerParticipant: null,
      allowEditOwnCards: false,
      anonymousCards: false,
      othersVisibility: 'visible',
      revealOnReady: false,
      allowGrouping: false,
      allowCrossColumnGrouping: false,
      voting: 'off',
      hideVoteCounts: false,
      allowReactions: false,
      reactionEmojis: [...DEFAULT_EMOJIS],
      semaforoEmojis: normalizeSemaforoEmojis(phase.semaforoEmojis),
      allowPresentation:
        phase.kind === 'action_plan' && phase.allowPresentation,
      allowActionItems:
        phase.kind === 'action_plan' || phase.kind === 'semaforo_review',
      showReadyCheck: phase.kind === 'semaforo',
      defaultSort: phase.kind === 'action_plan' ? 'most_voted' : 'original',
      warnings,
      disabledReasons: {
        board: 'Sólo aplica a fases de tablero',
      },
    };
  }

  if (!phase.allowCreateCards) {
    disabledReasons['cardContent'] = 'Requiere permitir crear tarjetas';
    disabledReasons['maxCardsPerParticipant'] =
      'Requiere permitir crear tarjetas';
    disabledReasons['allowEditOwnCards'] = 'Requiere permitir crear tarjetas';
  }

  if (phase.othersVisibility !== 'visible') {
    disabledReasons['anonymousCards'] =
      'Sin efecto: con tarjetas borrosas/ocultas ya no se ve el autor';
  }

  if (phase.othersVisibility === 'visible') {
    disabledReasons['revealOnReady'] =
      'Sólo aplica cuando las tarjetas de otros están borrosas u ocultas';
  }

  const canInteract =
    phase.othersVisibility === 'visible' || phase.revealOnReady;

  if (!canInteract) {
    const reason =
      'No se puede operar sobre tarjetas que nunca se revelan';
    disabledReasons['allowGrouping'] = reason;
    disabledReasons['voting'] = reason;
    disabledReasons['allowReactions'] = reason;
    disabledReasons['allowPresentation'] = reason;
    disabledReasons['defaultSort'] = reason;
  }

  if (!phase.allowGrouping) {
    disabledReasons['allowCrossColumnGrouping'] =
      'Requiere permitir agrupar tarjetas';
  }

  if (phase.voting !== 'off') {
    disabledReasons['allowReactions'] =
      'Las reacciones reemplazan la votación';
  }
  if (phase.allowReactions) {
    disabledReasons['voting'] = 'Las reacciones reemplazan la votación';
  }

  if (phase.voting === 'off' && !phase.allowReactions) {
    disabledReasons['hideVoteCounts'] =
      'Requiere votación o reacciones activas';
    disabledReasons['defaultSortVoted'] =
      'Requiere votación o reacciones para ordenar por votos';
  }

  if (phase.revealOnReady) {
    disabledReasons['showReadyCheck'] =
      'Forzado: sin checkbox no hay forma de revelar';
  }

  if (phase.voting === 'single') {
    warnings.push(
      '"Un voto" fija en 1 el máximo de votos por comentario.',
    );
  }

  return {
    isBoard: true,
    allowCreateCards: phase.allowCreateCards,
    cardContent: phase.cardContent,
    maxCardsPerParticipant: phase.maxCardsPerParticipant,
    allowEditOwnCards: phase.allowEditOwnCards,
    anonymousCards: phase.anonymousCards,
    othersVisibility: phase.othersVisibility,
    revealOnReady: phase.revealOnReady,
    allowGrouping: phase.allowGrouping,
    allowCrossColumnGrouping: phase.allowCrossColumnGrouping,
    voting: phase.voting,
    hideVoteCounts: phase.hideVoteCounts,
    allowReactions: phase.allowReactions,
    reactionEmojis: phase.reactionEmojis,
    semaforoEmojis: phase.semaforoEmojis,
    allowPresentation: phase.allowPresentation,
    allowActionItems: phase.allowActionItems,
    showReadyCheck: phase.showReadyCheck,
    defaultSort: phase.defaultSort,
    warnings,
    disabledReasons,
  };
}

/** Resolve max cards for a participant in the current phase. */
export function resolveMaxCards(
  phaseMax: number | null | undefined,
  retroMax: number | null | undefined,
): number | null {
  if (phaseMax != null) return phaseMax;
  if (retroMax != null) return retroMax;
  return null;
}

export const SYSTEM_PHASE_IDS = {
  comments: 'sys_phase_comments',
  grouping: 'sys_phase_grouping',
  voting: 'sys_phase_voting',
  actions: 'sys_phase_actions',
  roti: 'sys_phase_roti',
  semaforo: 'sys_phase_semaforo',
  semaforo_review: 'sys_phase_semaforo_review',
} as const;

export const DEFAULT_CLASSIC_PHASE_IDS = [
  SYSTEM_PHASE_IDS.comments,
  SYSTEM_PHASE_IDS.grouping,
  SYSTEM_PHASE_IDS.voting,
  SYSTEM_PHASE_IDS.actions,
  SYSTEM_PHASE_IDS.roti,
] as const;

export const DEFAULT_SEMAFORO_ITEMS = [
  {
    title: 'Comunicación',
    description: '¿Hubo buena comunicación?',
  },
  {
    title: 'Tareas asignadas',
    description: '¿Te gustaron las tareas asignadas?',
  },
] as const;

export function snapshotPhaseFields(phase: {
  id: string;
  name: string;
  description: string | null;
  kind: PhaseKind;
  icon: string | null;
  color: string | null;
  instructions: string | null;
  timerSeconds: number | null;
  allowCreateCards: boolean;
  cardContent: CardContentMode;
  maxCardsPerParticipant: number | null;
  allowEditOwnCards: boolean;
  anonymousCards: boolean;
  othersVisibility: OthersVisibility;
  revealOnReady: boolean;
  allowGrouping: boolean;
  allowCrossColumnGrouping: boolean;
  voting: VotingMode;
  hideVoteCounts: boolean;
  allowReactions: boolean;
  reactionEmojis: string[];
  semaforoEmojis: string[];
  allowPresentation: boolean;
  allowActionItems: boolean;
  showReadyCheck: boolean;
  defaultSort: CardSort;
}) {
  const normalized = normalizePhase(phase);
  return {
    sourcePhaseId: phase.id,
    name: phase.name,
    description: phase.description,
    kind: normalized.kind,
    icon: phase.icon,
    color: phase.color,
    instructions: phase.instructions,
    timerSeconds: phase.timerSeconds,
    allowCreateCards: normalized.allowCreateCards,
    cardContent: normalized.cardContent,
    maxCardsPerParticipant: normalized.maxCardsPerParticipant,
    allowEditOwnCards: normalized.allowEditOwnCards,
    anonymousCards: normalized.anonymousCards,
    othersVisibility: normalized.othersVisibility,
    revealOnReady: normalized.revealOnReady,
    allowGrouping: normalized.allowGrouping,
    allowCrossColumnGrouping: normalized.allowCrossColumnGrouping,
    voting: normalized.voting,
    hideVoteCounts: normalized.hideVoteCounts,
    allowReactions: normalized.allowReactions,
    reactionEmojis: normalized.reactionEmojis,
    semaforoEmojis: normalized.semaforoEmojis,
    allowPresentation: normalized.allowPresentation,
    allowActionItems: normalized.allowActionItems,
    showReadyCheck: normalized.showReadyCheck,
    defaultSort: normalized.defaultSort,
  };
}
