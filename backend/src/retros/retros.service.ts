import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RetroStatus, TeamRole } from '@prisma/client';
import { AuthService } from '../auth/auth.service';
import { JwtPayload } from '../auth/jwt.strategy';
import { PrismaService } from '../prisma/prisma.service';
import { TeamsService } from '../teams/teams.service';
import {
  CreateActionFromRetroDto,
  CreateCardDto,
  CreateRetroDto,
  GroupCardsDto,
  JoinRetroDto,
  RotiDto,
  TimerDto,
  UpdateSettingsDto,
  VoteDto,
} from './dto/retros.dto';
import { RetroEventsService } from './retro-events.service';

const PHASE_ORDER: RetroStatus[] = [
  RetroStatus.comments,
  RetroStatus.grouping,
  RetroStatus.voting,
  RetroStatus.actions,
  RetroStatus.roti,
  RetroStatus.closed,
];

const boardInclude = {
  columns: { orderBy: { position: 'asc' as const } },
  participants: {
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  },
  groups: {
    include: {
      cards: true,
      votes: true,
    },
  },
  cards: {
    include: {
      author: {
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      },
      votes: true,
    },
    orderBy: { position: 'asc' as const },
  },
  votes: true,
  actionItems: {
    include: {
      owner: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'asc' as const },
  },
  team: { select: { id: true, name: true } },
} as const;

