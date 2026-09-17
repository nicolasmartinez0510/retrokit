import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TeamRole } from '@prisma/client';
import { AuthService } from '../auth/auth.service';
import { JwtPayload } from '../auth/jwt.strategy';
import { PrismaService } from '../prisma/prisma.service';
import { TeamsService } from '../teams/teams.service';
import { UploadsService } from '../uploads/uploads.service';
import {
  parseAvatarId,
  resolveParticipantAvatar,
  userPublicSelect,
} from '../common/avatars';
import {
  actionItemInclude,
  parseOptionalDueDate,
  serializeActionItem,
} from '../common/action-item';
import {
  CreateActionFromRetroDto,
  CreateCardDto,
  CreateRetroDto,
  GroupCardsDto,
  JoinRetroDto,
  ReactionDto,
  RotiDto,
  SemaforoVoteDto,
  TimerAddDto,
  TimerDto,
  UngroupCardsDto,
  UpdateSettingsDto,
  VoteDto,
} from './dto/retros.dto';
import { RealtimeEventsService } from '../realtime/realtime-events.service';
import {
  DEFAULT_CLASSIC_PHASE_IDS,
  DEFAULT_SEMAFORO_ITEMS,
  PhaseCapabilityFlags,
  PhaseKind,
  phaseCapabilities,
  resolveMaxCards,
  snapshotPhaseFields,
} from './phase-rules';

const cardInclude = {
  author: {
    include: {
      user: { select: userPublicSelect },
    },
  },
  votes: true,
  reactions: true,
} as const;

const boardInclude = {
  columns: { orderBy: { position: 'asc' as const } },
  phases: {
    include: { hiddenColumns: true },
    orderBy: { position: 'asc' as const },
  },
  participants: {
    include: {
      user: { select: userPublicSelect },
    },
  },
  groups: {
    include: {
      cards: true,
      votes: true,
    },
  },
  cards: {
    include: cardInclude,
    orderBy: { position: 'asc' as const },
  },
  votes: true,
  reactions: true,
  semaforoItems: { orderBy: { position: 'asc' as const } },
  semaforoVotes: true,
  actionItems: {
    include: actionItemInclude,
    orderBy: { createdAt: 'asc' as const },
  },
  team: { select: { id: true, name: true } },
} as const;

type RetroPhaseRecord = Prisma.RetroPhaseGetPayload<{
  include: { hiddenColumns: true };
}>;

type RetroRecord = Prisma.RetrospectiveGetPayload<Record<string, never>>;

/** Effective capabilities of the current phase, taking `closedAt` into account. */
export interface EffectiveCaps extends PhaseCapabilityFlags {
  kind: PhaseKind;
  closed: boolean;
}

const SEMAFORO_KINDS: PhaseKind[] = ['semaforo', 'semaforo_review'];

