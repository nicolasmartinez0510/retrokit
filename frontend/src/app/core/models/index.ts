export type TeamRole = 'facilitator' | 'member';
export type RetroStatus =
  | 'comments'
  | 'grouping'
  | 'voting'
  | 'actions'
  | 'roti'
  | 'closed';
export type ActionStatus = 'pending' | 'doing' | 'done';

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt?: string;
  type?: 'user' | 'guest';
  participantId?: string;
  retroId?: string;
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}

export interface TeamSummary {
  id: string;
  name: string;
  inviteCode: string;
  createdAt: string;
  _count?: { members: number; retrospectives: number };
  members?: { role: TeamRole }[];
  role?: TeamRole;
}

export interface TeamMember {
  id: string;
  role: TeamRole;
  user: { id: string; name: string; email: string };
}

export interface RetroSummary {
  id: string;
  title: string;
  status: RetroStatus;
  createdAt: string;
  closedAt?: string | null;
}

export interface TeamDetail {
  id: string;
  name: string;
  inviteCode: string;
  createdAt: string;
  members: TeamMember[];
  retrospectives: RetroSummary[];
}

export interface TemplateColumn {
  id: string;
  title: string;
  description?: string | null;
  icon?: string | null;
  position: number;
}

export interface Template {
  id: string;
  name: string;
  description?: string | null;
  columns: TemplateColumn[];
}

export interface Participant {
  id: string;
  retroId: string;
  userId?: string | null;
  guestName?: string | null;
  isGuest: boolean;
  user?: { id: string; name: string; email?: string } | null;
}

export interface Vote {
  id: string;
  retroId: string;
  participantId: string;
  cardId?: string | null;
  groupId?: string | null;
  count: number;
}

export interface Card {
  id: string;
  retroId: string;
  columnId: string;
  authorId: string;
  content: string;
  isAnonymous: boolean;
  groupId?: string | null;
  position: number;
  createdAt: string;
  hidden?: boolean;
  authorName?: string;
  author?: Participant;
  votes?: Vote[];
}

export interface CardGroup {
  id: string;
  retroId: string;
  title?: string | null;
  cards: Card[];
  votes?: Vote[];
}

export interface RetroColumn {
  id: string;
  retroId: string;
  title: string;
  description?: string | null;
  icon?: string | null;
  position: number;
}

export interface CommentProgressParticipant {
  participantId: string;
  name: string;
  commentCount: number;
  hasWritten: boolean;
}

export interface CommentProgress {
  written: number;
  total: number;
  allDone: boolean;
  participants: CommentProgressParticipant[];
}

export interface ActionItem {
  id: string;
  teamId: string;
  retroId?: string | null;
  title: string;
  description?: string | null;
  status: ActionStatus;
  ownerId?: string | null;
  createdAt: string;
  updatedAt?: string;
  owner?: { id: string; name: string } | null;
}

export interface RetroBoard {
  id: string;
  teamId: string;
  templateId: string;
  title: string;
  status: RetroStatus;
  guestInviteCode: string;
  memberInviteCode: string;
  maxCommentsPerParticipant: number | null;
  votesPerParticipant: number;
  maxVotesPerCard: number;
  allowAnonymous: boolean;
  timerSeconds: number | null;
  timerEndsAt: string | null;
  createdAt: string;
  closedAt?: string | null;
  columns: RetroColumn[];
  participants: Participant[];
  groups: CardGroup[];
  cards: Card[];
  votes: Vote[];
  actionItems: ActionItem[];
  team?: { id: string; name: string };
  commentProgress?: CommentProgress;
  me?: {
    participantId?: string;
    myCommentCount: number;
    myVoteTotal: number;
    votesRemaining: number;
  };
}

export interface JoinRetroResponse {
  accessToken: string | null;
  retroId: string;
  participant: Participant;
  type: 'guest' | 'member';
}

export interface CreateRetroPayload {
  teamId: string;
  templateId: string;
  title: string;
  maxCommentsPerParticipant?: number | null;
  votesPerParticipant?: number;
  maxVotesPerCard?: number;
  allowAnonymous?: boolean;
  timerSeconds?: number | null;
}

export interface RetroReport extends RetroBoard {
  rotiResponses: { id: string; score: number; comment?: string | null }[];
  rotiAverage: number | null;
}

export const PHASES: { key: RetroStatus; label: string }[] = [
  { key: 'comments', label: 'Comentarios' },
  { key: 'grouping', label: 'Agrupar' },
  { key: 'voting', label: 'Votar' },
  { key: 'actions', label: 'Plan de acción' },
  { key: 'roti', label: 'ROTI' },
];

export const PHASE_LABELS: Record<RetroStatus, string> = {
  comments: 'Comentarios',
  grouping: 'Agrupar',
  voting: 'Votar',
  actions: 'Plan de acción',
  roti: 'ROTI',
  closed: 'Cerrada',
};
