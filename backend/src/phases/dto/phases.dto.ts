import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export const PHASE_KINDS = [
  'board',
  'action_plan',
  'roti',
  'semaforo',
  'semaforo_review',
] as const;

export const CARD_CONTENT_MODES = [
  'text_and_image',
  'image_only',
  'text_only',
] as const;

export const OTHERS_VISIBILITIES = ['visible', 'blurred', 'hidden'] as const;
export const VOTING_MODES = ['off', 'single', 'multi'] as const;
export const CARD_SORTS = [
  'original',
  'most_voted',
  'least_voted',
  'random',
] as const;

export class CreatePhaseDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @IsIn(PHASE_KINDS)
  kind!: (typeof PHASE_KINDS)[number];

  @IsOptional()
  @IsString()
  @MaxLength(16)
  icon?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== '')
  @Matches(HEX_COLOR, { message: 'El color debe ser un hex válido' })
  color?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  instructions?: string | null;

  @IsOptional()
  @IsInt()
  @Min(30)
  timerSeconds?: number | null;

  @IsOptional()
  @IsBoolean()
  isGlobal?: boolean;

  @IsOptional()
  @IsBoolean()
  allowCreateCards?: boolean;

  @IsOptional()
  @IsIn(CARD_CONTENT_MODES)
  cardContent?: (typeof CARD_CONTENT_MODES)[number];

  @IsOptional()
  @IsInt()
  @Min(1)
  maxCardsPerParticipant?: number | null;

  @IsOptional()
  @IsBoolean()
  allowEditOwnCards?: boolean;

  @IsOptional()
  @IsBoolean()
  anonymousCards?: boolean;

  @IsOptional()
  @IsIn(OTHERS_VISIBILITIES)
  othersVisibility?: (typeof OTHERS_VISIBILITIES)[number];

  @IsOptional()
  @IsBoolean()
  revealOnReady?: boolean;

  @IsOptional()
  @IsBoolean()
  allowGrouping?: boolean;

  @IsOptional()
  @IsBoolean()
  allowCrossColumnGrouping?: boolean;

  @IsOptional()
  @IsIn(VOTING_MODES)
  voting?: (typeof VOTING_MODES)[number];

  @IsOptional()
  @IsBoolean()
  hideVoteCounts?: boolean;

  @IsOptional()
  @IsBoolean()
  allowReactions?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(12)
  @IsString({ each: true })
  reactionEmojis?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMinSize(3)
  @ArrayMaxSize(3)
  @IsString({ each: true })
  semaforoEmojis?: string[];

  @IsOptional()
  @IsBoolean()
  allowPresentation?: boolean;

  @IsOptional()
  @IsBoolean()
  allowActionItems?: boolean;

  @IsOptional()
  @IsBoolean()
  showReadyCheck?: boolean;

  @IsOptional()
  @IsIn(CARD_SORTS)
  defaultSort?: (typeof CARD_SORTS)[number];
}

export class UpdatePhaseDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @IsOptional()
  @IsIn(PHASE_KINDS)
  kind?: (typeof PHASE_KINDS)[number];

  @IsOptional()
  @IsString()
  @MaxLength(16)
  icon?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== '')
  @Matches(HEX_COLOR, { message: 'El color debe ser un hex válido' })
  color?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  instructions?: string | null;

  @IsOptional()
  @IsInt()
  @Min(30)
  timerSeconds?: number | null;

  @IsOptional()
  @IsBoolean()
  isGlobal?: boolean;

  @IsOptional()
  @IsBoolean()
  allowCreateCards?: boolean;

  @IsOptional()
  @IsIn(CARD_CONTENT_MODES)
  cardContent?: (typeof CARD_CONTENT_MODES)[number];

  @IsOptional()
  @IsInt()
  @Min(1)
  maxCardsPerParticipant?: number | null;

  @IsOptional()
  @IsBoolean()
  allowEditOwnCards?: boolean;

  @IsOptional()
  @IsBoolean()
  anonymousCards?: boolean;

  @IsOptional()
  @IsIn(OTHERS_VISIBILITIES)
  othersVisibility?: (typeof OTHERS_VISIBILITIES)[number];

  @IsOptional()
  @IsBoolean()
  revealOnReady?: boolean;

  @IsOptional()
  @IsBoolean()
  allowGrouping?: boolean;

  @IsOptional()
  @IsBoolean()
  allowCrossColumnGrouping?: boolean;

  @IsOptional()
  @IsIn(VOTING_MODES)
  voting?: (typeof VOTING_MODES)[number];

  @IsOptional()
  @IsBoolean()
  hideVoteCounts?: boolean;

  @IsOptional()
  @IsBoolean()
  allowReactions?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(12)
  @IsString({ each: true })
  reactionEmojis?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMinSize(3)
  @ArrayMaxSize(3)
  @IsString({ each: true })
  semaforoEmojis?: string[];

  @IsOptional()
  @IsBoolean()
  allowPresentation?: boolean;

  @IsOptional()
  @IsBoolean()
  allowActionItems?: boolean;

  @IsOptional()
  @IsBoolean()
  showReadyCheck?: boolean;

  @IsOptional()
  @IsIn(CARD_SORTS)
  defaultSort?: (typeof CARD_SORTS)[number];
}

export class TemplatePhaseInputDto {
  @IsString()
  phaseId!: string;

  @IsInt()
  @Min(0)
  position!: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  hiddenColumnIds?: string[];
}

export class SemaforoItemInputDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @IsInt()
  @Min(0)
  position!: number;
}

export class CreateRetroPhaseInputDto {
  @IsString()
  phaseId!: string;

  @IsInt()
  @Min(0)
  position!: number;
}
