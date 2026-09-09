import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';

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
  @IsInt()
  @Min(30)
  timerSeconds?: number | null;
}

export class UpdateSettingsDto {
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
}

export class CreateCardDto {
  @IsString()
  @IsNotEmpty()
  columnId!: string;

  @IsString()
  @MinLength(1)
  content!: string;

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
  @IsString()
  @IsNotEmpty()
  status!: string;
}

export class TimerDto {
  @IsOptional()
  @IsInt()
  @Min(30)
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
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  ownerId?: string;
}
