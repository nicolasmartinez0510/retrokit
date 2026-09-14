import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  HostListener,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { parseAvatarChanged } from '../../core/avatars';
import { httpErrorMessage } from '../../core/http-error';
import {
  ActionAssigneeOption,
  ActionItem,
  ActionLinkedCard,
  Card,
  Participant,
  PHASE_LABELS,
  PHASES,
  RetroBoard,
  RetroColumn,
  RetroStatus,
} from '../../core/models';
import { formatDueDate } from '../../core/dates';
import { ActionItemModalComponent } from '../../shared/action-item-modal.component';
import type { ActionItemSavePayload } from '../../shared/action-item-modal.component';
import {
  fireConfettiBurst,
  prefersReducedMotion,
} from '../../core/confetti';
import { SocketService } from '../../core/socket.service';
import {
  armTimerChime,
  disarmTimerChime,
  playTimerChime,
} from '../../core/timer-chime';
import { ToastService } from '../../core/toast.service';
import { AutosizeTextareaDirective } from '../../shared/autosize-textarea.directive';
import { EmojiPickerComponent } from '../../shared/emoji-picker.component';
import { UserAvatarComponent } from '../../shared/user-avatar.component';

type SortMode = 'most' | 'least' | 'original';
type VoteFilter = 'all' | 'voted';

type BoardCard = Card & {
  isGroup?: boolean;
  groupSize?: number;
  members?: Card[];
};

type StackAuthor = {
  authorId: string;
  authorName: string;
  authorAvatarId: string;
  ownerId?: string;
};

export interface RetroAccessDenied {
  teamId: string;
  teamName: string;
  pendingRequest: boolean;
}

const spectateKey = (id: string) => `retrokit:spectate:${id}`;

const CARD_IMAGE_ACCEPT = 'image/png,image/jpeg,image/webp,image/gif';
const CARD_IMAGE_MIMES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
]);
const CARD_IMAGE_MAX_BYTES = 3 * 1024 * 1024;

