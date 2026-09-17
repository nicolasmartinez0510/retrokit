import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CardContentMode,
  CardSort,
  OthersVisibility,
  PhaseKind,
  Prisma,
  VotingMode,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TeamsService } from '../teams/teams.service';
import {
  normalizePhase,
  type PhaseCapabilitiesInput,
} from '../retros/phase-rules';
import { CreatePhaseDto, UpdatePhaseDto } from './dto/phases.dto';

const createdBySelect = {
  id: true,
  name: true,
  email: true,
} as const;

@Injectable()
export class PhasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly teams: TeamsService,
  ) {}

  async list(userId: string) {
    const admin = await this.teams.isAdmin(userId);
    const where: Prisma.PhaseWhereInput = admin
      ? {}
      : { OR: [{ isGlobal: true }, { createdById: userId }] };

    const phases = await this.prisma.phase.findMany({
      where,
      include: {
        ...(admin ? { createdBy: { select: createdBySelect } } : {}),
        _count: { select: { templates: true } },
      },
      orderBy: [{ isSystem: 'desc' }, { isGlobal: 'desc' }, { name: 'asc' }],
    });

    return phases.map((p) => ({
      ...p,
      templateCount: p._count.templates,
      _count: undefined,
    }));
  }

  async getOne(id: string, userId: string) {
    const admin = await this.teams.isAdmin(userId);
    const phase = await this.prisma.phase.findUnique({
      where: { id },
      include: {
        ...(admin ? { createdBy: { select: createdBySelect } } : {}),
        _count: { select: { templates: true } },
        templates: {
          include: { template: { select: { id: true, name: true } } },
          orderBy: { template: { name: 'asc' } },
        },
      },
    });
    if (!phase) throw new NotFoundException('Fase no encontrada');
    if (!admin && !phase.isGlobal && phase.createdById !== userId) {
      throw new NotFoundException('Fase no encontrada');
    }
    return {
      ...phase,
      templateCount: phase._count.templates,
      usedIn: phase.templates.map((t) => t.template),
      _count: undefined,
      templates: undefined,
    };
  }

  async create(userId: string, dto: CreatePhaseDto) {
    const admin = await this.teams.isAdmin(userId);
    if (!admin) {
      await this.teams.assertAnyFacilitator(userId);
    }
    if (dto.isGlobal && !admin) {
      throw new ForbiddenException('Sólo un admin puede crear fases globales');
    }

    const caps = this.capsFromDto(dto);
    const normalized = normalizePhase(caps);

    return this.prisma.phase.create({
      data: {
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        kind: normalized.kind as PhaseKind,
        icon: dto.icon?.trim() || null,
        color: dto.color?.trim() || null,
        instructions: dto.instructions?.trim() || null,
        timerSeconds: dto.timerSeconds ?? null,
        isGlobal: admin ? !!dto.isGlobal : false,
        isSystem: false,
        createdById: userId,
        ...this.capsToPrisma(normalized),
      },
    });
  }

  async update(userId: string, id: string, dto: UpdatePhaseDto) {
    const existing = await this.assertCanEdit(userId, id);
    if (existing.isSystem) {
      throw new BadRequestException(
        'Las fases del sistema no se editan. Duplicalas para personalizarlas.',
      );
    }

    const admin = await this.teams.isAdmin(userId);
    if (dto.isGlobal !== undefined && dto.isGlobal && !admin) {
      throw new ForbiddenException('Sólo un admin puede marcar fases globales');
    }

    const caps = normalizePhase({
      kind: (dto.kind ?? existing.kind) as PhaseCapabilitiesInput['kind'],
      allowCreateCards: dto.allowCreateCards ?? existing.allowCreateCards,
      cardContent: (dto.cardContent ??
        existing.cardContent) as PhaseCapabilitiesInput['cardContent'],
      maxCardsPerParticipant:
        dto.maxCardsPerParticipant !== undefined
          ? dto.maxCardsPerParticipant
          : existing.maxCardsPerParticipant,
      allowEditOwnCards: dto.allowEditOwnCards ?? existing.allowEditOwnCards,
      anonymousCards: dto.anonymousCards ?? existing.anonymousCards,
      othersVisibility: (dto.othersVisibility ??
        existing.othersVisibility) as PhaseCapabilitiesInput['othersVisibility'],
      revealOnReady: dto.revealOnReady ?? existing.revealOnReady,
      allowGrouping: dto.allowGrouping ?? existing.allowGrouping,
      allowCrossColumnGrouping:
        dto.allowCrossColumnGrouping ?? existing.allowCrossColumnGrouping,
      voting: (dto.voting ??
        existing.voting) as PhaseCapabilitiesInput['voting'],
      hideVoteCounts: dto.hideVoteCounts ?? existing.hideVoteCounts,
      allowReactions: dto.allowReactions ?? existing.allowReactions,
      reactionEmojis: dto.reactionEmojis ?? existing.reactionEmojis,
      semaforoEmojis: dto.semaforoEmojis ?? existing.semaforoEmojis,
      allowPresentation: dto.allowPresentation ?? existing.allowPresentation,
      allowActionItems: dto.allowActionItems ?? existing.allowActionItems,
      showReadyCheck: dto.showReadyCheck ?? existing.showReadyCheck,
      defaultSort: (dto.defaultSort ??
        existing.defaultSort) as PhaseCapabilitiesInput['defaultSort'],
    });

    return this.prisma.phase.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description?.trim() || null }
          : {}),
        ...(dto.icon !== undefined ? { icon: dto.icon?.trim() || null } : {}),
        ...(dto.color !== undefined
          ? { color: dto.color?.trim() || null }
          : {}),
        ...(dto.instructions !== undefined
          ? { instructions: dto.instructions?.trim() || null }
          : {}),
        ...(dto.timerSeconds !== undefined
          ? { timerSeconds: dto.timerSeconds }
          : {}),
        ...(dto.isGlobal !== undefined && admin
          ? { isGlobal: dto.isGlobal }
          : {}),
        kind: caps.kind as PhaseKind,
        ...this.capsToPrisma(caps),
      },
    });
  }

  async duplicate(userId: string, id: string) {
    const source = await this.getOne(id, userId);
    const admin = await this.teams.isAdmin(userId);
    if (!admin) {
      await this.teams.assertAnyFacilitator(userId);
    }

    return this.prisma.phase.create({
      data: {
        name: `${source.name} (copia)`,
        description: source.description,
        kind: source.kind,
        icon: source.icon,
        color: source.color,
        instructions: source.instructions,
        timerSeconds: source.timerSeconds,
        isGlobal: false,
        isSystem: false,
        createdById: userId,
        allowCreateCards: source.allowCreateCards,
        cardContent: source.cardContent,
        maxCardsPerParticipant: source.maxCardsPerParticipant,
        allowEditOwnCards: source.allowEditOwnCards,
        anonymousCards: source.anonymousCards,
        othersVisibility: source.othersVisibility,
        revealOnReady: source.revealOnReady,
        allowGrouping: source.allowGrouping,
        allowCrossColumnGrouping: source.allowCrossColumnGrouping,
        voting: source.voting,
        hideVoteCounts: source.hideVoteCounts,
        allowReactions: source.allowReactions,
        reactionEmojis: source.reactionEmojis,
        semaforoEmojis: source.semaforoEmojis,
        allowPresentation: source.allowPresentation,
        allowActionItems: source.allowActionItems,
        showReadyCheck: source.showReadyCheck,
        defaultSort: source.defaultSort,
      },
    });
  }

  async remove(
    userId: string,
    id: string,
    opts: { force?: boolean } = {},
  ) {
    await this.assertCanDelete(userId, id);

    const usage = await this.prisma.templatePhase.findMany({
      where: { phaseId: id },
      include: { template: { select: { id: true, name: true } } },
    });

    if (usage.length && !opts.force) {
      throw new BadRequestException({
        message: 'La fase está en uso en plantillas',
        templates: usage.map((u) => u.template),
      });
    }

    // Detach from templates first (FK is Restrict). Retro snapshots keep
    // their own RetroPhase rows via sourcePhaseId (no FK), so they are safe.
    if (usage.length) {
      await this.prisma.templatePhase.deleteMany({ where: { phaseId: id } });
    }

    await this.prisma.phase.delete({ where: { id } });
    return { ok: true };
  }

  /** Edit: admin any custom; facilitators only own. System never editable. */
  private async assertCanEdit(userId: string, id: string) {
    const admin = await this.teams.isAdmin(userId);
    const phase = await this.prisma.phase.findUnique({ where: { id } });
    if (!phase) throw new NotFoundException('Fase no encontrada');
    if (phase.isSystem) {
      throw new ForbiddenException(
        'Las fases del sistema no se editan. Duplicalas para personalizarlas.',
      );
    }
    if (!admin && phase.createdById !== userId) {
      throw new ForbiddenException('No podés editar esta fase');
    }
    return phase;
  }

  /**
   * Delete: admin any phase (incl. system); facilitators only own custom.
   * System phases are never deletable by facilitators.
   */
  private async assertCanDelete(userId: string, id: string) {
    const admin = await this.teams.isAdmin(userId);
    const phase = await this.prisma.phase.findUnique({ where: { id } });
    if (!phase) throw new NotFoundException('Fase no encontrada');
    if (admin) return phase;
    if (phase.isSystem) {
      throw new ForbiddenException(
        'Las fases del sistema no se pueden borrar. Duplicalas para personalizarlas.',
      );
    }
    if (phase.createdById !== userId) {
      throw new ForbiddenException('No podés eliminar esta fase');
    }
    return phase;
  }

  private capsFromDto(dto: CreatePhaseDto | UpdatePhaseDto): PhaseCapabilitiesInput {
    return {
      kind: (dto.kind ?? 'board') as PhaseCapabilitiesInput['kind'],
      allowCreateCards: dto.allowCreateCards ?? true,
      cardContent: (dto.cardContent ??
        'text_and_image') as PhaseCapabilitiesInput['cardContent'],
      maxCardsPerParticipant: dto.maxCardsPerParticipant ?? null,
      allowEditOwnCards: dto.allowEditOwnCards ?? true,
      anonymousCards: dto.anonymousCards ?? false,
      othersVisibility: (dto.othersVisibility ??
        'visible') as PhaseCapabilitiesInput['othersVisibility'],
      revealOnReady: dto.revealOnReady ?? false,
      allowGrouping: dto.allowGrouping ?? false,
      allowCrossColumnGrouping: dto.allowCrossColumnGrouping ?? false,
      voting: (dto.voting ?? 'off') as PhaseCapabilitiesInput['voting'],
      hideVoteCounts: dto.hideVoteCounts ?? false,
      allowReactions: dto.allowReactions ?? false,
      reactionEmojis: dto.reactionEmojis ?? ['👍', '❤️', '🎉', '😮', '😕'],
      semaforoEmojis: dto.semaforoEmojis ?? ['🔴', '🟡', '🟢'],
      allowPresentation: dto.allowPresentation ?? false,
      allowActionItems: dto.allowActionItems ?? false,
      showReadyCheck: dto.showReadyCheck ?? true,
      defaultSort: (dto.defaultSort ??
        'original') as PhaseCapabilitiesInput['defaultSort'],
    };
  }

  private capsToPrisma(caps: PhaseCapabilitiesInput) {
    return {
      allowCreateCards: caps.allowCreateCards,
      cardContent: caps.cardContent as CardContentMode,
      maxCardsPerParticipant: caps.maxCardsPerParticipant,
      allowEditOwnCards: caps.allowEditOwnCards,
      anonymousCards: caps.anonymousCards,
      othersVisibility: caps.othersVisibility as OthersVisibility,
      revealOnReady: caps.revealOnReady,
      allowGrouping: caps.allowGrouping,
      allowCrossColumnGrouping: caps.allowCrossColumnGrouping,
      voting: caps.voting as VotingMode,
      hideVoteCounts: caps.hideVoteCounts,
      allowReactions: caps.allowReactions,
      reactionEmojis: caps.reactionEmojis,
      semaforoEmojis: caps.semaforoEmojis,
      allowPresentation: caps.allowPresentation,
      allowActionItems: caps.allowActionItems,
      showReadyCheck: caps.showReadyCheck,
      defaultSort: caps.defaultSort as CardSort,
    };
  }
}
