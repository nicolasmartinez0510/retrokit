import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class CreateTeamActionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  title!: string;

  @IsString()
  @MinLength(1)
  retroId!: string;

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
}

export const ACTION_ENTRY_MODES = [
  'retrospectiva',
  'weekly',
  'planning',
  'refinamiento',
  'otro',
] as const;

export type ActionEntryModeValue = (typeof ACTION_ENTRY_MODES)[number];

export class CreateActionProgressDto {
  @IsIn(ACTION_ENTRY_MODES)
  entryMode!: ActionEntryModeValue;

  @ValidateIf((dto: CreateActionProgressDto) => dto.entryMode === 'otro')
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  entryModeCustom?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  progress?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  pending?: string;
}

export class UpdateActionProgressDto extends CreateActionProgressDto {}

export class UpdateActionDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsIn(['pending', 'doing', 'done', 'unmet'])
  status?: 'pending' | 'doing' | 'done' | 'unmet';

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  ownerId?: string | null;

  @Transform(({ value }) => (value === '' ? null : value))
  @IsOptional()
  @IsDateString()
  dueDate?: string | null;
}
