import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateTeamDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsEmail({}, { each: true })
  inviteEmails?: string[];
}

export class JoinTeamDto {
  @IsString()
  @MinLength(4)
  inviteCode!: string;
}

export class UpdateTeamDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;
}

export class RequestTeamJoinDto {
  @IsString()
  @MinLength(1)
  retroId!: string;
}

export class SetTeamFavoriteDto {
  @IsBoolean()
  favorited!: boolean;
}

export class InviteTeamMemberDto {
  @IsEmail()
  email!: string;
}
