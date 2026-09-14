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
