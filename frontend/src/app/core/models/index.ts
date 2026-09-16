export type TeamRole = 'facilitator' | 'member';
export type RetroStatus =
  | 'comments'
  | 'grouping'
  | 'voting'
  | 'actions'
  | 'roti'
  | 'closed';
export type ActionStatus = 'pending' | 'doing' | 'done' | 'unmet';
export type ActionEntryMode =
  | 'retrospectiva'
  | 'weekly'
  | 'planning'
  | 'refinamiento'
  | 'otro';

export interface User {
  id: string;
  email: string;
  name: string;
  avatarId?: string | null;
  createdAt?: string;
  type?: 'user' | 'guest';
  participantId?: string;
  retroId?: string;
  isFacilitator?: boolean;
  isAdmin?: boolean;
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
  backgroundImageUrl?: string | null;
  columns: TemplateColumnInput[];
}

export interface UpdateTemplatePayload {
  name?: string;
  description?: string | null;
  maxCommentsPerParticipant?: number | null;
  votesPerParticipant?: number;
  maxVotesPerCard?: number;
  backgroundColor?: string | null;
  backgroundImageUrl?: string | null;
  columns?: TemplateColumnInput[];
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}

export interface TeamSummary {
  id: string;
  name: string;
  logoUrl?: string | null;
  inviteCode: string;
  createdAt: string;
  _count?: { members: number; retrospectives: number; joinRequests?: number };
  members?: { role: TeamRole }[];
  role?: TeamRole;
  pendingJoinCount?: number;
  favorited?: boolean;
  favoritedAt?: string | null;
}

export interface TeamMember {
  id: string;
  role: TeamRole;
  user: { id: string; name: string; email: string; avatarId?: string | null };
}

export interface TeamJoinRequest {
  id: string;
  teamId: string;
  teamName?: string;
  createdAt: string;
  user: { id: string; name: string; email: string; avatarId?: string | null };
}

export interface TeamInvite {
  id: string;
  teamId: string;
  teamName: string;
  teamLogoUrl?: string | null;
  createdAt: string;
  inviter: { id: string; name: string; email: string; avatarId?: string | null };
}

export interface OutgoingTeamInvite {
  id: string;
  teamId: string;
  createdAt: string;
  invitee: { id: string; name: string; email: string; avatarId?: string | null };
  inviter: { id: string; name: string; email: string; avatarId?: string | null };
}

export interface UserSearchHit {
  id: string;
  name: string;
  email: string;
  avatarId?: string | null;
}

export interface RetroParticipantSummary {
  id: string;
  name: string;
  avatarId?: string | null;
  ownerId?: string | null;
}

export interface RetroSummary {
  id: string;
  title: string;
  status: RetroStatus;
  createdAt: string;
  closedAt?: string | null;
  template?: { name: string } | null;
  _count?: { cards: number };
  participants?: RetroParticipantSummary[];
}

export interface TeamDetail {
  id: string;
  name: string;
  logoUrl?: string | null;
  inviteCode: string;
  createdAt: string;
  members: TeamMember[];
  retrospectives: RetroSummary[];
  joinRequests?: TeamJoinRequest[];
  favorited?: boolean;
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
  isGlobal: boolean;
  createdById?: string | null;
  createdBy?: { id: string; name: string; email: string } | null;
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
  avatarId?: string | null;
  user?: { id: string; name: string; email?: string; avatarId?: string | null } | null;
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
  authorAvatarId?: string | null;
  author?: Participant;
  votes?: Vote[];
  /** Client-only: images from grouped cards */
  imageUrls?: string[];
  /** Client-only: this row is a group stack on the board */
  isGroup?: boolean;
  groupSize?: number;
  members?: Card[];
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
  avatarId?: string | null;
  ownerId?: string | null;
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
  avatarId?: string | null;
  ownerId?: string | null;
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

export interface ActionLinkedCard {
  id: string;
  content: string;
  imageUrl?: string | null;
  isAnonymous: boolean;
  authorName?: string;
  authorAvatarId?: string | null;
  ownerId?: string | null;
}

export interface ActionAssigneeOption {
  id: string;
  name: string;
  avatarId?: string | null;
}

export interface ActionItemWrite {
  title: string;
  description?: string | null;
  ownerId?: string | null;
  dueDate?: string | null;
  status?: ActionStatus;
  retroId?: string;
  cardId?: string;
  groupId?: string;
}

export interface ActionItem {
  id: string;
  teamId: string;
  retroId?: string | null;
  title: string;
  description?: string | null;
  status: ActionStatus;
  ownerId?: string | null;
  createdById?: string | null;
  dueDate?: string | null;
  cardId?: string | null;
  groupId?: string | null;
  createdAt: string;
  updatedAt?: string;
  progressCount?: number;
  owner?: { id: string; name: string; avatarId?: string | null } | null;
  retro?: { id: string; title: string; createdAt?: string } | null;
  card?: ActionLinkedCard | null;
  group?: {
    id: string;
    title?: string | null;
    cards: ActionLinkedCard[];
  } | null;
}

export interface ActionProgressWrite {
  entryMode: ActionEntryMode;
  entryModeCustom?: string;
  progress?: string;
  pending?: string;
}

export interface ActionProgressUpdate {
  id: string;
  actionId: string;
  sequence: number;
  title: string;
  entryMode: ActionEntryMode;
  entryModeCustom?: string | null;
  progress?: string | null;
  pending?: string | null;
  createdAt: string;
  updatedAt?: string;
  authorId?: string | null;
  author?: { id: string; name: string; avatarId?: string | null } | null;
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
  allowCrossColumnGrouping?: boolean;
  timerSeconds: number | null;
  timerEndsAt: string | null;
  timerPausedRemaining?: number | null;
  backgroundColor?: string | null;
  backgroundImageUrl?: string | null;
  presenterCardId?: string | null;
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
  allowCrossColumnGrouping?: boolean;
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

export const ACTION_ENTRY_MODE_LABELS: Record<ActionEntryMode, string> = {
  retrospectiva: 'Retrospectiva',
  weekly: 'Weekly',
  planning: 'Planning',
  refinamiento: 'Refinamiento',
  otro: 'Otro',
};
