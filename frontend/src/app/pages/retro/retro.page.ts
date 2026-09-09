import {
  Component,
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
import {
  Card,
  PHASES,
  RetroBoard,
  RetroStatus,
} from '../../core/models';
import { SocketService } from '../../core/socket.service';

type SortMode = 'most' | 'least' | 'original';

@Component({
  selector: 'app-retro-page',
  imports: [FormsModule, RouterLink],
  templateUrl: './retro.page.html',
  styleUrl: './retro.page.scss',
})
export class RetroPage implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly sockets = inject(SocketService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  retro = signal<RetroBoard | null>(null);
  error = signal('');
  draft: Record<string, string> = {};
  anonymousDraft = false;
  editingCardId: string | null = null;
  editDraft = '';
  editAnonymous = false;
  selectedCardId: string | null = null;
  sortMode = signal<SortMode>('most');
  showSettings = false;
  showInvite = false;
  rotiScore = 4;
  rotiComment = '';
  actionTitle = '';
  actionOwnerId = '';
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

  isFacilitator = computed(() => this.auth.isUser());

  canComment = computed(() => {
    const r = this.retro();
    if (!r?.me) return false;
    if (r.status !== 'comments' && r.status !== 'grouping') return false;
    if (r.maxCommentsPerParticipant == null) return true;
    return r.me.myCommentCount < r.maxCommentsPerParticipant;
  });

  readyLocked = computed(() => {
    const r = this.retro();
    if (!r?.me || r.maxCommentsPerParticipant == null) return false;
    return r.me.myCommentCount >= r.maxCommentsPerParticipant;
  });

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.reload(id);
    const socket = this.sockets.joinRetro(id);
    const refresh = () => this.reload(id);
    socket.on('phase-changed', refresh);
    socket.on('card-created', refresh);
    socket.on('card-updated', refresh);
    socket.on('card-deleted', refresh);
    socket.on('cards-grouped', refresh);
    socket.on('votes-updated', refresh);
    socket.on('settings-changed', refresh);
    socket.on('timer-updated', refresh);
    socket.on('action-created', refresh);
    socket.on('participant-joined', refresh);
    socket.on('comments-ready-changed', refresh);
    socket.on('retro-deleted', () => {
      const teamId = this.retro()?.teamId;
      void this.router.navigate(teamId ? ['/teams', teamId] : ['/dashboard']);
    });
  }

  ngOnDestroy() {
    if (this.timerHandle) clearInterval(this.timerHandle);
    this.sockets.disconnect();
  }

  reload(id = this.retro()?.id) {
    if (!id) return;
    this.api.getRetro(id).subscribe({
      next: (r) => {
        this.retro.set(r);
        this.maxComments = r.maxCommentsPerParticipant;
        this.votesPerParticipant = r.votesPerParticipant;
        this.maxVotesPerCard = r.maxVotesPerCard;
        this.timerSeconds = r.timerSeconds ?? 300;
        this.syncTimer(r.timerEndsAt);
      },
      error: (e) => this.error.set(e?.error?.message || 'Error al cargar'),
    });
  }

  cardsForColumn(columnId: string): Card[] {
    const r = this.retro();
    if (!r) return [];
    let cards = r.cards.filter((c) => c.columnId === columnId && !c.groupId);
    // also show group representative: first card of each group in this column
    const grouped = r.groups
      .map((g) => {
        const gCards = r.cards.filter((c) => c.groupId === g.id);
        if (!gCards.length) return null;
        if (gCards[0].columnId !== columnId) return null;
        return {
          ...gCards[0],
          content: gCards.map((c) => c.content).join(' · '),
          isGroup: true,
          groupId: g.id,
          groupSize: gCards.length,
        } as Card & { isGroup?: boolean; groupSize?: number };
      })
      .filter(Boolean) as Card[];

    cards = [...cards, ...grouped];

    if (r.status === 'actions' || r.status === 'voting') {
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

  addCard(columnId: string) {
    const r = this.retro();
    const content = (this.draft[columnId] || '').trim();
    if (!r || !content) return;
    this.api
      .createCard(r.id, {
        columnId,
        content,
        isAnonymous: this.anonymousDraft,
      })
      .subscribe({
        next: () => {
          this.draft[columnId] = '';
          this.reload(r.id);
        },
        error: (e) => this.error.set(e?.error?.message || 'No se pudo agregar'),
      });
  }

  isOwnCard(card: Card): boolean {
    const pid = this.retro()?.me?.participantId;
    return !!pid && card.authorId === pid;
  }

  canManageCard(card: Card & { isGroup?: boolean }): boolean {
    const r = this.retro();
    if (!r) return false;
    if (r.status !== 'comments' && r.status !== 'grouping') return false;
    if (card.hidden || card.groupId || card.isGroup) return false;
    return this.isOwnCard(card);
  }

  startEdit(card: Card, event: Event) {
    event.stopPropagation();
    if (!this.canManageCard(card)) return;
    this.editingCardId = card.id;
    this.editDraft = card.content;
    this.editAnonymous = card.isAnonymous;
  }

  cancelEdit(event?: Event) {
    event?.stopPropagation();
    this.editingCardId = null;
    this.editDraft = '';
    this.editAnonymous = false;
  }

  saveEdit(card: Card, event: Event) {
    event.stopPropagation();
    const r = this.retro();
    const content = this.editDraft.trim();
    if (!r || !content || !this.canManageCard(card)) return;
    this.api
      .updateCard(r.id, card.id, {
        content,
        isAnonymous: r.allowAnonymous ? this.editAnonymous : undefined,
      })
      .subscribe({
        next: () => {
          this.cancelEdit();
          this.reload(r.id);
        },
        error: (e) =>
          this.error.set(e?.error?.message || 'No se pudo guardar el comentario'),
      });
  }

  deleteCard(card: Card, event: Event) {
    event.stopPropagation();
    const r = this.retro();
    if (!r || !this.canManageCard(card)) return;
    if (!confirm('¿Borrar este comentario? Esta acción no se puede deshacer.')) {
      return;
    }
    this.api.deleteCard(r.id, card.id).subscribe({
      next: () => {
        if (this.editingCardId === card.id) this.cancelEdit();
        if (this.selectedCardId === card.id) this.selectedCardId = null;
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

  selectForGroup(cardId: string) {
    const r = this.retro();
    if (!r || r.status !== 'grouping') return;
    if (!this.selectedCardId) {
      this.selectedCardId = cardId;
      return;
    }
    if (this.selectedCardId === cardId) {
      this.selectedCardId = null;
      return;
    }
    this.api.groupCards(r.id, this.selectedCardId, cardId).subscribe({
      next: () => {
        this.selectedCardId = null;
        this.reload(r.id);
      },
      error: (e) => this.error.set(e?.error?.message || 'No se pudo agrupar'),
    });
  }

  changeVote(card: Card, delta: number) {
    const r = this.retro();
    if (!r) return;
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

  deleteRetro() {
    const r = this.retro();
    if (!r || !this.isFacilitator()) return;
    if (
      !confirm(
        `¿Borrar la retrospectiva “${r.title}”? Esta acción no se puede deshacer.`,
      )
    ) {
      return;
    }
    this.api.deleteRetro(r.id).subscribe({
      next: () => {
        void this.router.navigate(['/teams', r.teamId]);
      },
      error: (e) =>
        this.error.set(e?.error?.message || 'No se pudo borrar la retrospectiva'),
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

  startTimer() {
    const r = this.retro();
    if (!r) return;
    this.api.startTimer(r.id, this.timerSeconds).subscribe({
      next: () => this.reload(r.id),
    });
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

  createAction() {
    const r = this.retro();
    if (!r || !this.actionTitle.trim()) return;
    this.api
      .createRetroAction(r.id, {
        title: this.actionTitle,
        ownerId: this.actionOwnerId || undefined,
      })
      .subscribe({
        next: () => {
          this.actionTitle = '';
          this.reload(r.id);
        },
        error: (e) => this.error.set(e?.error?.message || 'Error al crear acción'),
      });
  }

  inviteUrl(kind: 'guest' | 'member') {
    const r = this.retro();
    if (!r) return '';
    const code = kind === 'guest' ? r.guestInviteCode : r.memberInviteCode;
    return `${window.location.origin}/join/${code}`;
  }

  copyInvite(kind: 'guest' | 'member') {
    void navigator.clipboard.writeText(this.inviteUrl(kind));
  }

  private syncTimer(endsAt: string | null) {
    if (this.timerHandle) clearInterval(this.timerHandle);
    if (!endsAt) {
      this.timerLeft.set(null);
      return;
    }
    const tick = () => {
      const left = Math.max(
        0,
        Math.floor((new Date(endsAt).getTime() - Date.now()) / 1000),
      );
      this.timerLeft.set(left);
    };
    tick();
    this.timerHandle = setInterval(tick, 1000);
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
