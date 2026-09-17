import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { AVATAR_ID_LIST } from '../../common/avatars';

function toOptionalBoolean({ value }: { value: unknown }): boolean | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === '1') return true;
  if (value === 'false' || value === '0') return false;
  return value as boolean;
}

export class RetroPhaseSelectionDto {
  @IsString()
  @IsNotEmpty()
  phaseId!: string;

  @IsInt()
  @Min(0)
  position!: number;
}

export class SemaforoItemInputDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;
}

export class CreateRetroDto {
  @IsString()
  @IsNotEmpty()
  teamId!: string;

  @IsString()
  @IsNotEmpty()
  templateId!: string;

  @IsString()
  @MinLength(2)
  title!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxCommentsPerParticipant?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  votesPerParticipant?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxVotesPerCard?: number;

  @IsOptional()
  @IsBoolean()
  allowAnonymous?: boolean;

  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  allowCrossColumnGrouping?: boolean;

  @IsOptional()
  @IsInt()
  @Min(30)
  timerSeconds?: number | null;

  /** Ordered phases for this retro; defaults to the template's phases. */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RetroPhaseSelectionDto)
  phases?: RetroPhaseSelectionDto[];

  /** Semaforo items; defaults to the template's items (or the built-in set). */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SemaforoItemInputDto)
  semaforoItems?: SemaforoItemInputDto[];
}

export class UpdateSettingsDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxCommentsPerParticipant?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  votesPerParticipant?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxVotesPerCard?: number;

  @IsOptional()
  @IsBoolean()
  allowAnonymous?: boolean;

  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  allowCrossColumnGrouping?: boolean;

  @IsOptional()
  @IsInt()
  @Min(30)
  timerSeconds?: number | null;
}

export class JoinRetroDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  guestName?: string;

  @IsOptional()
  @Transform(({ value }) =>
    value === '' || value === null ? undefined : value,
  )
  @IsString()
  @IsIn(AVATAR_ID_LIST)
  avatarId?: string;
}

export class CreateCardDto {
  @IsString()
  @IsNotEmpty()
  columnId!: string;

  /** Plain text; may be empty when an image is attached. */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  content?: string;

  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  isAnonymous?: boolean;
}

export class UpdateCardDto {
  @IsOptional()
  @IsString()
  columnId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  content?: string;

  @IsOptional()
  @IsBoolean()
  isAnonymous?: boolean;
}

export class GroupCardsDto {
  @IsString()
  @IsNotEmpty()
  sourceCardId!: string;

  @IsString()
  @IsNotEmpty()
  targetCardId!: string;

  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  moveGroup?: boolean;
}

export class UngroupCardsDto {
  @IsString()
  @IsNotEmpty()
  cardId!: string;

  @IsOptional()
  @IsString()
  columnId?: string;

  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  ungroupAll?: boolean;
}

export class VoteDto {
  @IsOptional()
  @IsString()
  cardId?: string;

  @IsOptional()
  @IsString()
  groupId?: string;

  @IsInt()
  @Min(0)
  @Max(20)
  count!: number;
}

export class AdvancePhaseDto {
  /** Id of a RetroPhase belonging to the retro, or the literal `'closed'`. */
  @IsString()
  @IsNotEmpty()
  phaseId!: string;
}

export class ReactionDto {
  @IsString()
  @IsNotEmpty()
  cardId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(16)
  emoji!: string;
}

export const SEMAFORO_VALUES = ['red', 'yellow', 'green'] as const;
export type SemaforoValueInput = (typeof SEMAFORO_VALUES)[number];

export class SemaforoVoteDto {
  @IsString()
  @IsNotEmpty()
  itemId!: string;

  /** `null` clears the participant's vote. */
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsIn(SEMAFORO_VALUES)
  value!: SemaforoValueInput | null;
}

export class SemaforoNoteDto {
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(2000)
  note!: string | null;
}

export class TimerDto {
  @IsOptional()
  @IsInt()
  @Min(30)
  seconds?: number;
}

export class TimerAddDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3600)
  seconds?: number;
}

export class RotiDto {
  @IsInt()
  @Min(1)
  @Max(5)
  score!: number;

  @IsOptional()
  @IsString()
  comment?: string;
}

export class CreateActionFromRetroDto {
  @IsString()
  @MinLength(2)
  @MaxLength(300)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  ownerId?: string;

  @Transform(({ value }) => (value === '' ? null : value))
  @IsOptional()
  @IsDateString()
  dueDate?: string | null;

  @IsOptional()
  @IsString()
  cardId?: string;

  @IsOptional()
  @IsString()
  groupId?: string;
}

export class SetCommentsReadyDto {
  @IsBoolean()
  ready!: boolean;
}

export class SetPresenterDto {
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @IsNotEmpty()
  cardId!: string | null;
}
