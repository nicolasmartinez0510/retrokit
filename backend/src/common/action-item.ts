import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  parseAvatarId,
  resolveParticipantAvatar,
  userOwnerSelect,
  userPublicSelect,
} from './avatars';

export const actionItemInclude = {
  owner: { select: userOwnerSelect },
  retro: { select: { id: true, title: true, createdAt: true } },
  card: {
    include: {
      author: {
        include: { user: { select: userPublicSelect } },
      },
    },
  },
  group: {
    include: {
      cards: {
        include: {
          author: {
            include: { user: { select: userPublicSelect } },
          },
        },
        orderBy: { position: 'asc' as const },
      },
    },
  },
} satisfies Prisma.ActionItemInclude;

export type ActionItemWithOrigin = Prisma.ActionItemGetPayload<{
  include: typeof actionItemInclude;
}>;

type LinkedCardSource = NonNullable<ActionItemWithOrigin['card']>;

function serializeLinkedCard(card: LinkedCardSource) {
  return {
    id: card.id,
    content: card.content,
    imageUrl: card.imageUrl,
    isAnonymous: card.isAnonymous,
    authorName: card.isAnonymous
      ? 'Anonymous'
      : (card.author.guestName ?? card.author.user?.name ?? 'Participant'),
    authorAvatarId: card.isAnonymous
      ? null
      : resolveParticipantAvatar(card.author),
    ownerId: card.author.user?.id ?? null,
  };
}

export function serializeActionItem(action: ActionItemWithOrigin) {
  return {
    id: action.id,
    teamId: action.teamId,
    retroId: action.retroId,
    retro: action.retro,
    title: action.title,
    description: action.description,
    status: action.status,
    ownerId: action.ownerId,
    createdById: action.createdById,
    dueDate: action.dueDate,
    cardId: action.cardId,
    groupId: action.groupId,
    createdAt: action.createdAt,
    updatedAt: action.updatedAt,
    owner: action.owner
      ? {
          ...action.owner,
          avatarId: parseAvatarId(action.owner.avatarId, action.owner.id),
        }
      : action.owner,
    card: action.card ? serializeLinkedCard(action.card) : null,
    group: action.group
      ? {
          id: action.group.id,
          title: action.group.title,
          cards: action.group.cards.map(serializeLinkedCard),
        }
      : null,
  };
}

export function parseOptionalDueDate(
  value: string | null | undefined,
): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? `${value}T12:00:00.000Z`
    : value;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException('Invalid due date');
  }
  return date;
}
