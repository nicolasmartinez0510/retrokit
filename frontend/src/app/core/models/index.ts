export type TeamRole = 'facilitator' | 'member';
export type RetroStatus =
  | 'comments'
  | 'grouping'
  | 'voting'
  | 'actions'
  | 'roti'
  | 'closed';
export type ActionStatus = 'pending' | 'doing' | 'done' | 'unmet';

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt?: string;
  type?: 'user' | 'guest';
  participantId?: string;
  retroId?: string;
  isFacilitator?: boolean;
}

export interface TemplateColumnInput {
  id?: string;
  title: string;
  description?: string | null;
  icon?: string | null;
  logoUrl?: string | null;
  position: number;
}

export interface CreateTemplatePayload {
  name: string;
  description?: string | null;
  maxCommentsPerParticipant?: number | null;
  votesPerParticipant?: number;
  maxVotesPerCard?: number;
  backgroundColor?: string | null;
  columns: TemplateColumnInput[];
}

export interface UpdateTemplatePayload {
  name?: string;
  description?: string | null;
  maxCommentsPerParticipant?: number | null;
  votesPerParticipant?: number;
  maxVotesPerCard?: number;
  backgroundColor?: string | null;
  columns?: TemplateColumnInput[];
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
  _count?: { members: number; retrospectives: number; joinRequests?: number };
  members?: { role: TeamRole }[];
  role?: TeamRole;
  pendingJoinCount?: number;
}

export interface TeamMember {
  id: string;
  role: TeamRole;
  user: { id: string; name: string; email: string };
}

export interface TeamJoinRequest {
  id: string;
  teamId: string;
  teamName?: string;
  createdAt: string;
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
  joinRequests?: TeamJoinRequest[];
}

export interface TemplateColumn {
  id: string;
  title: string;
  description?: string | null;
  icon?: string | null;
  logoUrl?: string | null;
  position: number;
}

export interface Template {
  id: string;
  name: string;
  description?: string | null;
  maxCommentsPerParticipant?: number | null;
  votesPerParticipant?: number;
  maxVotesPerCard?: number;
  backgroundColor?: string | null;
  backgroundImageUrl?: string | null;
  columns: TemplateColumn[];
}

export interface Participant {
  id: string;
  retroId: string;
  userId?: string | null;
  guestName?: string | null;
  isGuest: boolean;
  commentsReady?: boolean;
  votesReady?: boolean;
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
  imageUrl?: string | null;
  isAnonymous: boolean;
  groupId?: string | null;
  position: number;
  createdAt: string;
  hidden?: boolean;
  authorName?: string;
  author?: Participant;
  votes?: Vote[];
  /** Client-only: images from grouped cards */
  imageUrls?: string[];
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
  logoUrl?: string | null;
  position: number;
}

export interface CommentProgressParticipant {
  participantId: string;
  name: string;
  commentCount: number;
  isReady: boolean;
}

export interface CommentProgress {
  written: number;
  total: number;
  allDone: boolean;
  participants: CommentProgressParticipant[];
}

export interface VoteProgressParticipant {
  participantId: string;
  name: string;
  voteCount: number;
  isReady: boolean;
}

export interface VoteProgress {
  ready: number;
  total: number;
  allDone: boolean;
  votesUsed: number;
  votesCapacity: number;
  participants: VoteProgressParticipant[];
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
  backgroundColor?: string | null;
  backgroundImageUrl?: string | null;
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
  voteProgress?: VoteProgress;
  me?: {
    participantId?: string;
    myCommentCount: number;
    myVoteTotal: number;
    votesRemaining: number;
    commentsReady: boolean;
    votesReady: boolean;
    isFacilitator?: boolean;
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

export const ACTION_STATUS_LABELS: Record<ActionStatus, string> = {
  pending: 'Pendiente',
  doing: 'En curso',
  done: 'Cumplido',
  unmet: 'No cumplido',
};