@Component({
  selector: 'app-retro-page',
  imports: [
    FormsModule,
    NgTemplateOutlet,
    RouterLink,
    AutosizeTextareaDirective,
    EmojiPickerComponent,
    UserAvatarComponent,
    ActionItemModalComponent,
  ],
  templateUrl: './retro.page.html',
  styleUrl: './retro.page.scss',
})
export class RetroPage implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly sockets = inject(SocketService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private retroId = '';
  private readonly refreshBoard = () => {
    if (this.retroId) this.reload(this.retroId);
  };
  private readonly onRetroDeleted = () => {
    const teamId = this.retro()?.teamId;
    void this.router.navigate(teamId ? ['/teams', teamId] : ['/dashboard']);
  };
  private readonly boardEvents = [
    'phase-changed',
    'card-created',
    'card-updated',
    'card-deleted',
    'cards-grouped',
    'votes-updated',
    'settings-changed',
    'timer-updated',
    'action-created',
    'participant-joined',
    'comments-ready-changed',
    'votes-ready-changed',
  ] as const;

  retro = signal<RetroBoard | null>(null);
  error = signal('');
  loadError = signal('');
  accessDenied = signal<RetroAccessDenied | null>(null);
  requestingJoin = signal(false);
  draft: Record<string, string> = {};
  draftImage: Record<string, File | null> = {};
  draftPreview: Record<string, string | null> = {};
  anonymousDraft = false;
  editingCardId: string | null = null;
  editDraft = '';
  editAnonymous = false;
  editImageUrl: string | null = null;
  editImageFile: File | null = null;
  editImagePreview: string | null = null;
  editRemoveImage = false;
  readonly imageAccept = CARD_IMAGE_ACCEPT;
  selectedCardId = signal<string | null>(null);
  expandedGroupIds = signal<ReadonlySet<string>>(new Set());
  sortMode = signal<SortMode>('most');
  voteFilter = signal<VoteFilter>('voted');
  selectedThemeIds = signal<ReadonlySet<string>>(new Set());
  presentArmed = signal(false);
  presentDir = signal<'next' | 'prev' | 'in'>('in');
  private lastPresentIndex = -1;
  showActionModal = signal(false);
  actionSaving = signal(false);
  actionFormTitle = '';
  actionFormDescription = '';
  actionFormOwnerId = '';
  actionFormDueDate = '';
  actionFormCardId: string | null = null;
  actionFormGroupId: string | null = null;
  actionFormLinked: ActionLinkedCard[] = [];
  showSettings = false;
  showInvite = false;
  showJoinModal = signal(false);
  joining = signal(false);
  copiedKind = signal<'guest' | 'member' | null>(null);
  copyToast = signal('');
  private copyToastTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly localConfettiIds = new Set<string>();
  private lastLocalConfettiAt = 0;
  private readonly onConfetti = (payload: unknown) => {
    const id =
      payload && typeof payload === 'object' && 'id' in payload
        ? String((payload as { id: unknown }).id)
        : '';
    if (!id || this.localConfettiIds.has(id)) return;
    this.playConfetti();
  };
  rotiScore = 4;
  rotiComment = '';
  timerLeft = signal<number | null>(null);
  private timerHandle: ReturnType<typeof setInterval> | null = null;

  // settings form
  maxComments: number | null = 3;
  votesPerParticipant = 5;
  maxVotesPerCard = 2;
  timerSeconds = 300;
  readonly timerPresets = [
    { value: 300, label: '5 min' },
    { value: 600, label: '10 min' },
    { value: 900, label: '15 min' },
  ];

  phases = PHASES;
  nextPhase = computed(() => {
    const status = this.retro()?.status;
    if (!status) return null;
    const idx = PHASES.findIndex((p) => p.key === status);
    if (idx < 0 || idx >= PHASES.length - 1) {
      return status === 'roti' ? ('closed' as RetroStatus) : null;
    }
    return PHASES[idx + 1].key;
  });
  prevPhase = computed(() => {
    const status = this.retro()?.status;
    if (!status) return null;
    const idx = PHASES.findIndex((p) => p.key === status);
    if (idx <= 0) return null;
    return PHASES[idx - 1].key;
  });
  dockNextPhase = computed(() => {
    const next = this.nextPhase();
    if (!next || next === 'closed') return null;
    return next;
  });

  phaseLabel(status: RetroStatus) {
    return PHASE_LABELS[status];
  }

  toggleInvite() {
    this.showInvite = !this.showInvite;
    if (this.showInvite) this.showSettings = false;
  }

  toggleSettings() {
    this.showSettings = !this.showSettings;
    if (this.showSettings) this.showInvite = false;
  }

  isParticipant = computed(() => !!this.retro()?.me?.participantId);

  isSpectator = computed(
    () =>
      !!this.retro() && this.auth.isUser() && !this.isParticipant(),
  );

  isFacilitator = computed(
    () =>
      !!this.retro()?.me?.isFacilitator && this.isParticipant(),
  );

  isPresenting = computed(() => {
    const r = this.retro();
    return r?.status === 'actions' && !!r.presenterCardId;
  });

  isTimerRunning = computed(() => {
    const left = this.timerLeft();
    return left !== null && left > 0 && !!this.retro()?.timerEndsAt;
  });

  isTimerPaused = computed(() => {
    const remaining = this.retro()?.timerPausedRemaining;
    return remaining != null && remaining > 0 && !this.isTimerRunning();
  });

  timerDisplaySeconds() {
    const left = this.timerLeft();
    if (left !== null) return left;
    const paused = this.retro()?.timerPausedRemaining;
    if (paused != null) return paused;
    return this.timerSeconds;
  }

  canComment = computed(() => {
    const r = this.retro();
    if (!r?.me?.participantId) return false;
    if (r.status !== 'comments' && r.status !== 'grouping') return false;
    if (r.maxCommentsPerParticipant == null) return true;
    return r.me.myCommentCount < r.maxCommentsPerParticipant;
  });

  readyLocked = computed(() => {
    const r = this.retro();
    if (!r?.me?.participantId) return true;
    if (r.status === 'voting') {
      return r.me.myVoteTotal >= r.votesPerParticipant;
    }
    if (r.status !== 'comments' && r.status !== 'grouping') return false;
    if (r.maxCommentsPerParticipant == null) return false;
    return r.me.myCommentCount >= r.maxCommentsPerParticipant;
  });

  ngOnInit() {
    this.retroId = this.route.snapshot.paramMap.get('id')!;
    this.reload(this.retroId);
    this.sockets.joinRetro(this.retroId);
    for (const event of this.boardEvents) {
      this.sockets.on(event, this.refreshBoard);
    }
    this.sockets.on('retro-deleted', this.onRetroDeleted);
    this.sockets.on('confetti', this.onConfetti);
    this.sockets.on('avatar-changed', this.onAvatarChanged);
    this.sockets.on('presenter-changed', this.onPresenterChanged);
  }

  ngOnDestroy() {
    if (this.timerHandle) clearInterval(this.timerHandle);
    disarmTimerChime();
    if (this.copyToastTimer) clearTimeout(this.copyToastTimer);
    for (const event of this.boardEvents) {
      this.sockets.off(event, this.refreshBoard);
    }
    this.sockets.off('retro-deleted', this.onRetroDeleted);
    this.sockets.off('confetti', this.onConfetti);
    this.sockets.off('avatar-changed', this.onAvatarChanged);
    this.sockets.off('presenter-changed', this.onPresenterChanged);
    this.clearAllDraftPreviews();
    this.clearEditImagePreview();
    this.sockets.leaveRetro(this.retroId);
    if (!this.auth.isUser()) this.sockets.disconnect();
  }

  throwConfetti() {
    const r = this.retro();
    if (!r) return;
    const now = Date.now();
    if (now - this.lastLocalConfettiAt < 1000) return;
    this.lastLocalConfettiAt = now;
    const id = crypto.randomUUID();
    this.localConfettiIds.add(id);
    window.setTimeout(() => this.localConfettiIds.delete(id), 4000);
    this.playConfetti();
    this.sockets.emit('throw-confetti', { retroId: r.id, id });
  }

  private playConfetti() {
    if (prefersReducedMotion()) {
      this.copyToast.set('🎉');
      if (this.copyToastTimer) clearTimeout(this.copyToastTimer);
      this.copyToastTimer = setTimeout(() => this.copyToast.set(''), 1600);
      return;
    }
    fireConfettiBurst();
  }

  reload(id = this.retro()?.id) {
    if (!id) return;
    this.api.getRetro(id).subscribe({
      next: (r) => {
        this.accessDenied.set(null);
        this.loadError.set('');
        this.retro.set(r);
        if (r.status !== 'grouping') this.selectedCardId.set(null);
        if (r.status !== 'actions') {
          this.presentArmed.set(false);
          this.lastPresentIndex = -1;
        }
        this.maxComments = r.maxCommentsPerParticipant;
        this.votesPerParticipant = r.votesPerParticipant;
        this.maxVotesPerCard = r.maxVotesPerCard;
        this.timerSeconds = r.timerSeconds ?? 300;
        this.syncTimer(r.timerEndsAt);
        this.maybeShowJoinModal(r);
      },
      error: (e) => {
        const denied = parseNotTeamMember(e);
        if (denied) {
          this.accessDenied.set(denied);
          this.loadError.set('');
          return;
        }
        this.accessDenied.set(null);
        this.loadError.set(httpErrorMessage(e, 'Error al cargar'));
      },
    });
  }

  requestJoin() {
    if (!this.retroId || this.requestingJoin()) return;
    this.requestingJoin.set(true);
    this.error.set('');
    this.api.requestTeamJoin(this.retroId).subscribe({
      next: () => {
        this.toast.ok('Solicitud enviada. El facilitador la va a revisar.');
        void this.router.navigate(['/dashboard']);
      },
      error: (e) => {
        this.requestingJoin.set(false);
        this.error.set(
          httpErrorMessage(e, 'No se pudo enviar la solicitud'),
        );
      },
    });
  }

  private maybeShowJoinModal(r: RetroBoard) {
    if (!this.auth.isUser()) {
      this.showJoinModal.set(false);
      return;
    }
    if (r.me?.participantId) {
      this.showJoinModal.set(false);
      this.clearSpectateChoice(r.id);
      return;
    }
    if (r.status === 'closed') {
      this.showJoinModal.set(false);
      return;
    }
    if (this.hasSpectateChoice(r.id)) {
      this.showJoinModal.set(false);
      return;
    }
    this.showJoinModal.set(true);
  }

  joinAsParticipant() {
    const r = this.retro();
    if (!r || this.joining()) return;
    this.joining.set(true);
    this.error.set('');
    this.api.joinRetroById(r.id).subscribe({
      next: () => {
        this.clearSpectateChoice(r.id);
        this.showJoinModal.set(false);
        this.joining.set(false);
        this.reload(r.id);
      },
      error: (e) => {
        this.joining.set(false);
        this.error.set(e?.error?.message || 'No se pudo unir a la retrospectiva');
      },
    });
  }

  chooseSpectate() {
    const r = this.retro();
    if (!r) return;
    this.rememberSpectateChoice(r.id);
    this.showJoinModal.set(false);
  }

  private hasSpectateChoice(id: string): boolean {
    try {
      return sessionStorage.getItem(spectateKey(id)) === '1';
    } catch {
      return false;
    }
  }

  private rememberSpectateChoice(id: string) {
    try {
      sessionStorage.setItem(spectateKey(id), '1');
    } catch {
      /* ignore quota / private mode */
    }
  }

  private clearSpectateChoice(id: string) {
    try {
      sessionStorage.removeItem(spectateKey(id));
    } catch {
      /* ignore */
    }
  }

  participantDisplayName(p: {
    guestName?: string | null;
    isGuest: boolean;
    user?: { name: string } | null;
  }): string {
    return p.guestName ?? p.user?.name ?? (p.isGuest ? 'Invitado' : 'Participante');
  }

  participantOwnerId(p: Participant): string {
    return p.user?.id ?? p.userId ?? p.id;
  }

  cardAuthorOwnerId(card: Card): string | undefined {
    if (!card.authorAvatarId) return undefined;
    const author =
      card.author ??
      this.retro()?.participants.find((p) => p.id === card.authorId);
    return author ? this.participantOwnerId(author) : undefined;
  }

  private readonly onAvatarChanged = (payload: unknown) => {
    const event = parseAvatarChanged(payload);
    const board = this.retro();
    if (!event || !board) return;
    const next = applyAvatarChanged(board, event);
    if (next !== board) this.retro.set(next);
  };

  private readonly onPresenterChanged = (payload: unknown) => {
    const presenterCardId = parsePresenterCardId(payload);
    this.applyPresenterCardId(presenterCardId);
  };

  cardsForColumn(columnId: string, opts?: { sort?: boolean }): BoardCard[] {
    const r = this.retro();
    if (!r) return [];
    let cards: BoardCard[] = r.cards.filter(
      (c) => c.columnId === columnId && !c.groupId,
    );
    const grouped = r.groups
      .map((g): BoardCard | null => {
        const members = r.cards
          .filter((c) => c.groupId === g.id)
          .sort(
            (a, b) =>
              a.position - b.position || a.createdAt.localeCompare(b.createdAt),
          );
        if (!members.length) return null;
        const header = members[0];
        if (header.columnId !== columnId) return null;
        return {
          ...header,
          isGroup: members.length > 1,
          groupId: g.id,
          groupSize: members.length,
          members,
        };
      })
      .filter((row): row is BoardCard => !!row);

    cards = [...cards, ...grouped];

    const shouldSort = opts?.sort !== false && r.status === 'actions';
    if (shouldSort) {
      const mode = this.sortMode();
      if (mode !== 'original') {
        cards = [...cards].sort((a, b) => {
          const va = this.voteCount(a);
          const vb = this.voteCount(b);
          return mode === 'most' ? vb - va : va - vb;
        });
      }
    }
    return cards;
  }

  isGroupCard(card: BoardCard): boolean {
    return !!card.isGroup && (card.groupSize ?? 0) > 1;
  }

  isStackExpanded(card: BoardCard): boolean {
    return !!card.groupId && this.expandedGroupIds().has(card.groupId);
  }

  visibleStackMembers(card: BoardCard): Card[] {
    if (!this.isGroupCard(card) || !card.members?.length) return [card];
    if (this.isStackExpanded(card)) return card.members;
    return [card.members[0]];
  }

  stackAuthorAvatars(card: BoardCard): StackAuthor[] {
    const members = card.members?.length ? card.members : [card];
    const seen = new Set<string>();
    const authors: StackAuthor[] = [];
    for (const member of members) {
      if (member.hidden || member.isAnonymous || !member.authorAvatarId) {
        continue;
      }
      if (seen.has(member.authorId)) continue;
      seen.add(member.authorId);
      authors.push({
        authorId: member.authorId,
        authorName: member.authorName ?? '',
        authorAvatarId: member.authorAvatarId,
        ownerId: this.cardAuthorOwnerId(member),
      });
    }
    return authors;
  }

  isGroupTarget(card: BoardCard): boolean {
    const selectedId = this.selectedCardId();
    if (!selectedId || card.hidden) return false;
    if (card.id === selectedId) return false;
    const r = this.retro();
    const selected = r?.cards.find((c) => c.id === selectedId);
    if (selected?.groupId && card.groupId && selected.groupId === card.groupId) {
      return false;
    }
    return true;
  }

  isGroupingSelect(card: BoardCard): boolean {
    const r = this.retro();
    return (
      r?.status === 'grouping' &&
      this.isParticipant() &&
      !this.editingCardId
    );
  }

  toggleStack(card: BoardCard, event?: Event) {
    event?.stopPropagation();
    if (!this.isGroupCard(card) || !card.groupId) return;
    const next = new Set(this.expandedGroupIds());
    if (next.has(card.groupId)) next.delete(card.groupId);
    else next.add(card.groupId);
    this.expandedGroupIds.set(next);
  }

  onBoardCardClick(card: BoardCard, event?: Event) {
    const r = this.retro();
    if (!r || this.editingCardId) return;
    if (this.isGroupingSelect(card)) {
      this.selectForGroup(card.id);
      return;
    }
    if (
      (r.status === 'voting' || r.status === 'actions') &&
      this.isGroupCard(card)
    ) {
      this.toggleStack(card, event);
    }
  }

  onStackArticleClick(member: Card, card: BoardCard, event: Event) {
    if (member.id !== card.id) {
      event.stopPropagation();
      return;
    }
    this.onBoardCardClick(card, event);
    event.stopPropagation();
  }

  @HostListener('pointerdown')
  armChimeOnGesture() {
    if (this.isTimerRunning() || this.isTimerPaused()) armTimerChime();
  }

  @HostListener('document:keydown', ['$event'])
  onDocumentKeydown(event: KeyboardEvent) {
    if (this.isTypingTarget(event.target)) return;
    if (this.showJoinModal() || this.showActionModal()) return;

    if (event.key === 'Escape') {
      if (this.showSettings) {
        this.showSettings = false;
        return;
      }
      if (this.showInvite) {
        this.showInvite = false;
        return;
      }
      if (this.editingCardId) return;
      if (this.selectedCardId()) {
        this.selectedCardId.set(null);
        return;
      }
      if (this.isPresenting() && this.isFacilitator()) {
        event.preventDefault();
        this.stopPresenting();
      }
      return;
    }

    if (!this.isFacilitator() || this.retro()?.status !== 'actions') return;
    if (this.showSettings || this.showInvite) return;

    if (event.key === 'p' || event.key === 'P') {
      event.preventDefault();
      this.setPresentArmed(!this.presentArmed());
      return;
    }

    if (!this.isPresenting()) return;
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.presentPrev();
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      this.presentNext();
    }
  }

  private isTypingTarget(target: EventTarget | null) {
    if (!(target instanceof HTMLElement)) return false;
    const tag = target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
    return target.isContentEditable;
  }

  voteCount(card: Card): number {
    const r = this.retro();
    if (!r) return 0;
    if (card.groupId) {
      return r.votes
        .filter((v) => v.groupId === card.groupId)
        .reduce((s, v) => s + v.count, 0);
    }
    return r.votes
      .filter((v) => v.cardId === card.id)
      .reduce((s, v) => s + v.count, 0);
  }

  myVotesOn(card: Card): number {
    const r = this.retro();
    const pid = r?.me?.participantId;
    if (!r || !pid) return 0;
    const v = r.votes.find(
      (x) =>
        x.participantId === pid &&
        (card.groupId ? x.groupId === card.groupId : x.cardId === card.id),
    );
    return v?.count ?? 0;
  }

  canSubmitComposer(columnId: string): boolean {
    const content = (this.draft[columnId] || '').trim();
    return !!content || !!this.draftImage[columnId];
  }

  addCard(columnId: string) {
    const r = this.retro();
    const content = (this.draft[columnId] || '').trim();
    const image = this.draftImage[columnId] ?? null;
    if (!r || (!content && !image)) return;
    this.api
      .createCard(r.id, {
        columnId,
        content,
        isAnonymous: this.anonymousDraft,
        image,
      })
      .subscribe({
        next: () => {
          this.draft[columnId] = '';
          this.clearDraftImage(columnId);
          this.reload(r.id);
        },
        error: (e) => this.error.set(e?.error?.message || 'No se pudo agregar'),
      });
  }

  insertEmojiIntoDraft(columnId: string, emoji: string, ta: HTMLTextAreaElement) {
    const current = this.draft[columnId] || '';
    const start = ta.selectionStart ?? current.length;
    const end = ta.selectionEnd ?? current.length;
    this.draft[columnId] =
      current.slice(0, start) + emoji + current.slice(end);
    queueMicrotask(() => {
      ta.focus();
      const pos = start + emoji.length;
      ta.setSelectionRange(pos, pos);
    });
  }

  insertEmojiIntoEdit(emoji: string, ta: HTMLTextAreaElement) {
    const current = this.editDraft || '';
    const start = ta.selectionStart ?? current.length;
    const end = ta.selectionEnd ?? current.length;
    this.editDraft = current.slice(0, start) + emoji + current.slice(end);
    queueMicrotask(() => {
      ta.focus();
      const pos = start + emoji.length;
      ta.setSelectionRange(pos, pos);
    });
  }

  onDraftFile(columnId: string, event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    input.value = '';
    this.setDraftImage(columnId, file);
  }

  onDraftPaste(columnId: string, event: ClipboardEvent) {
    const file = this.imageFromClipboard(event);
    if (!file) return;
    event.preventDefault();
    this.setDraftImage(columnId, file);
  }

  clearDraftImage(columnId: string) {
    const prev = this.draftPreview[columnId];
    if (prev) URL.revokeObjectURL(prev);
    this.draftImage[columnId] = null;
    this.draftPreview[columnId] = null;
  }

  private setDraftImage(columnId: string, file: File | null) {
    if (!file) {
      this.clearDraftImage(columnId);
      return;
    }
    const err = this.validateImageFile(file);
    if (err) {
      this.error.set(err);
      return;
    }
    this.clearDraftImage(columnId);
    this.draftImage[columnId] = file;
    this.draftPreview[columnId] = URL.createObjectURL(file);
  }

  private clearAllDraftPreviews() {
    for (const key of Object.keys(this.draftPreview)) {
      this.clearDraftImage(key);
    }
  }

  isOwnCard(card: Card): boolean {
    const pid = this.retro()?.me?.participantId;
    return !!pid && card.authorId === pid;
  }

  canEditCard(card: Card & { isGroup?: boolean }): boolean {
    const r = this.retro();
    if (!r) return false;
    if (r.status !== 'comments' && r.status !== 'grouping') return false;
    if (card.hidden || card.isGroup) return false;
    return this.isOwnCard(card);
  }

  canDeleteCard(card: Card & { isGroup?: boolean }): boolean {
    const r = this.retro();
    if (!r) return false;
    if (r.status !== 'comments' && r.status !== 'grouping') return false;
    if (card.hidden) return false;
    return this.isOwnCard(card) || !!r.me?.isFacilitator;
  }

  startEdit(card: Card, event: Event) {
    event.stopPropagation();
    if (!this.canEditCard(card)) return;
    this.clearEditImagePreview();
    this.editingCardId = card.id;
    this.editDraft = card.content;
    this.editAnonymous = card.isAnonymous;
    this.editImageUrl = card.imageUrl ?? null;
    this.editImageFile = null;
    this.editRemoveImage = false;
  }

  cancelEdit(event?: Event) {
    event?.stopPropagation();
    this.editingCardId = null;
    this.editDraft = '';
    this.editAnonymous = false;
    this.clearEditImagePreview();
    this.editImageUrl = null;
    this.editImageFile = null;
    this.editRemoveImage = false;
  }

  canSaveEdit(card: Card): boolean {
    const content = this.editDraft.trim();
    const hasImage =
      !!this.editImageFile || (!!this.editImageUrl && !this.editRemoveImage);
    return !!content || hasImage;
  }

  onEditFile(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    input.value = '';
    if (!file) return;
    const err = this.validateImageFile(file);
    if (err) {
      this.error.set(err);
      return;
    }
    this.clearEditImagePreview();
    this.editImageFile = file;
    this.editImagePreview = URL.createObjectURL(file);
    this.editRemoveImage = false;
  }

  onEditPaste(event: ClipboardEvent) {
    const file = this.imageFromClipboard(event);
    if (!file) return;
    event.preventDefault();
    const err = this.validateImageFile(file);
    if (err) {
      this.error.set(err);
      return;
    }
    this.clearEditImagePreview();
    this.editImageFile = file;
    this.editImagePreview = URL.createObjectURL(file);
    this.editRemoveImage = false;
  }

  removeEditImage(event: Event) {
    event.stopPropagation();
    this.clearEditImagePreview();
    this.editImageFile = null;
    if (this.editImageUrl) {
      this.editRemoveImage = true;
    }
  }

  saveEdit(card: Card, event: Event) {
    event.stopPropagation();
    const r = this.retro();
    const content = this.editDraft.trim();
    if (!r || !this.canEditCard(card) || !this.canSaveEdit(card)) return;

    const afterContent = () => {
      if (this.editImageFile) {
        this.api.uploadCardImage(r.id, card.id, this.editImageFile).subscribe({
          next: () => {
            this.cancelEdit();
            this.reload(r.id);
          },
          error: (e) =>
            this.error.set(
              e?.error?.message || 'No se pudo subir la imagen',
            ),
        });
        return;
      }
      if (this.editRemoveImage && card.imageUrl) {
        this.api.deleteCardImage(r.id, card.id).subscribe({
          next: () => {
            this.cancelEdit();
            this.reload(r.id);
          },
          error: (e) =>
            this.error.set(
              e?.error?.message || 'No se pudo quitar la imagen',
            ),
        });
        return;
      }
      this.cancelEdit();
      this.reload(r.id);
    };

    this.api
      .updateCard(r.id, card.id, {
        content,
        isAnonymous: r.allowAnonymous ? this.editAnonymous : undefined,
      })
      .subscribe({
        next: () => afterContent(),
        error: (e) =>
          this.error.set(e?.error?.message || 'No se pudo guardar el comentario'),
      });
  }

  cardImages(card: Card): string[] {
    if (card.imageUrl) return [card.imageUrl];
    return [];
  }

  private clearEditImagePreview() {
    if (this.editImagePreview) {
      URL.revokeObjectURL(this.editImagePreview);
      this.editImagePreview = null;
    }
  }

  private validateImageFile(file: File): string | null {
    if (!CARD_IMAGE_MIMES.has(file.type)) {
      return 'Solo se permiten PNG, JPEG, WebP o GIF';
    }
    if (file.size > CARD_IMAGE_MAX_BYTES) {
      return 'La imagen no puede superar 3 MB';
    }
    return null;
  }

  private imageFromClipboard(event: ClipboardEvent): File | null {
    const items = event.clipboardData?.items;
    if (!items) return null;
    for (const item of Array.from(items)) {
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        return item.getAsFile();
      }
    }
    return null;
  }

  deleteCard(card: Card, event: Event) {
    event.stopPropagation();
    const r = this.retro();
    if (!r || !this.canDeleteCard(card)) return;
    if (!confirm('¿Borrar este comentario? Esta acción no se puede deshacer.')) {
      return;
    }
    this.api.deleteCard(r.id, card.id).subscribe({
      next: () => {
        if (this.editingCardId === card.id) this.cancelEdit();
        if (this.selectedCardId() === card.id) this.selectedCardId.set(null);
        this.reload(r.id);
      },
      error: (e) =>
        this.error.set(e?.error?.message || 'No se pudo borrar el comentario'),
    });
  }

  toggleCommentsReady(ready: boolean) {
    const r = this.retro();
    if (!r || this.readyLocked()) return;
    this.api.setCommentsReady(r.id, ready).subscribe({
      next: () => this.reload(r.id),
      error: (e) =>
        this.error.set(e?.error?.message || 'No se pudo actualizar el estado'),
    });
  }

  toggleVotesReady(ready: boolean) {
    const r = this.retro();
    if (!r || this.readyLocked()) return;
    this.api.setCommentsReady(r.id, ready).subscribe({
      next: () => this.reload(r.id),
      error: (e) =>
        this.error.set(e?.error?.message || 'No se pudo actualizar el estado'),
    });
  }

  selectForGroup(cardId: string) {
    const r = this.retro();
    if (!r || r.status !== 'grouping' || this.isSpectator()) return;
    const selectedId = this.selectedCardId();
    if (!selectedId) {
      this.selectedCardId.set(cardId);
      return;
    }
    if (selectedId === cardId) {
      this.selectedCardId.set(null);
      return;
    }
    const selected = r.cards.find((c) => c.id === selectedId);
    const clicked = r.cards.find((c) => c.id === cardId);
    if (selected?.groupId && clicked?.groupId === selected.groupId) {
      return;
    }
    const sourceId = selected?.groupId ? cardId : selectedId;
    const targetId = selected?.groupId ? selectedId : cardId;
    this.api.groupCards(r.id, sourceId, targetId).subscribe({
      next: () => {
        this.selectedCardId.set(null);
        this.reload(r.id);
      },
      error: (e) => this.error.set(e?.error?.message || 'No se pudo agrupar'),
    });
  }

  changeVote(card: Card, delta: number) {
    const r = this.retro();
    if (!r || this.isSpectator()) return;
    const next = Math.max(0, this.myVotesOn(card) + delta);
    if (next > r.maxVotesPerCard) {
      this.error.set(`Máximo ${r.maxVotesPerCard} votos por tarjeta`);
      return;
    }
    const body = card.groupId
      ? { groupId: card.groupId, count: next }
      : { cardId: card.id, count: next };
    this.api.vote(r.id, body).subscribe({
      next: () => this.reload(r.id),
      error: (e) => this.error.set(e?.error?.message || 'No se pudo votar'),
    });
  }

  advance() {
    const next = this.nextPhase();
    if (!next) return;
    this.goToPhase(next);
  }

  goToPhase(status: RetroStatus) {
    const r = this.retro();
    if (!r || !this.isFacilitator() || r.status === status) return;
    this.api.advancePhase(r.id, status).subscribe({
      next: () => {
        if (status === 'closed') {
          void this.router.navigate(['/retros', r.id, 'report']);
        } else {
          this.reload(r.id);
        }
      },
      error: (e) => this.error.set(e?.error?.message || 'No se pudo cambiar de fase'),
    });
  }

  saveSettings() {
    const r = this.retro();
    if (!r) return;
    this.api
      .updateSettings(r.id, {
        maxCommentsPerParticipant: this.maxComments,
        votesPerParticipant: this.votesPerParticipant,
        maxVotesPerCard: this.maxVotesPerCard,
        timerSeconds: this.timerSeconds,
      })
      .subscribe({
        next: () => {
          this.showSettings = false;
          this.reload(r.id);
        },
        error: (e) => this.error.set(e?.error?.message || 'Error al guardar'),
      });
  }

  playTimer() {
    armTimerChime();
    if (this.isTimerPaused()) {
      this.resumeTimer();
      return;
    }
    this.startTimer();
  }

  startTimer() {
    const r = this.retro();
    if (!r) return;
    armTimerChime();
    this.api.startTimer(r.id, this.timerSeconds).subscribe({
      next: () => this.reload(r.id),
    });
  }

  pauseTimer() {
    const r = this.retro();
    if (!r) return;
    this.api.pauseTimer(r.id).subscribe({ next: () => this.reload(r.id) });
  }

  resumeTimer() {
    const r = this.retro();
    if (!r) return;
    armTimerChime();
    this.api.resumeTimer(r.id).subscribe({ next: () => this.reload(r.id) });
  }

  addTimerMinute() {
    const r = this.retro();
    if (!r) return;
    this.api.addTimerSeconds(r.id, 60).subscribe({ next: () => this.reload(r.id) });
  }

  resetTimer() {
    this.startTimer();
  }

  stopTimer() {
    const r = this.retro();
    if (!r) return;
    this.api.stopTimer(r.id).subscribe({ next: () => this.reload(r.id) });
  }

  submitRoti() {
    const r = this.retro();
    if (!r) return;
    this.api.submitRoti(r.id, this.rotiScore, this.rotiComment).subscribe({
      next: () => this.advance(),
      error: (e) => this.error.set(e?.error?.message || 'Error ROTI'),
    });
  }

  actionPlanThemes(): RetroColumn[] {
    return this.retro()?.columns ?? [];
  }

  actionPlanItems(): BoardCard[] {
    const r = this.retro();
    if (!r) return [];
    let items: BoardCard[] = [];
    for (const col of r.columns) {
      if (!this.isThemeSelected(col.id)) continue;
      items = items.concat(this.cardsForColumn(col.id, { sort: false }));
    }
    if (this.voteFilter() === 'voted') {
      items = items.filter((card) => this.voteCount(card) >= 1);
    }
    const mode = this.sortMode();
    if (mode !== 'original') {
      items = [...items].sort((a, b) => {
        const va = this.voteCount(a);
        const vb = this.voteCount(b);
        return mode === 'most' ? vb - va : va - vb;
      });
    }
    return items;
  }

  presentationDeck(): BoardCard[] {
    return this.actionPlanItems();
  }

  canArmPresenting() {
    return this.isFacilitator() && this.retro()?.status === 'actions';
  }

  setPresentArmed(on: boolean) {
    if (!this.canArmPresenting()) return;
    this.presentArmed.set(on);
    if (!on) this.stopPresenting();
  }

  currentPresentItem(): BoardCard | null {
    const id = this.retro()?.presenterCardId;
    if (!id) return null;
    return this.findPresentItem(id);
  }

  presentIndex() {
    const item = this.currentPresentItem();
    if (!item) return -1;
    return this.presentationDeck().findIndex((row) => row.id === item.id);
  }

  canPresentPrev() {
    if (!this.isFacilitator() || !this.isPresenting()) return false;
    const deck = this.presentationDeck();
    if (!deck.length) return false;
    const index = this.presentIndex();
    return index < 0 || index > 0;
  }

  canPresentNext() {
    if (!this.isFacilitator() || !this.isPresenting()) return false;
    const deck = this.presentationDeck();
    if (!deck.length) return false;
    const index = this.presentIndex();
    return index < 0 || index < deck.length - 1;
  }

  presentSlideMembers(item: BoardCard): Card[] {
    if (this.isGroupCard(item)) return item.members ?? [item];
    return [item];
  }

  stopPresenting() {
    if (!this.isFacilitator()) return;
    this.setPresenterCard(null);
  }

  presentPrev() {
    const deck = this.presentationDeck();
    if (!deck.length) return;
    const index = this.presentIndex();
    const prev = index < 0 ? deck[deck.length - 1] : deck[index - 1];
    if (prev) this.setPresenterCard(prev.id);
  }

  presentNext() {
    const deck = this.presentationDeck();
    if (!deck.length) return;
    const index = this.presentIndex();
    const next = index < 0 ? deck[0] : deck[index + 1];
    if (next) this.setPresenterCard(next.id);
  }

  jumpToSlide(item: BoardCard, event: Event) {
    if (!this.presentArmed() || !this.isFacilitator()) return;
    if (this.retro()?.status !== 'actions') return;
    const target = event.target;
    if (target instanceof Element && target.closest('button')) return;
    this.setPresenterCard(item.id);
  }

  jumpToDeckIndex(index: number) {
    const item = this.presentationDeck()[index];
    if (item) this.setPresenterCard(item.id);
  }

  private setPresenterCard(cardId: string | null) {
    const r = this.retro();
    if (!r || !this.isFacilitator()) return;
    const previous = r.presenterCardId ?? null;
    if (previous === cardId) return;
    this.applyPresenterCardId(cardId);
    this.api.setPresenter(r.id, cardId).subscribe({
      next: ({ presenterCardId }) => {
        if ((this.retro()?.presenterCardId ?? null) === presenterCardId) return;
        this.applyPresenterCardId(presenterCardId);
      },
      error: (e) => {
        this.applyPresenterCardId(previous);
        this.error.set(
          e?.error?.message || 'No se pudo actualizar la presentación',
        );
      },
    });
  }

  private applyPresenterCardId(presenterCardId: string | null) {
    const board = this.retro();
    if (!board || board.presenterCardId === presenterCardId) return;
    this.notePresentTransition(presenterCardId);
    this.retro.set({ ...board, presenterCardId });
  }

  private notePresentTransition(nextId: string | null) {
    const nextIndex = nextId
      ? this.presentationDeck().findIndex((row) => row.id === nextId)
      : -1;
    if (
      this.lastPresentIndex >= 0 &&
      nextIndex >= 0 &&
      nextIndex !== this.lastPresentIndex
    ) {
      this.presentDir.set(nextIndex > this.lastPresentIndex ? 'next' : 'prev');
    } else {
      this.presentDir.set('in');
    }
    this.lastPresentIndex = nextIndex;
  }

  private findPresentItem(cardId: string): BoardCard | null {
    const inDeck = this.presentationDeck().find((item) => item.id === cardId);
    if (inDeck) return inDeck;
    const r = this.retro();
    if (!r) return null;
    const card = r.cards.find((c) => c.id === cardId);
    if (!card) return null;
    let headerId = card.id;
    if (card.groupId) {
      const members = r.cards
        .filter((c) => c.groupId === card.groupId)
        .sort(
          (a, b) =>
            a.position - b.position || a.createdAt.localeCompare(b.createdAt),
        );
      if (members[0]) headerId = members[0].id;
    }
    for (const col of r.columns) {
      const found = this.cardsForColumn(col.id, { sort: false }).find(
        (item) => item.id === headerId,
      );
      if (found) return found;
    }
    return null;
  }

  hasSelectedThemes() {
    return this.selectedThemeIds().size > 0;
  }

  isThemeSelected(columnId: string) {
    return this.selectedThemeIds().has(columnId);
  }

  toggleTheme(columnId: string) {
    this.selectedThemeIds.update((set) => {
      const current = new Set(set);
      if (current.has(columnId)) current.delete(columnId);
      else current.add(columnId);
      return current;
    });
  }

  themeVoteTotal(columnId: string) {
    return this.cardsForColumn(columnId, { sort: false })
      .filter(
        (card) => this.voteFilter() !== 'voted' || this.voteCount(card) >= 1,
      )
      .reduce((sum, card) => sum + this.voteCount(card), 0);
  }

  topicPreview(item: BoardCard): string {
    if (this.isGroupCard(item)) {
      const titled = this.groupHeading(item);
      if (titled !== 'Grupo') return titled;
      const first = (item.members ?? []).find((member) => member.content.trim());
      return first?.content.trim() || item.content.trim() || 'Grupo';
    }
    return item.content.trim() || 'Comentario';
  }

  groupHeading(item: BoardCard): string {
    const group = this.retro()?.groups.find((g) => g.id === item.groupId);
    return group?.title?.trim() || 'Grupo';
  }

  columnForCard(card: Pick<Card, 'columnId'>) {
    return this.retro()?.columns.find((col) => col.id === card.columnId);
  }

  planMembers(card: BoardCard): Card[] {
    if (this.isGroupCard(card)) return card.members ?? [card];
    return [card];
  }

  actionAssignees(): ActionAssigneeOption[] {
    const r = this.retro();
    if (!r) return [];
    const seen = new Set<string>();
    const people: ActionAssigneeOption[] = [];
    for (const participant of r.participants) {
      if (!participant.user || seen.has(participant.user.id)) continue;
      seen.add(participant.user.id);
      people.push({
        id: participant.user.id,
        name: participant.user.name,
        avatarId: participant.user.avatarId,
      });
    }
    return people;
  }

  linkedFromCard(card: Card): ActionLinkedCard {
    return {
      id: card.id,
      content: card.content,
      imageUrl: card.imageUrl,
      isAnonymous: card.isAnonymous,
      authorName: card.authorName,
      authorAvatarId: card.authorAvatarId,
      ownerId: card.author?.user?.id ?? null,
    };
  }

  openCreateActionFromTopic(item: BoardCard) {
    if (!this.isParticipant()) return;
    this.actionFormTitle = this.topicPreview(item).slice(0, 300);
    this.actionFormDescription = '';
    this.actionFormOwnerId = '';
    this.actionFormDueDate = '';
    if (this.isGroupCard(item)) {
      this.actionFormCardId = null;
      this.actionFormGroupId = item.groupId ?? null;
      this.actionFormLinked = this.planMembers(item).map((member) =>
        this.linkedFromCard(member),
      );
    } else {
      this.actionFormCardId = item.id;
      this.actionFormGroupId = null;
      this.actionFormLinked = [this.linkedFromCard(item)];
    }
    this.showActionModal.set(true);
  }

  openCreateAction() {
    if (!this.isParticipant()) return;
    this.actionFormTitle = '';
    this.actionFormDescription = '';
    this.actionFormOwnerId = '';
    this.actionFormDueDate = '';
    this.actionFormCardId = null;
    this.actionFormGroupId = null;
    this.actionFormLinked = [];
    this.showActionModal.set(true);
  }

  closeActionModal() {
    this.showActionModal.set(false);
    this.actionSaving.set(false);
  }

  saveActionFromModal(payload: ActionItemSavePayload) {
    const r = this.retro();
    if (!r) return;
    this.actionSaving.set(true);
    this.api
      .createRetroAction(r.id, {
        title: payload.title,
        description: payload.description || undefined,
        ownerId: payload.ownerId || undefined,
        dueDate: payload.dueDate || undefined,
        cardId: this.actionFormCardId || undefined,
        groupId: this.actionFormGroupId || undefined,
      })
      .subscribe({
        next: () => {
          this.actionSaving.set(false);
          this.showActionModal.set(false);
          this.reload(r.id);
        },
        error: (e) => {
          this.actionSaving.set(false);
          this.error.set(e?.error?.message || 'Error al crear acción');
        },
      });
  }

  actionOriginLabel(action: ActionItem): string | null {
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

  dueLabel(iso?: string | null) {
    return formatDueDate(iso);
  }

  inviteUrl(kind: 'guest' | 'member') {
    const r = this.retro();
    if (!r) return '';
    const code = kind === 'guest' ? r.guestInviteCode : r.memberInviteCode;
    return `${window.location.origin}/join/${code}`;
  }

  async copyInvite(kind: 'guest' | 'member') {
    try {
      await navigator.clipboard.writeText(this.inviteUrl(kind));
      this.copiedKind.set(kind);
      this.copyToast.set('Enlace copiado al portapapeles');
    } catch {
      this.copiedKind.set(null);
      this.copyToast.set('No se pudo copiar el enlace');
    }
    if (this.copyToastTimer) clearTimeout(this.copyToastTimer);
    this.copyToastTimer = setTimeout(() => {
      this.copiedKind.set(null);
      this.copyToast.set('');
    }, 2200);
  }

  private syncTimer(endsAt: string | null) {
    if (this.timerHandle) clearInterval(this.timerHandle);
    this.timerHandle = null;
    if (!endsAt) {
      this.timerLeft.set(null);
      disarmTimerChime();
      return;
    }
    this.timerLeft.set(null);
    const tick = () => {
      const left = Math.max(
        0,
        Math.floor((new Date(endsAt).getTime() - Date.now()) / 1000),
      );
      const prev = this.timerLeft();
      this.timerLeft.set(left);
      if (left === 0) {
        if (prev !== null && prev > 0) playTimerChime();
        disarmTimerChime();
        if (this.timerHandle) {
          clearInterval(this.timerHandle);
          this.timerHandle = null;
        }
      }
    };
    tick();
    if ((this.timerLeft() ?? 0) > 0) {
      armTimerChime();
      this.timerHandle = setInterval(tick, 1000);
    }
  }

  formatTime(sec: number) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  isPhaseDone(key: RetroStatus) {
    const status = this.retro()?.status;
    if (!status) return false;
    const cur = PHASES.findIndex((p) => p.key === status);
    const idx = PHASES.findIndex((p) => p.key === key);
    return idx >= 0 && cur > idx;
  }
}

