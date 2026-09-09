import { IsEnum, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { ActionStatus } from '@prisma/client';

export class CreateActionDto {
  @IsString()
  @MinLength(2)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  ownerId?: string;

  @IsOptional()
  @IsString()
  retroId?: string;
}

export class UpdateActionDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  ownerId?: string | null;

  @IsOptional()
  @IsEnum(ActionStatus)
  status?: ActionStatus;
}

export class TeamIdParam {
  @IsString()
  @IsNotEmpty()
  teamId!: string;
}