@Injectable()
export class RetrosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly teams: TeamsService,
    private readonly auth: AuthService,
    private readonly events: RetroEventsService,
  ) {}

  async create(userId: string, dto: CreateRetroDto) {
    await this.teams.assertMember(userId, dto.teamId);

    const template = await this.prisma.template.findUnique({
      where: { id: dto.templateId },
      include: { columns: { orderBy: { position: 'asc' } } },
    });
    if (!template) {
      throw new NotFoundException('Template not found');
    }

    const openActionsReminder = await this.prisma.actionItem.count({
      where: {
        teamId: dto.teamId,
        status: { in: ['pending', 'doing'] },
      },
    });

    const guestInviteCode = await this.uniqueCode('guest');
    const memberInviteCode = await this.uniqueCode('member');

    const retro = await this.prisma.retrospective.create({
      data: {
        teamId: dto.teamId,
        templateId: dto.templateId,
        title: dto.title.trim(),
        maxCommentsPerParticipant: dto.maxCommentsPerParticipant ?? null,
        votesPerParticipant: dto.votesPerParticipant ?? 5,
        maxVotesPerCard: dto.maxVotesPerCard ?? 2,
        allowAnonymous: dto.allowAnonymous ?? true,
        timerSeconds: dto.timerSeconds ?? null,
        guestInviteCode,
        memberInviteCode,
        columns: {
          create: template.columns.map((c) => ({
            title: c.title,
            description: c.description,
            icon: c.icon,
            position: c.position,
          })),
        },
        participants: {
          create: {
            userId,
            isGuest: false,
          },
        },
      },
    });

    const board = await this.getBoard(retro.id, {
      sub: userId,
      type: 'user',
    });

    return { ...board, openActionsReminder };
  }

  async join(user: JwtPayload, dto: JoinRetroDto) {
    const code = dto.code.trim().toUpperCase();
    const retro = await this.prisma.retrospective.findFirst({
      where: {
        OR: [{ guestInviteCode: code }, { memberInviteCode: code }],
      },
    });
    if (!retro) {
      throw new NotFoundException('Invalid invite code');
    }

    const isMemberCode = retro.memberInviteCode === code;
    const isGuestCode = retro.guestInviteCode === code;

    if (isMemberCode) {
      if (user.type !== 'user') {
        throw new ForbiddenException('Login required to join as member');
      }
      await this.teams.assertMember(user.sub, retro.teamId);

      let participant = await this.prisma.participant.findFirst({
        where: { retroId: retro.id, userId: user.sub, isGuest: false },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      });

      if (!participant) {
        participant = await this.prisma.participant.create({
          data: {
            retroId: retro.id,
            userId: user.sub,
            isGuest: false,
          },
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        });
        this.events.emit(retro.id, 'participant-joined', participant);
      }

      return {
        accessToken: null,
        retroId: retro.id,
        participant,
        type: 'member' as const,
      };
    }

    if (isGuestCode) {
      if (!dto.guestName?.trim()) {
        throw new BadRequestException('guestName is required');
      }
      const guestName = dto.guestName.trim();
      const participant = await this.prisma.participant.create({
        data: {
          retroId: retro.id,
          guestName,
          isGuest: true,
        },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      });

      const accessToken = this.auth.signGuest(
        participant.id,
        retro.id,
        guestName,
      );

      this.events.emit(retro.id, 'participant-joined', participant);

      return {
        accessToken,
        retroId: retro.id,
        participant,
        type: 'guest' as const,
      };
    }

    throw new NotFoundException('Invalid invite code');
  }

  async getOne(user: JwtPayload, retroId: string) {
    await this.loadAccess(user, retroId);
    return this.getBoard(retroId, user);
  }

  async remove(user: JwtPayload, retroId: string) {
    await this.assertFacilitatorOfRetro(user, retroId);
    await this.prisma.retrospective.delete({ where: { id: retroId } });
    this.events.emit(retroId, 'retro-deleted', { retroId });
    return { deleted: true };
  }

  async updateSettings(
    user: JwtPayload,
    retroId: string,
    dto: UpdateSettingsDto,
  ) {
    await this.assertFacilitatorOfRetro(user, retroId);
    const updated = await this.prisma.retrospective.update({
      where: { id: retroId },
      data: {
        ...(dto.maxCommentsPerParticipant !== undefined && {
          maxCommentsPerParticipant: dto.maxCommentsPerParticipant,
        }),
        ...(dto.votesPerParticipant !== undefined && {
          votesPerParticipant: dto.votesPerParticipant,
        }),
        ...(dto.maxVotesPerCard !== undefined && {
          maxVotesPerCard: dto.maxVotesPerCard,
        }),
        ...(dto.allowAnonymous !== undefined && {
          allowAnonymous: dto.allowAnonymous,
        }),
        ...(dto.timerSeconds !== undefined && {
          timerSeconds: dto.timerSeconds,
        }),
      },
    });

    this.events.emit(retroId, 'settings-changed', {
      maxCommentsPerParticipant: updated.maxCommentsPerParticipant,
      votesPerParticipant: updated.votesPerParticipant,
      maxVotesPerCard: updated.maxVotesPerCard,
      allowAnonymous: updated.allowAnonymous,
      timerSeconds: updated.timerSeconds,
      timerEndsAt: updated.timerEndsAt,
    });

    return this.getBoard(retroId, user);
  }

  async advancePhase(user: JwtPayload, retroId: string, status: string) {
    await this.assertFacilitatorOfRetro(user, retroId);
    const retro = await this.getRetroOrThrow(retroId);
    const target = status as RetroStatus;
    const currentIdx = PHASE_ORDER.indexOf(retro.status);
    const targetIdx = PHASE_ORDER.indexOf(target);

    if (targetIdx < 0) {
      throw new BadRequestException('Invalid phase');
    }
    // Facilitator may jump to any phase (including going back)
    if (targetIdx === currentIdx) {
      return this.getBoard(retroId, user);
    }

    const updated = await this.prisma.retrospective.update({
      where: { id: retroId },
      data: {
        status: target,
        ...(target === RetroStatus.closed
          ? { closedAt: new Date(), timerEndsAt: null }
          : { closedAt: null }),
        timerEndsAt: null,
      },
    });

    this.events.emit(retroId, 'phase-changed', {
      status: updated.status,
      closedAt: updated.closedAt,
    });

    return this.getBoard(retroId, user);
  }

  async createCard(user: JwtPayload, retroId: string, dto: CreateCardDto) {
    const retro = await this.getRetroOrThrow(retroId);
    if (
      retro.status !== RetroStatus.comments &&
      retro.status !== RetroStatus.grouping
    ) {
      throw new BadRequestException(
        'Cards can only be created in comments or grouping phase',
      );
    }

    const participant = await this.requireParticipant(user, retroId);
    const column = await this.prisma.retroColumn.findFirst({
      where: { id: dto.columnId, retroId },
    });
    if (!column) {
      throw new NotFoundException('Column not found');
    }

    if (retro.maxCommentsPerParticipant != null) {
      const count = await this.prisma.card.count({
        where: { retroId, authorId: participant.id },
      });
      if (count >= retro.maxCommentsPerParticipant) {
        throw new BadRequestException('Comment limit reached');
      }
    }

    const isAnonymous = dto.isAnonymous ?? false;
    if (isAnonymous && !retro.allowAnonymous) {
      throw new BadRequestException('Anonymous cards are not allowed');
    }

    const maxPos = await this.prisma.card.aggregate({
      where: { retroId, columnId: dto.columnId },
      _max: { position: true },
    });

    const card = await this.prisma.card.create({
      data: {
        retroId,
        columnId: dto.columnId,
        authorId: participant.id,
        content: dto.content.trim(),
        isAnonymous,
        position: (maxPos._max.position ?? -1) + 1,
      },
      include: {
        author: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
        votes: true,
      },
    });

    if (retro.maxCommentsPerParticipant != null) {
      const newCount = await this.prisma.card.count({
        where: { retroId, authorId: participant.id },
      });
      if (
        newCount >= retro.maxCommentsPerParticipant &&
        !participant.commentsReady
      ) {
        await this.prisma.participant.update({
          where: { id: participant.id },
          data: { commentsReady: true },
        });
        this.events.emit(retroId, 'comments-ready-changed', {
          participantId: participant.id,
          ready: true,
        });
      }
    }

    this.events.emit(retroId, 'card-created', card);
    return card;
  }

  async setCommentsReady(user: JwtPayload, retroId: string, ready: boolean) {
    const retro = await this.getRetroOrThrow(retroId);
    const participant = await this.requireParticipant(user, retroId);

    if (
      retro.status === RetroStatus.comments ||
      retro.status === RetroStatus.grouping
    ) {
      if (!ready && retro.maxCommentsPerParticipant != null) {
        const count = await this.prisma.card.count({
          where: { retroId, authorId: participant.id },
        });
        if (count >= retro.maxCommentsPerParticipant) {
          throw new BadRequestException(
            'Cannot unready when comment limit is reached',
          );
        }
      }

      const updated = await this.prisma.participant.update({
        where: { id: participant.id },
        data: { commentsReady: ready },
      });

      this.events.emit(retroId, 'comments-ready-changed', {
        participantId: participant.id,
        ready,
      });

      return { commentsReady: updated.commentsReady };
    }

    if (retro.status === RetroStatus.voting) {
      if (!ready) {
        const myVotes = await this.prisma.vote.findMany({
          where: { retroId, participantId: participant.id },
        });
        const myVoteTotal = myVotes.reduce((s, v) => s + v.count, 0);
        if (myVoteTotal >= retro.votesPerParticipant) {
          throw new BadRequestException(
            'Cannot unready when vote limit is reached',
          );
        }
      }

      const updated = await this.prisma.participant.update({
        where: { id: participant.id },
        data: { votesReady: ready },
      });

      this.events.emit(retroId, 'votes-ready-changed', {
        participantId: participant.id,
        ready,
      });

      return { votesReady: updated.votesReady };
    }

    throw new BadRequestException(
      'Ready status can only be changed in comments, grouping, or voting phase',
    );
  }

  async updateCard(
    user: JwtPayload,
    retroId: string,
    cardId: string,
    dto: { content?: string; columnId?: string; isAnonymous?: boolean },
  ) {
    const retro = await this.getRetroOrThrow(retroId);
    if (
      retro.status !== RetroStatus.comments &&
      retro.status !== RetroStatus.grouping
    ) {
      throw new BadRequestException('Cards can only be edited in early phases');
    }

    const participant = await this.requireParticipant(user, retroId);
    const card = await this.prisma.card.findFirst({
      where: { id: cardId, retroId },
    });
    if (!card) throw new NotFoundException('Card not found');
    if (card.authorId !== participant.id) {
      throw new ForbiddenException('Can only edit your own cards');
    }

    if (dto.isAnonymous && !retro.allowAnonymous) {
      throw new BadRequestException('Anonymous cards are not allowed');
    }

    if (dto.columnId) {
      const column = await this.prisma.retroColumn.findFirst({
        where: { id: dto.columnId, retroId },
      });
      if (!column) throw new NotFoundException('Column not found');
    }

    const updated = await this.prisma.card.update({
      where: { id: cardId },
      data: {
        ...(dto.content !== undefined && { content: dto.content.trim() }),
        ...(dto.columnId !== undefined && { columnId: dto.columnId }),
        ...(dto.isAnonymous !== undefined && { isAnonymous: dto.isAnonymous }),
      },
      include: {
        author: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
        votes: true,
      },
    });

    this.events.emit(retroId, 'card-updated', updated);
    return updated;
  }

  async deleteCard(user: JwtPayload, retroId: string, cardId: string) {
    const retro = await this.getRetroOrThrow(retroId);
    if (
      retro.status !== RetroStatus.comments &&
      retro.status !== RetroStatus.grouping
    ) {
      throw new BadRequestException(
        'Cards can only be deleted in early phases',
      );
    }

    const participant = await this.requireParticipant(user, retroId);
    const facilitator = await this.isFacilitator(user, retroId);
    const card = await this.prisma.card.findFirst({
      where: { id: cardId, retroId },
    });
    if (!card) throw new NotFoundException('Card not found');
    if (card.authorId !== participant.id && !facilitator) {
      throw new ForbiddenException('Cannot delete this card');
    }

    await this.prisma.card.delete({ where: { id: cardId } });
    this.events.emit(retroId, 'card-deleted', { id: cardId, retroId });
    return { deleted: true };
  }

  async groupCards(user: JwtPayload, retroId: string, dto: GroupCardsDto) {
    const retro = await this.getRetroOrThrow(retroId);
    if (retro.status !== RetroStatus.grouping) {
      throw new BadRequestException('Grouping only allowed in grouping phase');
    }
    await this.requireParticipant(user, retroId);

    if (dto.sourceCardId === dto.targetCardId) {
      throw new BadRequestException('Cannot group a card with itself');
    }

    const [source, target] = await Promise.all([
      this.prisma.card.findFirst({ where: { id: dto.sourceCardId, retroId } }),
      this.prisma.card.findFirst({ where: { id: dto.targetCardId, retroId } }),
    ]);
    if (!source || !target) {
      throw new NotFoundException('Card not found');
    }

    let groupId = target.groupId;
    if (!groupId) {
      const group = await this.prisma.cardGroup.create({
        data: {
          retroId,
          title: null,
        },
      });
      groupId = group.id;
      await this.prisma.card.update({
        where: { id: target.id },
        data: { groupId },
      });
    }

    const updatedSource = await this.prisma.card.update({
      where: { id: source.id },
      data: { groupId, columnId: target.columnId },
      include: {
        author: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
        votes: true,
      },
    });

    this.events.emit(retroId, 'card-updated', updatedSource);
    return this.getBoard(retroId, user);
  }

  async setVote(user: JwtPayload, retroId: string, dto: VoteDto) {
    const retro = await this.getRetroOrThrow(retroId);
    if (retro.status !== RetroStatus.voting) {
      throw new BadRequestException('Voting only allowed in voting phase');
    }
    if (!dto.cardId && !dto.groupId) {
      throw new BadRequestException('cardId or groupId required');
    }
    if (dto.cardId && dto.groupId) {
      throw new BadRequestException('Provide either cardId or groupId');
    }

    const participant = await this.requireParticipant(user, retroId);

    if (dto.cardId) {
      const card = await this.prisma.card.findFirst({
        where: { id: dto.cardId, retroId },
      });
      if (!card) throw new NotFoundException('Card not found');
      if (card.groupId) {
        throw new BadRequestException(
          'Vote on the group instead of grouped card',
        );
      }
    }

    if (dto.groupId) {
      const group = await this.prisma.cardGroup.findFirst({
        where: { id: dto.groupId, retroId },
      });
      if (!group) throw new NotFoundException('Group not found');
    }

    if (dto.count > retro.maxVotesPerCard) {
      throw new BadRequestException(
        `Max ${retro.maxVotesPerCard} votes per card/group`,
      );
    }

    const existing = await this.prisma.vote.findFirst({
      where: {
        participantId: participant.id,
        ...(dto.cardId ? { cardId: dto.cardId } : { groupId: dto.groupId }),
      },
    });

    const otherVotes = await this.prisma.vote.findMany({
      where: {
        retroId,
        participantId: participant.id,
        ...(existing ? { NOT: { id: existing.id } } : {}),
      },
    });
    const otherTotal = otherVotes.reduce((sum, v) => sum + v.count, 0);
    if (otherTotal + dto.count > retro.votesPerParticipant) {
      throw new BadRequestException('Vote limit exceeded');
    }

    if (dto.count === 0) {
      if (existing) {
        await this.prisma.vote.delete({ where: { id: existing.id } });
      }
    } else if (existing) {
      await this.prisma.vote.update({
        where: { id: existing.id },
        data: { count: dto.count },
      });
    } else {
      await this.prisma.vote.create({
        data: {
          retroId,
          participantId: participant.id,
          cardId: dto.cardId ?? null,
          groupId: dto.groupId ?? null,
          count: dto.count,
        },
      });
    }

    const myVotes = await this.prisma.vote.findMany({
      where: { retroId, participantId: participant.id },
    });
    const myVoteTotal = myVotes.reduce((s, v) => s + v.count, 0);
    if (
      myVoteTotal >= retro.votesPerParticipant &&
      !participant.votesReady
    ) {
      await this.prisma.participant.update({
        where: { id: participant.id },
        data: { votesReady: true },
      });
      this.events.emit(retroId, 'votes-ready-changed', {
        participantId: participant.id,
        ready: true,
      });
    }

    const votes = await this.prisma.vote.findMany({ where: { retroId } });
    this.events.emit(retroId, 'votes-updated', { votes });
    return { votes };
  }

  async startTimer(user: JwtPayload, retroId: string, dto: TimerDto) {
    await this.assertFacilitatorOfRetro(user, retroId);
    const retro = await this.getRetroOrThrow(retroId);
    const seconds = dto.seconds ?? retro.timerSeconds;
    if (!seconds || seconds < 1) {
      throw new BadRequestException('Timer seconds required');
    }

    const timerEndsAt = new Date(Date.now() + seconds * 1000);
    const updated = await this.prisma.retrospective.update({
      where: { id: retroId },
      data: { timerSeconds: seconds, timerEndsAt },
    });

    this.events.emit(retroId, 'timer-updated', {
      timerSeconds: updated.timerSeconds,
      timerEndsAt: updated.timerEndsAt,
      running: true,
    });

    return {
      timerSeconds: updated.timerSeconds,
      timerEndsAt: updated.timerEndsAt,
    };
  }

  async stopTimer(user: JwtPayload, retroId: string) {
    await this.assertFacilitatorOfRetro(user, retroId);
    const updated = await this.prisma.retrospective.update({
      where: { id: retroId },
      data: { timerEndsAt: null },
    });

    this.events.emit(retroId, 'timer-updated', {
      timerSeconds: updated.timerSeconds,
      timerEndsAt: null,
      running: false,
    });

    return {
      timerSeconds: updated.timerSeconds,
      timerEndsAt: null,
    };
  }

  async submitRoti(user: JwtPayload, retroId: string, dto: RotiDto) {
    const retro = await this.getRetroOrThrow(retroId);
    if (retro.status !== RetroStatus.roti) {
      throw new BadRequestException('ROTI only allowed in roti phase');
    }
    const participant = await this.requireParticipant(user, retroId);

    const response = await this.prisma.rotiResponse.upsert({
      where: {
        retroId_participantId: {
          retroId,
          participantId: participant.id,
        },
      },
      create: {
        retroId,
        participantId: participant.id,
        score: dto.score,
        comment: dto.comment?.trim() || null,
      },
      update: {
        score: dto.score,
        comment: dto.comment?.trim() || null,
      },
    });

    return response;
  }

  async report(user: JwtPayload, retroId: string) {
    await this.loadAccess(user, retroId);
    const board = await this.getBoard(retroId, user, true);
    const rotiResponses = await this.prisma.rotiResponse.findMany({
      where: { retroId },
      select: { id: true, score: true, comment: true },
    });
    const rotiAverage =
      rotiResponses.length > 0
        ? rotiResponses.reduce((s, r) => s + r.score, 0) / rotiResponses.length
        : null;

    return { ...board, rotiResponses, rotiAverage };
  }

  async createAction(
    user: JwtPayload,
    retroId: string,
    dto: CreateActionFromRetroDto,
  ) {
    const retro = await this.getRetroOrThrow(retroId);
    if (
      retro.status !== RetroStatus.actions &&
      retro.status !== RetroStatus.roti &&
      retro.status !== RetroStatus.closed
    ) {
      throw new BadRequestException('Actions not available in this phase');
    }
    await this.requireParticipant(user, retroId);

    const action = await this.prisma.actionItem.create({
      data: {
        teamId: retro.teamId,
        retroId,
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        ownerId: dto.ownerId || null,
      },
      include: {
        owner: { select: { id: true, name: true } },
      },
    });

    this.events.emit(retroId, 'action-created', action);
    return action;
  }

  private async getBoard(
    retroId: string,
    user: JwtPayload,
    forReport = false,
  ) {
    const retro = await this.prisma.retrospective.findUnique({
      where: { id: retroId },
      include: boardInclude,
    });
    if (!retro) throw new NotFoundException('Retrospective not found');

    const participant = await this.findParticipant(user, retroId);
    const hideOthers =
      !forReport &&
      retro.status === RetroStatus.comments &&
      !!participant;

    const cards = retro.cards.map((card) => {
      const authorName = card.isAnonymous
        ? 'Anonymous'
        : (card.author.guestName ??
          card.author.user?.name ??
          'Participant');

      if (hideOthers && card.authorId !== participant!.id) {
        return {
          ...card,
          content: '•••••',
          hidden: true,
          authorName: card.isAnonymous ? 'Anonymous' : 'Hidden',
        };
      }

      return {
        ...card,
        hidden: false,
        authorName,
      };
    });

    const myCommentCount = participant
      ? cards.filter((c) => c.authorId === participant.id).length
      : 0;
    const myVotes = participant
      ? retro.votes.filter((v) => v.participantId === participant.id)
      : [];
    const myVoteTotal = myVotes.reduce((s, v) => s + v.count, 0);

    const commentProgress = retro.participants.map((p) => {
      const commentCount = retro.cards.filter((c) => c.authorId === p.id).length;
      const name =
        p.guestName ?? p.user?.name ?? (p.isGuest ? 'Invitado' : 'Participante');
      return {
        participantId: p.id,
        name,
        commentCount,
        isReady: p.commentsReady,
      };
    });
    const readyCount = commentProgress.filter((p) => p.isReady).length;

    const voteProgressParticipants = retro.participants.map((p) => {
      const voteCount = retro.votes
        .filter((v) => v.participantId === p.id)
        .reduce((s, v) => s + v.count, 0);
      const name =
        p.guestName ?? p.user?.name ?? (p.isGuest ? 'Invitado' : 'Participante');
      return {
        participantId: p.id,
        name,
        voteCount,
        isReady: p.votesReady,
      };
    });
    const votesReadyCount = voteProgressParticipants.filter(
      (p) => p.isReady,
    ).length;
    const votesUsed = voteProgressParticipants.reduce(
      (s, p) => s + p.voteCount,
      0,
    );
    const votesCapacity =
      voteProgressParticipants.length * retro.votesPerParticipant;

    return {
      ...retro,
      cards,
      commentProgress: {
        written: readyCount,
        total: commentProgress.length,
        allDone:
          commentProgress.length > 0 &&
          readyCount === commentProgress.length,
        participants: commentProgress,
      },
      voteProgress: {
        ready: votesReadyCount,
        total: voteProgressParticipants.length,
        allDone:
          voteProgressParticipants.length > 0 &&
          votesReadyCount === voteProgressParticipants.length,
        votesUsed,
        votesCapacity,
        participants: voteProgressParticipants,
      },
      me: {
        participantId: participant?.id,
        myCommentCount,
        myVoteTotal,
        votesRemaining: Math.max(0, retro.votesPerParticipant - myVoteTotal),
        commentsReady: participant?.commentsReady ?? false,
        votesReady: participant?.votesReady ?? false,
      },
    };
  }

  private async loadAccess(user: JwtPayload, retroId: string) {
    const retro = await this.getRetroOrThrow(retroId);
    if (user.type === 'guest') {
      if (user.retroId !== retroId) {
        throw new ForbiddenException('Guest token does not match retrospective');
      }
      return;
    }
    if (user.type === 'anonymous') {
      throw new ForbiddenException('Authentication required');
    }
    const participant = await this.findParticipant(user, retroId);
    if (participant) return;
    await this.teams.assertMember(user.sub, retro.teamId);
  }

  private async assertFacilitatorOfRetro(user: JwtPayload, retroId: string) {
    if (user.type !== 'user') {
      throw new ForbiddenException('Facilitator role required');
    }
    const retro = await this.getRetroOrThrow(retroId);
    await this.teams.assertFacilitator(user.sub, retro.teamId);
  }

  private async isFacilitator(user: JwtPayload, retroId: string) {
    if (user.type !== 'user') return false;
    const retro = await this.getRetroOrThrow(retroId);
    const membership = await this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId: retro.teamId, userId: user.sub } },
    });
    return membership?.role === TeamRole.facilitator;
  }

  private async requireParticipant(user: JwtPayload, retroId: string) {
    const participant = await this.findParticipant(user, retroId);
    if (!participant) {
      throw new ForbiddenException('Join the retrospective first');
    }
    return participant;
  }

  private async findParticipant(user: JwtPayload, retroId: string) {
    if (user.type === 'guest') {
      if (user.retroId !== retroId) return null;
      const participantId = user.participantId ?? user.sub;
      return this.prisma.participant.findUnique({
        where: { id: participantId },
      });
    }
    if (user.type !== 'user') return null;
    return this.prisma.participant.findFirst({
      where: { retroId, userId: user.sub, isGuest: false },
    });
  }

  private async getRetroOrThrow(retroId: string) {
    const retro = await this.prisma.retrospective.findUnique({
      where: { id: retroId },
    });
    if (!retro) throw new NotFoundException('Retrospective not found');
    return retro;
  }

  private async uniqueCode(kind: 'guest' | 'member'): Promise<string> {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    for (let attempt = 0; attempt < 10; attempt++) {
      let code = '';
      for (let i = 0; i < 8; i++) {
        code += alphabet[Math.floor(Math.random() * alphabet.length)];
      }
      const existing = await this.prisma.retrospective.findFirst({
        where:
          kind === 'guest'
            ? { guestInviteCode: code }
            : { memberInviteCode: code },
      });
      if (!existing) return code;
    }
    throw new BadRequestException('Could not generate invite code');
  }
}
