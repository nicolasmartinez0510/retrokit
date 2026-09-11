export const AVATAR_IDS = [
  'cafe',
  'fuego',
  'clap',
  'zen',
  'caos',
  'sleepy',
  'nerd',
  'star',
  'sideeye',
  'rubberduck',
  'rocket',
  'plant',
  'sticky',
  'party',
  'grumpy',
  'crylaugh',
  'cool',
  'shocked',
  'thinking',
  'capy',
  'ghost',
  'robot',
  'wizard',
  'cat',
] as const;

export type AvatarId = (typeof AVATAR_IDS)[number];

export const AVATAR_ID_LIST: string[] = [...AVATAR_IDS];

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

export function parseAvatarId(
  value: string | null | undefined,
  seed: string,
): AvatarId {
  if (isAvatarId(value)) return value;
  return avatarForSeed(seed);
}

export const userPublicSelect = {
  id: true,
  name: true,
  email: true,
  avatarId: true,
} as const;

export const userOwnerSelect = {
  id: true,
  name: true,
  avatarId: true,
} as const;

export function resolveParticipantAvatar(p: {
  id: string;
  avatarId?: string | null;
  user?: { id: string; avatarId?: string | null } | null;
}): string {
  return parseAvatarId(p.avatarId ?? p.user?.avatarId, p.user?.id ?? p.id);
}