function parsePresenterCardId(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object' || !('presenterCardId' in payload)) {
    return null;
  }
  const value = (payload as { presenterCardId: unknown }).presenterCardId;
  return typeof value === 'string' && value ? value : null;
}

function applyAvatarChanged(
  board: RetroBoard,
  event: { userId: string; avatarId: string; participants: { id: string; retroId: string }[] },
): RetroBoard {
  const participantIds = new Set(
    event.participants
      .filter((p) => p.retroId === board.id)
      .map((p) => p.id),
  );
  const matches = (p: Participant) =>
    p.user?.id === event.userId ||
    p.userId === event.userId ||
    participantIds.has(p.id);
  const matchedIds = new Set(
    board.participants.filter(matches).map((p) => p.id),
  );
  if (
    matchedIds.size === 0 &&
    !board.actionItems.some((a) => a.owner?.id === event.userId)
  ) {
    return board;
  }

  return {
    ...board,
    participants: board.participants.map((p) =>
      matches(p)
        ? {
            ...p,
            avatarId: event.avatarId,
            user: p.user ? { ...p.user, avatarId: event.avatarId } : p.user,
          }
        : p,
    ),
    cards: board.cards.map((c) => {
      if (!c.authorAvatarId) return c;
      const authorId = c.author?.id ?? c.authorId;
      if (!matchedIds.has(authorId) && c.author?.user?.id !== event.userId) {
        return c;
      }
      return { ...c, authorAvatarId: event.avatarId };
    }),
    commentProgress: board.commentProgress
      ? {
          ...board.commentProgress,
          participants: board.commentProgress.participants.map((p) =>
            matchedIds.has(p.participantId)
              ? { ...p, avatarId: event.avatarId }
              : p,
          ),
        }
      : board.commentProgress,
    voteProgress: board.voteProgress
      ? {
          ...board.voteProgress,
          participants: board.voteProgress.participants.map((p) =>
            matchedIds.has(p.participantId)
              ? { ...p, avatarId: event.avatarId }
              : p,
          ),
        }
      : board.voteProgress,
    actionItems: board.actionItems.map((a) =>
      a.owner?.id === event.userId
        ? { ...a, owner: { ...a.owner, avatarId: event.avatarId } }
        : a,
    ),
  };
}

function parseNotTeamMember(error: unknown): RetroAccessDenied | null {
  if (!(error instanceof HttpErrorResponse) || error.status !== 403) {
    return null;
  }
  const body = error.error;
  if (!body || typeof body !== 'object' || body.code !== 'NOT_TEAM_MEMBER') {
    return null;
  }
  return {
    teamId: typeof body.teamId === 'string' ? body.teamId : '',
    teamName: typeof body.teamName === 'string' ? body.teamName : '',
    pendingRequest: !!body.pendingRequest,
  };
}
