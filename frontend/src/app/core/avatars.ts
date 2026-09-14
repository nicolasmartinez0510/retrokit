export const AVATARS = [
  { id: 'cafe', label: 'Café' },
  { id: 'fuego', label: 'En llamas' },
  { id: 'clap', label: 'Clap' },
  { id: 'zen', label: 'Zen' },
  { id: 'caos', label: 'Caos' },
  { id: 'sleepy', label: 'Zzz' },
  { id: 'nerd', label: 'Nerd' },
  { id: 'star', label: 'Estrella' },
  { id: 'sideeye', label: 'Side eye' },
  { id: 'rubberduck', label: 'Patito' },
  { id: 'rocket', label: 'Cohete' },
  { id: 'plant', label: 'Plantita' },
  { id: 'sticky', label: 'Sticky' },
  { id: 'party', label: 'Party' },
  { id: 'grumpy', label: 'Gruñón' },
  { id: 'crylaugh', label: 'Jaja' },
  { id: 'cool', label: 'Cool' },
  { id: 'shocked', label: 'Shock' },
  { id: 'thinking', label: 'Hmm' },
  { id: 'capy', label: 'Carpincho' },
  { id: 'ghost', label: 'Ghost' },
  { id: 'robot', label: 'Bot' },
  { id: 'wizard', label: 'Mago' },
  { id: 'cat', label: 'Gato' },
] as const;

export type AvatarId = (typeof AVATARS)[number]['id'];

const AVATAR_IDS: readonly AvatarId[] = AVATARS.map((a) => a.id);
const AVATAR_ID_SET = new Set<string>(AVATAR_IDS);

export function isAvatarId(value: string | null | undefined): value is AvatarId {
  return !!value && AVATAR_ID_SET.has(value);
}

export function avatarForSeed(seed: string): AvatarId {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (Math.imul(31, hash) + seed.charCodeAt(i)) | 0;
  }
  const index = Math.abs(hash) % AVATAR_IDS.length;
  return AVATAR_IDS[index];
}

export function resolveAvatarId(
  avatarId: string | null | undefined,
  seed = '',
): AvatarId {
  if (isAvatarId(avatarId)) return avatarId;
  return avatarForSeed(seed || 'retrokit');
}

export function avatarSrc(id: string): string {
  return `/avatars/${id}.svg`;
}

export function randomAvatarId(): AvatarId {
  const index = Math.floor(Math.random() * AVATAR_IDS.length);
  return AVATAR_IDS[index];
}

export type AvatarChangedPayload = {
  userId: string;
  avatarId: string;
  participants: { id: string; retroId: string }[];
};

export function parseAvatarChanged(payload: unknown): AvatarChangedPayload | null {
  if (!payload || typeof payload !== 'object') return null;
  const value = payload as Record<string, unknown>;
  const userId = value['userId'];
  const avatarId = value['avatarId'];
  if (typeof userId !== 'string' || typeof avatarId !== 'string' || !isAvatarId(avatarId)) {
    return null;
  }
  const rawParticipants = value['participants'];
  const participants = Array.isArray(rawParticipants)
    ? rawParticipants.flatMap((item) => {
        if (!item || typeof item !== 'object') return [];
        const row = item as Record<string, unknown>;
        const id = row['id'];
        const retroId = row['retroId'];
        if (typeof id !== 'string' || typeof retroId !== 'string') {
          return [];
        }
        return [{ id, retroId }];
      })
    : [];
  return { userId, avatarId, participants };
}
