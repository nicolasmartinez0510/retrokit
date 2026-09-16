import { Prisma } from '@prisma/client';
import { parseAvatarId, userOwnerSelect } from './avatars';

export const actionProgressInclude = {
  author: { select: userOwnerSelect },
} satisfies Prisma.ActionProgressUpdateInclude;

export type ActionProgressWithAuthor = Prisma.ActionProgressUpdateGetPayload<{
  include: typeof actionProgressInclude;
}>;

export function progressTitleFor(sequence: number) {
  return `Actualización de avances N°${sequence}`;
}

export function serializeActionProgress(update: ActionProgressWithAuthor) {
  return {
    id: update.id,
    actionId: update.actionId,
    sequence: update.sequence,
    title: update.title,
    entryMode: update.entryMode,
    entryModeCustom: update.entryModeCustom,
    progress: update.progress,
    pending: update.pending,
    createdAt: update.createdAt,
    updatedAt: update.updatedAt,
    authorId: update.authorId,
    author: update.author
      ? {
          ...update.author,
          avatarId: parseAvatarId(update.author.avatarId, update.author.id),
        }
      : update.author,
  };
}
