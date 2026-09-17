import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  actionItemInclude,
  ActionItemWithOrigin,
  startOfUtcDay,
} from './action-item';

const overdueWhere = (
  teamId?: string,
  now = new Date(),
): Prisma.ActionItemWhereInput => ({
  status: { in: ['pending', 'doing'] },
  dueDate: { not: null, lt: startOfUtcDay(now) },
  ...(teamId ? { teamId } : {}),
});

/**
 * Persist overdue pending/doing actions as unmet. Returns the updated rows
 * (already with status unmet) so callers can emit realtime events.
 */
export async function expireOverdueActions(
  prisma: PrismaService,
  opts?: { teamId?: string; now?: Date },
): Promise<ActionItemWithOrigin[]> {
  const where = overdueWhere(opts?.teamId, opts?.now);
  const overdue = await prisma.actionItem.findMany({
    where,
    include: actionItemInclude,
  });
  if (!overdue.length) return [];

  await prisma.actionItem.updateMany({
    where: { id: { in: overdue.map((item) => item.id) } },
    data: { status: 'unmet' },
  });

  return overdue.map((item) => ({ ...item, status: 'unmet' as const }));
}
