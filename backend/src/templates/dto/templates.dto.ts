import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export class TemplateColumnInputDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  @MinLength(1)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsString()
  icon?: string | null;

  @IsInt()
  @Min(0)
  position!: number;
}

export class CreateTemplateDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string | null;

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
  @ValidateIf((_, v) => v !== null)
  @Matches(HEX_COLOR, { message: 'El color de fondo debe ser un hex válido' })
  backgroundColor?: string | null;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(8)
  @ValidateNested({ each: true })
  @Type(() => TemplateColumnInputDto)
  columns!: TemplateColumnInputDto[];
}

export class UpdateTemplateDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string | null;

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
  @ValidateIf((_, v) => v !== null)
  @Matches(HEX_COLOR, { message: 'El color de fondo debe ser un hex válido' })
  backgroundColor?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(8)
  @ValidateNested({ each: true })
  @Type(() => TemplateColumnInputDto)
  columns?: TemplateColumnInputDto[];
}