@Injectable()
export class RetrosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly teams: TeamsService,
    private readonly auth: AuthService,
    private readonly events: RealtimeEventsService,
    private readonly uploads: UploadsService,
  ) {}

  async create(userId: string, dto: CreateRetroDto) {
    await this.teams.assertFacilitatorOrAdmin(userId, dto.teamId);

    const admin = await this.teams.isAdmin(userId);
    const template = await this.prisma.template.findFirst({
      where: {
        id: dto.templateId,
        ...(admin ? {} : { OR: [{ isGlobal: true }, { createdById: userId }] }),
      },
      include: {
        columns: { orderBy: { position: 'asc' } },
        phases: {
          include: { phase: true, hiddenColumns: true },
          orderBy: { position: 'asc' },
        },
        semaforoItems: { orderBy: { position: 'asc' } },
      },
    });
    if (!template) {
      throw new NotFoundException('Template not found');
    }

    // Resolve the ordered list of phases + hidden template column ids per phase.
    const phasePlan = await this.resolvePhasePlan(userId, admin, template, dto);
    const hasSemaforo = phasePlan.some((p) =>
      SEMAFORO_KINDS.includes(p.phase.kind),
    );

    const semaforoItems = hasSemaforo
      ? dto.semaforoItems?.length
        ? dto.semaforoItems.map((i) => ({
            title: i.title.trim(),
            description: i.description?.trim() || null,
          }))
        : template.semaforoItems.length
          ? template.semaforoItems.map((i) => ({
              title: i.title,
              description: i.description,
            }))
          : DEFAULT_SEMAFORO_ITEMS.map((i) => ({
              title: i.title,
              description: i.description,
            }))
      : [];

    const openActionsReminder = await this.prisma.actionItem.count({
      where: {
        teamId: dto.teamId,
        status: { in: ['pending', 'doing'] },
      },
    });

    const guestInviteCode = await this.uniqueCode('guest');
    const memberInviteCode = await this.uniqueCode('member');

    const retroId = await this.prisma.$transaction(async (tx) => {
      const retro = await tx.retrospective.create({
        data: {
          teamId: dto.teamId,
          templateId: dto.templateId,
          title: dto.title.trim(),
          maxCommentsPerParticipant:
            dto.maxCommentsPerParticipant !== undefined
              ? dto.maxCommentsPerParticipant
              : (template.maxCommentsPerParticipant ?? null),
          votesPerParticipant:
            dto.votesPerParticipant ?? template.votesPerParticipant ?? 5,
          maxVotesPerCard: dto.maxVotesPerCard ?? template.maxVotesPerCard ?? 2,
          allowAnonymous: dto.allowAnonymous ?? true,
          allowCrossColumnGrouping: dto.allowCrossColumnGrouping ?? false,
          timerSeconds: dto.timerSeconds ?? null,
          backgroundColor: template.backgroundColor,
          backgroundImageUrl: template.backgroundImageUrl,
          guestInviteCode,
          memberInviteCode,
          columns: {
            create: template.columns.map((c) => ({
              title: c.title,
              description: c.description,
              icon: c.icon,
              logoUrl: c.logoUrl,
              position: c.position,
            })),
          },
          participants: {
            create: {
              userId,
              isGuest: false,
            },
          },
          semaforoItems: {
            create: semaforoItems.map((item, position) => ({
              title: item.title,
              description: item.description,
              position,
            })),
          },
        },
        include: { columns: { orderBy: { position: 'asc' } } },
      });

      // template column id -> retro column id (matched by position)
      const columnIdMap = new Map<string, string>();
      for (const tc of template.columns) {
        const rc = retro.columns.find((c) => c.position === tc.position);
        if (rc) columnIdMap.set(tc.id, rc.id);
      }

      let firstPhaseId: string | null = null;
      for (const [position, entry] of phasePlan.entries()) {
        const hiddenColumnIds = entry.hiddenTemplateColumnIds
          .map((id) => columnIdMap.get(id))
          .filter((id): id is string => !!id);
        const created = await tx.retroPhase.create({
          data: {
            retroId: retro.id,
            position,
            ...snapshotPhaseFields(entry.phase),
            hiddenColumns: {
              create: hiddenColumnIds.map((columnId) => ({ columnId })),
            },
          },
        });
        if (firstPhaseId === null) firstPhaseId = created.id;
      }

      await tx.retrospective.update({
        where: { id: retro.id },
        data: { currentPhaseId: firstPhaseId },
      });

      return retro.id;
    });

    const board = await this.getBoard(retroId, {
      sub: userId,
      type: 'user',
    });

    return { ...board, openActionsReminder };
  }

  private async resolvePhasePlan(
    userId: string,
    admin: boolean,
    template: Prisma.TemplateGetPayload<{
      include: {
        columns: true;
        phases: { include: { phase: true; hiddenColumns: true } };
      };
    }>,
    dto: CreateRetroDto,
  ) {
    const templateHidden = new Map<string, string[]>();
    for (const tp of template.phases) {
      templateHidden.set(
        tp.phaseId,
        tp.hiddenColumns.map((h) => h.columnId),
      );
    }

    if (dto.phases?.length) {
      const ordered = [...dto.phases].sort((a, b) => a.position - b.position);
      const ids = [...new Set(ordered.map((p) => p.phaseId))];
      const phases = await this.prisma.phase.findMany({
        where: {
          id: { in: ids },
          ...(admin
            ? {}
            : {
                OR: [
                  { isGlobal: true },
                  { isSystem: true },
                  { createdById: userId },
                ],
              }),
        },
      });
      const byId = new Map(phases.map((p) => [p.id, p]));
      const missing = ids.filter((id) => !byId.has(id));
      if (missing.length) {
        throw new NotFoundException(`Phase not found: ${missing.join(', ')}`);
      }
      return ids.map((id) => ({
        phase: byId.get(id)!,
        hiddenTemplateColumnIds: templateHidden.get(id) ?? [],
      }));
    }

    if (template.phases.length) {
      return template.phases.map((tp) => ({
        phase: tp.phase,
        hiddenTemplateColumnIds: tp.hiddenColumns.map((h) => h.columnId),
      }));
    }

    const defaults = await this.prisma.phase.findMany({
      where: { id: { in: [...DEFAULT_CLASSIC_PHASE_IDS] } },
    });
    const byId = new Map(defaults.map((p) => [p.id, p]));
    const plan = DEFAULT_CLASSIC_PHASE_IDS.filter((id) => byId.has(id)).map(
      (id) => ({
        phase: byId.get(id)!,
        hiddenTemplateColumnIds: [] as string[],
      }),
    );
    if (!plan.length) {
      throw new BadRequestException(
        'No phases available; seed the system phases first',
      );
    }
    return plan;
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
      const participant = await this.ensureMemberParticipant(
        user.sub,
        retro.id,
        retro.teamId,
      );
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
      const avatarId = parseAvatarId(dto.avatarId, `${retro.id}:${guestName}`);
      const participant = await this.prisma.participant.create({
        data: {
          retroId: retro.id,
          guestName,
          isGuest: true,
          avatarId,
        },
        include: {
          user: { select: userPublicSelect },
        },
      });

      const accessToken = this.auth.signGuest(
        participant.id,
        retro.id,
        guestName,
        avatarId,
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

  /** Team member joins a retro by id (no invite code). */
  async joinById(user: JwtPayload, retroId: string) {
    if (user.type !== 'user') {
      throw new ForbiddenException('Login required to join as member');
    }
    const retro = await this.getRetroOrThrow(retroId);
    const participant = await this.ensureMemberParticipant(
      user.sub,
      retro.id,
      retro.teamId,
    );
    return {
      accessToken: null,
      retroId: retro.id,
      participant,
      type: 'member' as const,
    };
  }

  async getOne(user: JwtPayload, retroId: string) {
    await this.loadAccess(user, retroId);
    return this.getBoard(retroId, user);
  }

  async remove(user: JwtPayload, retroId: string) {
    await this.assertFacilitatorOfRetro(user, retroId);
    await this.prisma.retrospective.delete({ where: { id: retroId } });
    await this.uploads.deleteRetroCardDir(retroId);
    this.events.emit(retroId, 'retro-deleted', { retroId });
    return { deleted: true };
  }

  async updateSettings(
    user: JwtPayload,
    retroId: string,
    dto: UpdateSettingsDto,
  ) {
    await this.assertFacilitatorOfRetro(user, retroId);
    const title = dto.title !== undefined ? dto.title.trim() : undefined;
    if (dto.title !== undefined && !title) {
      throw new BadRequestException('Title is required');
    }
    const updated = await this.prisma.retrospective.update({
      where: { id: retroId },
      data: {
        ...(title !== undefined && { title }),
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
        ...(dto.allowCrossColumnGrouping !== undefined && {
          allowCrossColumnGrouping: dto.allowCrossColumnGrouping,
        }),
        ...(dto.timerSeconds !== undefined && {
          timerSeconds: dto.timerSeconds,
        }),
      },
    });

    this.events.emit(retroId, 'settings-changed', {
      title: updated.title,
      maxCommentsPerParticipant: updated.maxCommentsPerParticipant,
      votesPerParticipant: updated.votesPerParticipant,
      maxVotesPerCard: updated.maxVotesPerCard,
      allowAnonymous: updated.allowAnonymous,
      allowCrossColumnGrouping: updated.allowCrossColumnGrouping,
      timerSeconds: updated.timerSeconds,
      timerEndsAt: updated.timerEndsAt,
    });

    return this.getBoard(retroId, user);
  }

  /**
   * Move the retro to another of its phases, or close it (`phaseId === 'closed'`).
   * The facilitator may jump to any phase, including going back and reopening.
   */
  async advancePhase(user: JwtPayload, retroId: string, phaseId: string) {
    await this.assertFacilitatorOfRetro(user, retroId);
    const retro = await this.getRetroOrThrow(retroId);

    if (phaseId === 'closed') {
      if (retro.closedAt) {
        return this.getBoard(retroId, user);
      }
      const updated = await this.prisma.retrospective.update({
        where: { id: retroId },
        data: {
          closedAt: new Date(),
          presenterCardId: null,
          timerEndsAt: null,
          timerPausedRemaining: null,
        },
      });
      this.events.emit(retroId, 'phase-changed', {
        phaseId: updated.currentPhaseId,
        closedAt: updated.closedAt,
      });
      return this.getBoard(retroId, user);
    }

    const phase = await this.prisma.retroPhase.findFirst({
      where: { id: phaseId, retroId },
    });
    if (!phase) {
      throw new BadRequestException('Invalid phase');
    }

    if (retro.currentPhaseId === phase.id && !retro.closedAt) {
      return this.getBoard(retroId, user);
    }

    const updated = await this.prisma.retrospective.update({
      where: { id: retroId },
      data: {
        currentPhaseId: phase.id,
        presenterCardId: null,
        closedAt: null,
        timerEndsAt: null,
        timerPausedRemaining: null,
      },
    });

    this.events.emit(retroId, 'phase-changed', {
      phaseId: updated.currentPhaseId,
      closedAt: updated.closedAt,
    });

    return this.getBoard(retroId, user);
  }

  async createCard(
    user: JwtPayload,
    retroId: string,
    dto: CreateCardDto,
    file?: Express.Multer.File,
  ) {
    const retro = await this.getRetroOrThrow(retroId);
    const { phase, caps } = await this.currentPhaseCaps(retro);
    if (!caps.allowCreateCards) {
      throw new BadRequestException(
        'Cards cannot be created in the current phase',
      );
    }

    const participant = await this.requireParticipant(user, retroId);
    const column = await this.prisma.retroColumn.findFirst({
      where: { id: dto.columnId, retroId },
    });
    if (!column) {
      throw new NotFoundException('Column not found');
    }
    if (phase.hiddenColumns.some((h) => h.columnId === column.id)) {
      throw new BadRequestException('Column is hidden in this phase');
    }

    const maxCards = resolveMaxCards(
      caps.maxCardsPerParticipant,
      retro.maxCommentsPerParticipant,
    );
    const cardCountWhere = this.cardQuotaWhere(
      retroId,
      participant.id,
      phase,
      caps,
    );
    if (maxCards != null) {
      const count = await this.prisma.card.count({ where: cardCountWhere });
      if (count >= maxCards) {
        throw new BadRequestException('Comment limit reached');
      }
    }

    const content = (dto.content ?? '').trim();
    if (caps.cardContent === 'text_only' && file) {
      throw new BadRequestException('Images are not allowed in this phase');
    }
    if (caps.cardContent === 'image_only' && !file) {
      throw new BadRequestException('An image is required in this phase');
    }
    if (!content && !file) {
      throw new BadRequestException('Comment needs text or an image');
    }
    if (file) {
      this.uploads.assertCardImage(file);
    }

    const isAnonymous = dto.isAnonymous ?? false;
    if (isAnonymous && !retro.allowAnonymous) {
      throw new BadRequestException('Anonymous cards are not allowed');
    }

    const maxPos = await this.prisma.card.aggregate({
      where: { retroId, columnId: dto.columnId },
      _max: { position: true },
    });

    let imageUrl: string | null = null;
    if (file) {
      imageUrl = await this.uploads.saveCardImage(retroId, file);
    }

    try {
      const card = await this.prisma.card.create({
        data: {
          retroId,
          columnId: dto.columnId,
          authorId: participant.id,
          createdInPhaseId: phase.id,
          content,
          imageUrl,
          isAnonymous,
          position: (maxPos._max.position ?? -1) + 1,
        },
        include: cardInclude,
      });

      if (maxCards != null) {
        const newCount = await this.prisma.card.count({
          where: cardCountWhere,
        });
        if (newCount >= maxCards && !participant.commentsReady) {
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
    } catch (err) {
      if (imageUrl) {
        await this.uploads.deleteByPublicUrl(imageUrl);
      }
      throw err;
    }
  }

  /**
   * Toggle the participant's "I'm ready" flag for the current phase.
   * Which flag is used depends on the phase: semaforo → semaforoReady,
   * voting → votesReady, otherwise commentsReady.
   */
  async setReady(user: JwtPayload, retroId: string, ready: boolean) {
    const retro = await this.getRetroOrThrow(retroId);
    const { phase, caps } = await this.currentPhaseCaps(retro);
    const participant = await this.requireParticipant(user, retroId);

    if (!caps.showReadyCheck) {
      throw new BadRequestException(
        'Ready status is not available in the current phase',
      );
    }

    if (caps.kind === 'semaforo') {
      const updated = await this.prisma.participant.update({
        where: { id: participant.id },
        data: { semaforoReady: ready },
      });
      this.events.emit(retroId, 'semaforo-ready-changed', {
        participantId: participant.id,
        ready,
      });
      return { semaforoReady: updated.semaforoReady };
    }

    if (caps.voting !== 'off') {
      const maxVotesPerCard = this.effectiveMaxVotesPerCard(retro, caps);
      if (!ready) {
        await this.collapseGroupedCardVotes(retroId, maxVotesPerCard);
        const [myVotes, groupedCards] = await Promise.all([
          this.prisma.vote.findMany({
            where: { retroId, participantId: participant.id },
          }),
          this.prisma.card.findMany({
            where: { retroId, groupId: { not: null } },
            select: { id: true },
          }),
        ]);
        const groupedCardIds = new Set(groupedCards.map((c) => c.id));
        const myVoteTotal = this.quotaVoteTotal(myVotes, groupedCardIds);
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

    const maxCards = resolveMaxCards(
      caps.maxCardsPerParticipant,
      retro.maxCommentsPerParticipant,
    );
    if (!ready && maxCards != null && caps.allowCreateCards) {
      const count = await this.prisma.card.count({
        where: this.cardQuotaWhere(retroId, participant.id, phase, caps),
      });
      if (count >= maxCards) {
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

  async updateCard(
    user: JwtPayload,
    retroId: string,
    cardId: string,
    dto: { content?: string; columnId?: string; isAnonymous?: boolean },
  ) {
    const retro = await this.getRetroOrThrow(retroId);
    const { caps } = await this.currentPhaseCaps(retro);
    this.assertCanEditOwnCards(caps);

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

    const nextContent =
      dto.content !== undefined ? dto.content.trim() : card.content;
    if (!nextContent && !card.imageUrl) {
      throw new BadRequestException('Comment needs text or an image');
    }

    const updated = await this.prisma.card.update({
      where: { id: cardId },
      data: {
        ...(dto.content !== undefined && { content: dto.content.trim() }),
        ...(dto.columnId !== undefined && { columnId: dto.columnId }),
        ...(dto.isAnonymous !== undefined && { isAnonymous: dto.isAnonymous }),
      },
      include: cardInclude,
    });

    this.events.emit(retroId, 'card-updated', updated);
    return updated;
  }

  async setCardImage(
    user: JwtPayload,
    retroId: string,
    cardId: string,
    file: Express.Multer.File,
  ) {
    const retro = await this.getRetroOrThrow(retroId);
    const { caps } = await this.currentPhaseCaps(retro);
    this.assertCanEditOwnCards(caps);
    if (caps.cardContent === 'text_only') {
      throw new BadRequestException('Images are not allowed in this phase');
    }

    const participant = await this.requireParticipant(user, retroId);
    const card = await this.prisma.card.findFirst({
      where: { id: cardId, retroId },
    });
    if (!card) throw new NotFoundException('Card not found');
    if (card.authorId !== participant.id) {
      throw new ForbiddenException('Can only edit your own cards');
    }

    this.uploads.assertCardImage(file);
    const imageUrl = await this.uploads.saveCardImage(retroId, file);
    const previousUrl = card.imageUrl;

    try {
      const updated = await this.prisma.card.update({
        where: { id: cardId },
        data: { imageUrl },
        include: cardInclude,
      });
      if (previousUrl) {
        await this.uploads.deleteByPublicUrl(previousUrl);
      }
      this.events.emit(retroId, 'card-updated', updated);
      return updated;
    } catch (err) {
      await this.uploads.deleteByPublicUrl(imageUrl);
      throw err;
    }
  }

  async deleteCardImage(user: JwtPayload, retroId: string, cardId: string) {
    const retro = await this.getRetroOrThrow(retroId);
    const { caps } = await this.currentPhaseCaps(retro);
    this.assertCanEditOwnCards(caps);

    const participant = await this.requireParticipant(user, retroId);
    const card = await this.prisma.card.findFirst({
      where: { id: cardId, retroId },
    });
    if (!card) throw new NotFoundException('Card not found');
    if (card.authorId !== participant.id) {
      throw new ForbiddenException('Can only edit your own cards');
    }

    if (!card.content.trim() && card.imageUrl) {
      throw new BadRequestException(
        'Cannot remove the only content of the comment',
      );
    }

    const previousUrl = card.imageUrl;
    const updated = await this.prisma.card.update({
      where: { id: cardId },
      data: { imageUrl: null },
      include: cardInclude,
    });
    await this.uploads.deleteByPublicUrl(previousUrl);
    this.events.emit(retroId, 'card-updated', updated);
    return updated;
  }

  async deleteCard(user: JwtPayload, retroId: string, cardId: string) {
    await this.loadAccess(user, retroId);
    const retro = await this.getRetroOrThrow(retroId);
    const { caps } = await this.currentPhaseCaps(retro);
    if (!caps.allowCreateCards) {
      throw new BadRequestException(
        'Cards cannot be deleted in the current phase',
      );
    }

    const facilitator = await this.isFacilitator(user, retroId);
    const participant = facilitator
      ? await this.findParticipant(user, retroId)
      : await this.requireParticipant(user, retroId);
    const card = await this.prisma.card.findFirst({
      where: { id: cardId, retroId },
    });
    if (!card) throw new NotFoundException('Card not found');
    if (card.authorId !== participant?.id && !facilitator) {
      throw new ForbiddenException('Cannot delete this card');
    }

    const groupId = card.groupId;
    await this.prisma.$transaction(async (tx) => {
      await tx.card.delete({ where: { id: cardId } });
      await this.dissolveIfOrphan(groupId, tx, retro.maxVotesPerCard);
    });
    await this.uploads.deleteByPublicUrl(card.imageUrl);
    if (retro.presenterCardId === cardId) {
      await this.prisma.retrospective.update({
        where: { id: retroId },
        data: { presenterCardId: null },
      });
      this.events.emit(retroId, 'presenter-changed', { presenterCardId: null });
    }
    this.events.emit(retroId, 'card-deleted', { id: cardId, retroId });
    return { deleted: true };
  }

  async setPresenter(user: JwtPayload, retroId: string, cardId: string | null) {
    await this.assertFacilitatorOfRetro(user, retroId);
    const retro = await this.getRetroOrThrow(retroId);
    const { caps } = await this.currentPhaseCaps(retro);
    if (!caps.allowPresentation) {
      throw new BadRequestException(
        'Presentation is not available in the current phase',
      );
    }

    let presenterCardId: string | null = null;
    if (cardId !== null) {
      const card = await this.prisma.card.findFirst({
        where: { id: cardId, retroId },
      });
      if (!card) throw new NotFoundException('Card not found');
      presenterCardId = await this.canonicalPresenterCardId(retroId, card);
    }

    await this.prisma.retrospective.update({
      where: { id: retroId },
      data: { presenterCardId },
    });

    this.events.emit(retroId, 'presenter-changed', { presenterCardId });
    return { presenterCardId };
  }

  async groupCards(user: JwtPayload, retroId: string, dto: GroupCardsDto) {
    const retro = await this.getRetroOrThrow(retroId);
    const { caps } = await this.currentPhaseCaps(retro);
    if (!caps.allowGrouping) {
      throw new BadRequestException(
        'Grouping is not allowed in the current phase',
      );
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

    this.assertSameColumnUnlessAllowed(
      this.groupingRules(retro, caps),
      source.columnId,
      target.columnId,
    );

    if (source.groupId && source.groupId === target.groupId) {
      return this.getBoard(retroId, user);
    }

    const moveGroup = !!dto.moveGroup && !!source.groupId;

    await this.prisma.$transaction(async (tx) => {
      let groupId = target.groupId;
      if (!groupId) {
        const group = await tx.cardGroup.create({
          data: { retroId, title: null },
        });
        groupId = group.id;
        await tx.card.update({
          where: { id: target.id },
          data: { groupId },
        });
      }

      const siblings = await tx.card.findMany({
        where: { groupId },
        select: { position: true },
      });
      let nextPosition =
        Math.max(target.position, -1, ...siblings.map((c) => c.position)) + 1;

      if (moveGroup && source.groupId) {
        const oldGroupId = source.groupId;
        const members = await tx.card.findMany({
          where: { groupId: oldGroupId },
          orderBy: { position: 'asc' },
        });
        for (const member of members) {
          await tx.card.update({
            where: { id: member.id },
            data: {
              groupId,
              columnId: target.columnId,
              position: nextPosition++,
            },
          });
        }
        await this.mergeGroupVotes(
          tx,
          oldGroupId,
          groupId,
          retro.maxVotesPerCard,
        );
        const targetMembers = await tx.card.findMany({
          where: { groupId },
          select: { id: true },
        });
        await this.migrateCardVotesToGroup(
          tx,
          retroId,
          groupId,
          targetMembers.map((m) => m.id),
          retro.maxVotesPerCard,
        );
        await this.dissolveIfOrphan(oldGroupId, tx, retro.maxVotesPerCard);
        return;
      }

      const oldGroupId = source.groupId;
      await tx.card.update({
        where: { id: source.id },
        data: {
          groupId,
          columnId: target.columnId,
          position: nextPosition,
        },
      });
      const groupedMembers = await tx.card.findMany({
        where: { groupId },
        select: { id: true },
      });
      await this.migrateCardVotesToGroup(
        tx,
        retroId,
        groupId,
        groupedMembers.map((m) => m.id),
        retro.maxVotesPerCard,
      );
      await this.dissolveIfOrphan(oldGroupId, tx, retro.maxVotesPerCard);
    });

    await this.emitCardUpdated(retroId, source.id);
    return this.getBoard(retroId, user);
  }

  async ungroupCards(user: JwtPayload, retroId: string, dto: UngroupCardsDto) {
    const retro = await this.getRetroOrThrow(retroId);
    const { caps } = await this.currentPhaseCaps(retro);
    if (!caps.allowGrouping) {
      throw new BadRequestException(
        'Ungrouping is not allowed in the current phase',
      );
    }
    await this.requireParticipant(user, retroId);

    const card = await this.prisma.card.findFirst({
      where: { id: dto.cardId, retroId },
    });
    if (!card) throw new NotFoundException('Card not found');

    let destColumnId = card.columnId;
    if (dto.columnId) {
      const column = await this.prisma.retroColumn.findFirst({
        where: { id: dto.columnId, retroId },
      });
      if (!column) throw new NotFoundException('Column not found');
      destColumnId = column.id;
    }

    this.assertSameColumnUnlessAllowed(
      this.groupingRules(retro, caps),
      card.columnId,
      destColumnId,
    );

    const ungroupAll = !!dto.ungroupAll && !!card.groupId;
    if (!card.groupId && destColumnId === card.columnId) {
      return this.getBoard(retroId, user);
    }

    await this.prisma.$transaction(async (tx) => {
      if (ungroupAll && card.groupId) {
        const oldGroupId = card.groupId;
        const members = await tx.card.findMany({
          where: { groupId: oldGroupId },
          orderBy: { position: 'asc' },
        });
        if (members[0]) {
          await this.convertGroupVotesToCard(
            tx,
            oldGroupId,
            members[0].id,
            retro.maxVotesPerCard,
          );
        }
        const nextPosition = await this.nextLoosePosition(
          retroId,
          destColumnId,
          members.map((m) => m.id),
          tx,
        );
        for (const [index, member] of members.entries()) {
          await tx.card.update({
            where: { id: member.id },
            data: {
              groupId: null,
              columnId: destColumnId,
              position: nextPosition + index,
            },
          });
        }
        await this.dissolveIfOrphan(oldGroupId, tx, retro.maxVotesPerCard);
        return;
      }

      const oldGroupId = card.groupId;
      const nextPosition = await this.nextLoosePosition(
        retroId,
        destColumnId,
        [card.id],
        tx,
      );
      await tx.card.update({
        where: { id: card.id },
        data: {
          groupId: null,
          columnId: destColumnId,
          position: nextPosition,
        },
      });
      await this.dissolveIfOrphan(oldGroupId, tx, retro.maxVotesPerCard);
    });

    await this.emitCardUpdated(retroId, card.id);
    return this.getBoard(retroId, user);
  }

  async setVote(user: JwtPayload, retroId: string, dto: VoteDto) {
    const retro = await this.getRetroOrThrow(retroId);
    const { caps } = await this.currentPhaseCaps(retro);
    if (caps.voting === 'off') {
      throw new BadRequestException(
        'Voting is not allowed in the current phase',
      );
    }
    if (!dto.cardId && !dto.groupId) {
      throw new BadRequestException('cardId or groupId required');
    }
    if (dto.cardId && dto.groupId) {
      throw new BadRequestException('Provide either cardId or groupId');
    }

    const maxVotesPerCard = this.effectiveMaxVotesPerCard(retro, caps);
    if (caps.voting === 'single' && dto.count > 1) {
      throw new BadRequestException(
        'Only one vote per card/group in this phase',
      );
    }

    const participant = await this.requireParticipant(user, retroId);
    await this.collapseGroupedCardVotes(retroId, maxVotesPerCard);

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

    if (dto.count > maxVotesPerCard) {
      throw new BadRequestException(
        `Max ${maxVotesPerCard} votes per card/group`,
      );
    }

    const existing = await this.prisma.vote.findFirst({
      where: {
        participantId: participant.id,
        ...(dto.cardId ? { cardId: dto.cardId } : { groupId: dto.groupId }),
      },
    });

    const [otherVotes, groupedCards] = await Promise.all([
      this.prisma.vote.findMany({
        where: {
          retroId,
          participantId: participant.id,
          ...(existing ? { NOT: { id: existing.id } } : {}),
        },
      }),
      this.prisma.card.findMany({
        where: { retroId, groupId: { not: null } },
        select: { id: true },
      }),
    ]);
    const groupedCardIds = new Set(groupedCards.map((c) => c.id));
    const otherTotal = this.quotaVoteTotal(otherVotes, groupedCardIds);
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
    const myVoteTotal = this.quotaVoteTotal(myVotes, groupedCardIds);
    if (myVoteTotal >= retro.votesPerParticipant && !participant.votesReady) {
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

  /** Toggle an emoji reaction on a card for the current participant. */
  async toggleReaction(user: JwtPayload, retroId: string, dto: ReactionDto) {
    const retro = await this.getRetroOrThrow(retroId);
    const { caps } = await this.currentPhaseCaps(retro);
    if (!caps.allowReactions) {
      throw new BadRequestException(
        'Reactions are not allowed in the current phase',
      );
    }
    const emoji = dto.emoji.trim();
    if (!caps.reactionEmojis.includes(emoji)) {
      throw new BadRequestException('Emoji not allowed in this phase');
    }

    const participant = await this.requireParticipant(user, retroId);
    const card = await this.prisma.card.findFirst({
      where: { id: dto.cardId, retroId },
    });
    if (!card) throw new NotFoundException('Card not found');

    const existing = await this.prisma.cardReaction.findUnique({
      where: {
        cardId_participantId_emoji: {
          cardId: card.id,
          participantId: participant.id,
          emoji,
        },
      },
    });

    let active: boolean;
    if (existing) {
      await this.prisma.cardReaction.delete({ where: { id: existing.id } });
      active = false;
    } else {
      await this.prisma.cardReaction.create({
        data: {
          retroId,
          cardId: card.id,
          participantId: participant.id,
          emoji,
        },
      });
      active = true;
    }

    const reactions = await this.prisma.cardReaction.findMany({
      where: { cardId: card.id },
    });
    const payload = { cardId: card.id, reactions };
    this.events.emit(retroId, 'card-reaction', payload);
    return { ...payload, active };
  }

  /** Set (or clear with `value: null`) the participant's traffic-light vote on an item. */
  async setSemaforoVote(
    user: JwtPayload,
    retroId: string,
    dto: SemaforoVoteDto,
  ) {
    const retro = await this.getRetroOrThrow(retroId);
    const { caps } = await this.currentPhaseCaps(retro);
    if (caps.closed || caps.kind !== 'semaforo') {
      throw new BadRequestException(
        'Semaforo voting is only available in the semaforo phase',
      );
    }

    const participant = await this.requireParticipant(user, retroId);
    const item = await this.prisma.retroSemaforoItem.findFirst({
      where: { id: dto.itemId, retroId },
    });
    if (!item) throw new NotFoundException('Semaforo item not found');

    const key = {
      itemId_participantId: {
        itemId: item.id,
        participantId: participant.id,
      },
    };

    if (dto.value === null || dto.value === undefined) {
      await this.prisma.semaforoVote.deleteMany({
        where: { itemId: item.id, participantId: participant.id },
      });
    } else {
      await this.prisma.semaforoVote.upsert({
        where: key,
        create: {
          retroId,
          itemId: item.id,
          participantId: participant.id,
          value: dto.value,
        },
        update: { value: dto.value },
      });
    }

    const payload = {
      itemId: item.id,
      participantId: participant.id,
      value: dto.value ?? null,
    };
    this.events.emit(retroId, 'semaforo-vote', payload);
    return payload;
  }

  /** Facilitator-only note on a semaforo item, written during the review phase. */
  async setSemaforoNote(
    user: JwtPayload,
    retroId: string,
    itemId: string,
    note: string | null,
  ) {
    await this.assertFacilitatorOfRetro(user, retroId);
    const retro = await this.getRetroOrThrow(retroId);
    const { caps } = await this.currentPhaseCaps(retro);
    if (caps.kind !== 'semaforo_review') {
      throw new BadRequestException(
        'Semaforo notes can only be edited in the review phase',
      );
    }

    const item = await this.prisma.retroSemaforoItem.findFirst({
      where: { id: itemId, retroId },
    });
    if (!item) throw new NotFoundException('Semaforo item not found');

    const trimmed = note?.trim() || null;
    const updated = await this.prisma.retroSemaforoItem.update({
      where: { id: item.id },
      data: { note: trimmed },
    });

    const payload = { itemId: updated.id, note: updated.note };
    this.events.emit(retroId, 'semaforo-note', payload);
    return payload;
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
      data: { timerSeconds: seconds, timerEndsAt, timerPausedRemaining: null },
    });

    this.emitTimer(retroId, updated);

    return {
      timerSeconds: updated.timerSeconds,
      timerEndsAt: updated.timerEndsAt,
      timerPausedRemaining: updated.timerPausedRemaining,
    };
  }

  async pauseTimer(user: JwtPayload, retroId: string) {
    await this.assertFacilitatorOfRetro(user, retroId);
    const retro = await this.getRetroOrThrow(retroId);
    if (!retro.timerEndsAt) {
      throw new BadRequestException('El timer no está en marcha');
    }
    const remaining = Math.max(
      0,
      Math.ceil((retro.timerEndsAt.getTime() - Date.now()) / 1000),
    );
    const updated = await this.prisma.retrospective.update({
      where: { id: retroId },
      data:
        remaining < 1
          ? { timerEndsAt: null, timerPausedRemaining: null }
          : { timerEndsAt: null, timerPausedRemaining: remaining },
    });
    this.emitTimer(retroId, updated);
    return {
      timerSeconds: updated.timerSeconds,
      timerEndsAt: updated.timerEndsAt,
      timerPausedRemaining: updated.timerPausedRemaining,
    };
  }

  async resumeTimer(user: JwtPayload, retroId: string) {
    await this.assertFacilitatorOfRetro(user, retroId);
    const retro = await this.getRetroOrThrow(retroId);
    const remaining = retro.timerPausedRemaining;
    if (remaining == null || remaining < 1) {
      throw new BadRequestException('El timer no está en pausa');
    }
    const timerEndsAt = new Date(Date.now() + remaining * 1000);
    const updated = await this.prisma.retrospective.update({
      where: { id: retroId },
      data: { timerEndsAt, timerPausedRemaining: null },
    });
    this.emitTimer(retroId, updated);
    return {
      timerSeconds: updated.timerSeconds,
      timerEndsAt: updated.timerEndsAt,
      timerPausedRemaining: updated.timerPausedRemaining,
    };
  }

  async addTimerSeconds(user: JwtPayload, retroId: string, dto: TimerAddDto) {
    await this.assertFacilitatorOfRetro(user, retroId);
    const retro = await this.getRetroOrThrow(retroId);
    const extra = dto.seconds ?? 60;
    if (retro.timerEndsAt) {
      const base = Math.max(Date.now(), retro.timerEndsAt.getTime());
      const updated = await this.prisma.retrospective.update({
        where: { id: retroId },
        data: { timerEndsAt: new Date(base + extra * 1000) },
      });
      this.emitTimer(retroId, updated);
      return {
        timerSeconds: updated.timerSeconds,
        timerEndsAt: updated.timerEndsAt,
        timerPausedRemaining: updated.timerPausedRemaining,
      };
    }
    if (retro.timerPausedRemaining != null) {
      const updated = await this.prisma.retrospective.update({
        where: { id: retroId },
        data: { timerPausedRemaining: retro.timerPausedRemaining + extra },
      });
      this.emitTimer(retroId, updated);
      return {
        timerSeconds: updated.timerSeconds,
        timerEndsAt: updated.timerEndsAt,
        timerPausedRemaining: updated.timerPausedRemaining,
      };
    }
    throw new BadRequestException('El timer no está activo');
  }

  async stopTimer(user: JwtPayload, retroId: string) {
    await this.assertFacilitatorOfRetro(user, retroId);
    const updated = await this.prisma.retrospective.update({
      where: { id: retroId },
      data: { timerEndsAt: null, timerPausedRemaining: null },
    });

    this.emitTimer(retroId, updated);

    return {
      timerSeconds: updated.timerSeconds,
      timerEndsAt: null,
      timerPausedRemaining: null,
    };
  }

  private emitTimer(
    retroId: string,
    retro: {
      timerSeconds: number | null;
      timerEndsAt: Date | null;
      timerPausedRemaining: number | null;
    },
  ) {
    this.events.emit(retroId, 'timer-updated', {
      timerSeconds: retro.timerSeconds,
      timerEndsAt: retro.timerEndsAt,
      timerPausedRemaining: retro.timerPausedRemaining,
      running: !!retro.timerEndsAt,
    });
  }

  async submitRoti(user: JwtPayload, retroId: string, dto: RotiDto) {
    const retro = await this.getRetroOrThrow(retroId);
    const { caps } = await this.currentPhaseCaps(retro);
    if (caps.closed || caps.kind !== 'roti') {
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
    const { caps } = await this.currentPhaseCaps(retro);
    const actionsAllowed =
      caps.allowActionItems ||
      caps.kind === 'action_plan' ||
      caps.kind === 'semaforo_review' ||
      caps.closed;
    if (!actionsAllowed) {
      throw new BadRequestException('Actions not available in this phase');
    }
    await this.requireParticipant(user, retroId);

    if (dto.cardId && dto.groupId) {
      throw new BadRequestException('Link either a card or a group, not both');
    }

    let cardId: string | null = null;
    let groupId: string | null = null;
    if (dto.groupId) {
      const group = await this.prisma.cardGroup.findFirst({
        where: { id: dto.groupId, retroId },
      });
      if (!group) throw new BadRequestException('Group not found');
      groupId = group.id;
    } else if (dto.cardId) {
      const card = await this.prisma.card.findFirst({
        where: { id: dto.cardId, retroId },
      });
      if (!card) throw new BadRequestException('Card not found');
      cardId = card.id;
    }

    const action = await this.prisma.actionItem.create({
      data: {
        teamId: retro.teamId,
        retroId,
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        ownerId: dto.ownerId || null,
        createdById: user.type === 'user' ? user.sub : null,
        dueDate: parseOptionalDueDate(dto.dueDate) ?? null,
        cardId,
        groupId,
      },
      include: actionItemInclude,
    });

    const payload = serializeActionItem(action);
    this.events.emit(retroId, 'action-created', payload);
    this.events.emitToTeam(retro.teamId, 'action-created', payload);
    return payload;
  }

  private async getBoard(retroId: string, user: JwtPayload, forReport = false) {
    await this.collapseGroupedCardVotes(retroId);
    const retro = await this.prisma.retrospective.findUnique({
      where: { id: retroId },
      include: boardInclude,
    });
    if (!retro) throw new NotFoundException('Retrospective not found');

    const participant = await this.findParticipant(user, retroId);
    const facilitator = await this.isFacilitator(user, retroId);

    const currentPhase =
      retro.phases.find((p) => p.id === retro.currentPhaseId) ??
      retro.phases[0] ??
      null;
    const caps = currentPhase ? this.effectiveCaps(retro, currentPhase) : null;
    const closed = !!retro.closedAt;

    const hiddenColumnIds = new Set(
      currentPhase?.hiddenColumns.map((h) => h.columnId) ?? [],
    );
    // Facilitator (and the report) sees every column; participants only the visible ones.
    const filterHidden = !forReport && !facilitator && hiddenColumnIds.size > 0;
    const columns = filterHidden
      ? retro.columns.filter((c) => !hiddenColumnIds.has(c.id))
      : retro.columns;

    const participantById = new Map(retro.participants.map((p) => [p.id, p]));
    const readyForReveal = (authorId: string) => {
      const author = participantById.get(authorId);
      if (!author || !caps) return false;
      if (caps.kind === 'semaforo') return author.semaforoReady;
      if (caps.voting !== 'off') return author.votesReady;
      return author.commentsReady;
    };

    // Others' cards may be visible, blurred or hidden depending on the phase.
    const othersVisibility =
      forReport || facilitator || !caps ? 'visible' : caps.othersVisibility;
    const revealOnReady = !!caps?.revealOnReady;
    const forceAnonymous = !forReport && !!caps?.anonymousCards;
    const hideCounts =
      !forReport && !facilitator && !!caps?.hideVoteCounts && !closed;

    const onlyMine = <T extends { participantId: string }>(list: T[]) =>
      participant ? list.filter((v) => v.participantId === participant.id) : [];

    const cards = retro.cards
      .filter((card) => !filterHidden || !hiddenColumnIds.has(card.columnId))
      .map((card) => {
        const isOwn = !!participant && card.authorId === participant.id;
        const anonymous = card.isAnonymous || (forceAnonymous && !isOwn);
        const authorName = anonymous
          ? 'Anonymous'
          : (card.author.guestName ?? card.author.user?.name ?? 'Participant');
        const authorAvatarId = anonymous
          ? null
          : resolveParticipantAvatar(card.author);

        const votes = hideCounts ? onlyMine(card.votes) : card.votes;
        const reactions = hideCounts
          ? onlyMine(card.reactions)
          : card.reactions;

        const concealed =
          othersVisibility !== 'visible' &&
          !isOwn &&
          !(revealOnReady && readyForReveal(card.authorId));

        if (concealed) {
          return {
            ...card,
            votes,
            reactions,
            content: '•••••',
            imageUrl: null,
            hidden: othersVisibility === 'hidden',
            blurred: othersVisibility === 'blurred',
            authorName: anonymous ? 'Anonymous' : 'Hidden',
            authorAvatarId: null,
          };
        }

        return {
          ...card,
          votes,
          reactions,
          hidden: false,
          blurred: false,
          authorName,
          authorAvatarId,
        };
      });

    const groups = hideCounts
      ? retro.groups.map((g) => ({ ...g, votes: onlyMine(g.votes) }))
      : retro.groups;
    const votes = hideCounts ? onlyMine(retro.votes) : retro.votes;
    const reactions = hideCounts ? onlyMine(retro.reactions) : retro.reactions;

    const groupedCardIds = new Set(
      retro.cards.filter((c) => c.groupId).map((c) => c.id),
    );
    const myCommentCount = participant
      ? retro.cards.filter((c) => c.authorId === participant.id).length
      : 0;
    const myVotes = participant
      ? retro.votes.filter((v) => v.participantId === participant.id)
      : [];
    const myVoteTotal = this.quotaVoteTotal(myVotes, groupedCardIds);

    const participantName = (p: (typeof retro.participants)[number]) =>
      p.guestName ?? p.user?.name ?? (p.isGuest ? 'Invitado' : 'Participante');

    const commentProgress = retro.participants.map((p) => {
      const commentCount = retro.cards.filter(
        (c) => c.authorId === p.id,
      ).length;
      return {
        participantId: p.id,
        name: participantName(p),
        avatarId: resolveParticipantAvatar(p),
        ownerId: p.user?.id ?? p.id,
        commentCount,
        isReady: p.commentsReady,
      };
    });
    const readyCount = commentProgress.filter((p) => p.isReady).length;

    const voteProgressParticipants = retro.participants.map((p) => {
      const voteCount = this.quotaVoteTotal(
        retro.votes.filter((v) => v.participantId === p.id),
        groupedCardIds,
      );
      return {
        participantId: p.id,
        name: participantName(p),
        avatarId: resolveParticipantAvatar(p),
        ownerId: p.user?.id ?? p.id,
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

    const semaforoProgressParticipants = retro.participants.map((p) => ({
      participantId: p.id,
      name: participantName(p),
      avatarId: resolveParticipantAvatar(p),
      ownerId: p.user?.id ?? p.id,
      voteCount: retro.semaforoVotes.filter((v) => v.participantId === p.id)
        .length,
      isReady: p.semaforoReady,
    }));
    const semaforoReadyCount = semaforoProgressParticipants.filter(
      (p) => p.isReady,
    ).length;

    const semaforoItems = retro.semaforoItems.map((item) => {
      const itemVotes = retro.semaforoVotes
        .filter((v) => v.itemId === item.id)
        .map((v) => ({
          participantId: v.participantId,
          value: v.value,
        }));
      const summary = { red: 0, yellow: 0, green: 0 };
      for (const v of itemVotes) summary[v.value] += 1;
      return { ...item, votes: itemVotes, summary };
    });

    const phases = retro.phases.map(({ hiddenColumns, ...phase }) => ({
      ...phase,
      hiddenColumnIds: hiddenColumns.map((h) => h.columnId),
    }));

    return {
      ...retro,
      closed,
      currentPhaseId: currentPhase?.id ?? null,
      currentPhase: currentPhase
        ? {
            ...phases.find((p) => p.id === currentPhase.id)!,
            capabilities: caps,
          }
        : null,
      phases,
      columns,
      voteCountsHidden: hideCounts,
      participants: retro.participants.map((p) => ({
        ...p,
        avatarId: resolveParticipantAvatar(p),
        user: p.user
          ? {
              ...p.user,
              avatarId: parseAvatarId(p.user.avatarId, p.user.id),
            }
          : p.user,
      })),
      actionItems: retro.actionItems.map(serializeActionItem),
      cards,
      groups,
      votes,
      reactions,
      semaforoItems,
      semaforoVotes: hideCounts
        ? onlyMine(retro.semaforoVotes)
        : retro.semaforoVotes,
      commentProgress: {
        written: readyCount,
        total: commentProgress.length,
        allDone:
          commentProgress.length > 0 && readyCount === commentProgress.length,
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
      semaforoProgress: {
        ready: semaforoReadyCount,
        total: semaforoProgressParticipants.length,
        allDone:
          semaforoProgressParticipants.length > 0 &&
          semaforoReadyCount === semaforoProgressParticipants.length,
        itemCount: retro.semaforoItems.length,
        participants: semaforoProgressParticipants,
      },
      me: {
        participantId: participant?.id,
        myCommentCount,
        myVoteTotal,
        votesRemaining: Math.max(0, retro.votesPerParticipant - myVoteTotal),
        commentsReady: participant?.commentsReady ?? false,
        votesReady: participant?.votesReady ?? false,
        semaforoReady: participant?.semaforoReady ?? false,
        isFacilitator: facilitator,
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Phase helpers
  // ---------------------------------------------------------------------------

  /** Current RetroPhase for a retro: by `currentPhaseId`, else the first one by position. */
  private async getCurrentPhase(retro: {
    id: string;
    currentPhaseId: string | null;
  }): Promise<RetroPhaseRecord> {
    if (retro.currentPhaseId) {
      const phase = await this.prisma.retroPhase.findFirst({
        where: { id: retro.currentPhaseId, retroId: retro.id },
        include: { hiddenColumns: true },
      });
      if (phase) return phase;
    }
    const first = await this.prisma.retroPhase.findFirst({
      where: { retroId: retro.id },
      orderBy: { position: 'asc' },
      include: { hiddenColumns: true },
    });
    if (!first) {
      throw new BadRequestException('Retrospective has no phases');
    }
    return first;
  }

  private async currentPhaseCaps(retro: RetroRecord) {
    const phase = await this.getCurrentPhase(retro);
    return { phase, caps: this.effectiveCaps(retro, phase) };
  }

  /**
   * Capabilities of a phase snapshot. When the retro is closed every mutation
   * is turned off except creating action items (matching the legacy `closed` status).
   */
  private effectiveCaps(
    retro: { closedAt: Date | null },
    phase: RetroPhaseRecord,
  ): EffectiveCaps {
    const caps = phaseCapabilities(phase);
    const closed = !!retro.closedAt;
    if (!closed) {
      return { ...caps, kind: phase.kind, closed };
    }
    return {
      ...caps,
      kind: phase.kind,
      closed,
      allowCreateCards: false,
      allowEditOwnCards: false,
      allowGrouping: false,
      allowCrossColumnGrouping: false,
      voting: 'off',
      allowReactions: false,
      allowPresentation: false,
      showReadyCheck: false,
      allowActionItems: true,
      // Nothing to conceal once the retro is over.
      othersVisibility: 'visible',
      revealOnReady: false,
      hideVoteCounts: false,
    };
  }

  private assertCanEditOwnCards(caps: EffectiveCaps) {
    if (!caps.allowCreateCards || !caps.allowEditOwnCards) {
      throw new BadRequestException(
        'Cards cannot be edited in the current phase',
      );
    }
  }

  /** Where-clause counting the cards that consume a participant's quota. */
  private cardQuotaWhere(
    retroId: string,
    participantId: string,
    phase: RetroPhaseRecord,
    caps: EffectiveCaps,
  ): Prisma.CardWhereInput {
    // A per-phase limit counts only cards created in this phase; the retro-wide
    // limit counts every card of the participant.
    if (caps.maxCardsPerParticipant != null) {
      return { retroId, authorId: participantId, createdInPhaseId: phase.id };
    }
    return { retroId, authorId: participantId };
  }

  private effectiveMaxVotesPerCard(
    retro: { maxVotesPerCard: number },
    caps: EffectiveCaps,
  ) {
    return caps.voting === 'single' ? 1 : retro.maxVotesPerCard;
  }

  private groupingRules(
    retro: { allowCrossColumnGrouping: boolean },
    caps: EffectiveCaps,
  ) {
    return {
      allowCrossColumnGrouping:
        retro.allowCrossColumnGrouping || caps.allowCrossColumnGrouping,
    };
  }

  // ---------------------------------------------------------------------------
  // Access helpers
  // ---------------------------------------------------------------------------

  private async ensureMemberParticipant(
    userId: string,
    retroId: string,
    teamId: string,
  ) {
    await this.teams.assertMemberOrAdmin(userId, teamId);

    let participant = await this.prisma.participant.findFirst({
      where: { retroId, userId, isGuest: false },
      include: {
        user: { select: userPublicSelect },
      },
    });

    if (!participant) {
      participant = await this.prisma.participant.create({
        data: {
          retroId,
          userId,
          isGuest: false,
        },
        include: {
          user: { select: userPublicSelect },
        },
      });
      this.events.emit(retroId, 'participant-joined', participant);
    }

    return participant;
  }

  private async loadAccess(user: JwtPayload, retroId: string) {
    const retro = await this.getRetroOrThrow(retroId);
    if (user.type === 'guest') {
      if (user.retroId !== retroId) {
        throw new ForbiddenException(
          'Guest token does not match retrospective',
        );
      }
      return;
    }
    if (user.type === 'anonymous') {
      throw new ForbiddenException('Authentication required');
    }
    const participant = await this.findParticipant(user, retroId);
    if (participant) return;
    await this.teams.assertMemberOrThrowJoinDenied(user.sub, retro.teamId);
  }

  private async assertFacilitatorOfRetro(user: JwtPayload, retroId: string) {
    if (user.type !== 'user') {
      throw new ForbiddenException('Facilitator role required');
    }
    const retro = await this.getRetroOrThrow(retroId);
    await this.teams.assertFacilitatorOrAdmin(user.sub, retro.teamId);
  }

  private async isFacilitator(user: JwtPayload, retroId: string) {
    if (user.type !== 'user') return false;
    if (await this.teams.isAdmin(user.sub)) return true;
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

  private async canonicalPresenterCardId(
    retroId: string,
    card: { id: string; groupId: string | null },
  ) {
    if (!card.groupId) return card.id;
    const header = await this.prisma.card.findFirst({
      where: { retroId, groupId: card.groupId },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });
    return header?.id ?? card.id;
  }

  private assertSameColumnUnlessAllowed(
    rules: { allowCrossColumnGrouping: boolean },
    sourceColumnId: string,
    destColumnId: string,
  ) {
    if (rules.allowCrossColumnGrouping) return;
    if (sourceColumnId !== destColumnId) {
      throw new BadRequestException(
        'Solo se pueden agrupar tarjetas de la misma columna',
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Vote helpers
  // ---------------------------------------------------------------------------

  private quotaVoteTotal(
    votes: { cardId: string | null; count: number }[],
    groupedCardIds: Set<string>,
  ) {
    return votes
      .filter((v) => !v.cardId || !groupedCardIds.has(v.cardId))
      .reduce((s, v) => s + v.count, 0);
  }

  private async collapseGroupedCardVotes(
    retroId: string,
    maxVotesPerCard?: number,
  ) {
    const stale = await this.prisma.vote.findMany({
      where: { retroId, card: { groupId: { not: null } } },
      select: { card: { select: { groupId: true } } },
    });
    if (!stale.length) return false;
    const cap =
      maxVotesPerCard ??
      (
        await this.prisma.retrospective.findUnique({
          where: { id: retroId },
          select: { maxVotesPerCard: true },
        })
      )?.maxVotesPerCard;
    if (cap == null) return false;
    const groupIds = [
      ...new Set(
        stale.map((v) => v.card?.groupId).filter((id): id is string => !!id),
      ),
    ];
    await this.prisma.$transaction(async (tx) => {
      for (const groupId of groupIds) {
        const members = await tx.card.findMany({
          where: { groupId },
          select: { id: true },
        });
        await this.migrateCardVotesToGroup(
          tx,
          retroId,
          groupId,
          members.map((m) => m.id),
          cap,
        );
      }
    });
    return true;
  }

  private async migrateCardVotesToGroup(
    tx: Prisma.TransactionClient,
    retroId: string,
    groupId: string,
    memberIds: string[],
    maxVotesPerCard: number,
  ) {
    if (!memberIds.length) return;
    const cardVotes = await tx.vote.findMany({
      where: { retroId, cardId: { in: memberIds } },
    });
    if (!cardVotes.length) return;

    const byParticipant = new Map<string, typeof cardVotes>();
    for (const vote of cardVotes) {
      const list = byParticipant.get(vote.participantId) ?? [];
      list.push(vote);
      byParticipant.set(vote.participantId, list);
    }

    for (const [participantId, votes] of byParticipant) {
      const migrated = Math.max(...votes.map((v) => v.count));
      const existing = await tx.vote.findFirst({
        where: { participantId, groupId },
      });
      const next = Math.min(
        maxVotesPerCard,
        Math.max(migrated, existing?.count ?? 0),
      );
      await tx.vote.deleteMany({
        where: { id: { in: votes.map((v) => v.id) } },
      });
      if (next <= 0) {
        if (existing) {
          await tx.vote.delete({ where: { id: existing.id } });
        }
        continue;
      }
      if (existing) {
        await tx.vote.update({
          where: { id: existing.id },
          data: { count: next },
        });
      } else {
        await tx.vote.create({
          data: {
            retroId,
            participantId,
            groupId,
            cardId: null,
            count: next,
          },
        });
      }
    }
  }

  private async mergeGroupVotes(
    tx: Prisma.TransactionClient,
    fromGroupId: string,
    toGroupId: string,
    maxVotesPerCard: number,
  ) {
    if (fromGroupId === toGroupId) return;
    const fromVotes = await tx.vote.findMany({
      where: { groupId: fromGroupId },
    });
    for (const vote of fromVotes) {
      const existing = await tx.vote.findFirst({
        where: { participantId: vote.participantId, groupId: toGroupId },
      });
      const next = Math.min(
        maxVotesPerCard,
        Math.max(vote.count, existing?.count ?? 0),
      );
      if (existing) {
        await tx.vote.update({
          where: { id: existing.id },
          data: { count: next },
        });
        await tx.vote.delete({ where: { id: vote.id } });
      } else if (next <= 0) {
        await tx.vote.delete({ where: { id: vote.id } });
      } else {
        await tx.vote.update({
          where: { id: vote.id },
          data: { groupId: toGroupId, count: next },
        });
      }
    }
  }

  private async convertGroupVotesToCard(
    tx: Prisma.TransactionClient,
    groupId: string,
    cardId: string,
    maxVotesPerCard: number,
  ) {
    const groupVotes = await tx.vote.findMany({ where: { groupId } });
    for (const vote of groupVotes) {
      const existing = await tx.vote.findFirst({
        where: { participantId: vote.participantId, cardId },
      });
      const next = Math.min(
        maxVotesPerCard,
        Math.max(vote.count, existing?.count ?? 0),
      );
      if (existing) {
        await tx.vote.update({
          where: { id: existing.id },
          data: { count: next },
        });
        await tx.vote.delete({ where: { id: vote.id } });
      } else {
        await tx.vote.update({
          where: { id: vote.id },
          data: { groupId: null, cardId, count: next },
        });
      }
    }
  }

  private async dissolveIfOrphan(
    groupId: string | null | undefined,
    tx: Prisma.TransactionClient,
    maxVotesPerCard: number,
  ) {
    if (!groupId) return;
    const remaining = await tx.card.findMany({
      where: { groupId },
      select: { id: true },
    });
    if (remaining.length > 1) return;
    if (remaining.length === 1) {
      await this.convertGroupVotesToCard(
        tx,
        groupId,
        remaining[0].id,
        maxVotesPerCard,
      );
      await tx.card.update({
        where: { id: remaining[0].id },
        data: { groupId: null },
      });
    }
    const group = await tx.cardGroup.findUnique({ where: { id: groupId } });
    if (group) {
      await tx.cardGroup.delete({ where: { id: groupId } });
    }
  }

  private async nextLoosePosition(
    retroId: string,
    columnId: string,
    excludeIds: string[],
    tx: Prisma.TransactionClient,
  ) {
    const loose = await tx.card.findMany({
      where: {
        retroId,
        columnId,
        groupId: null,
        ...(excludeIds.length ? { id: { notIn: excludeIds } } : {}),
      },
      select: { position: true },
    });
    if (!loose.length) return 0;
    return Math.max(...loose.map((c) => c.position)) + 1;
  }

  private async emitCardUpdated(retroId: string, cardId: string) {
    const updated = await this.prisma.card.findFirst({
      where: { id: cardId, retroId },
      include: cardInclude,
    });
    if (updated) {
      this.events.emit(retroId, 'card-updated', updated);
    }
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
