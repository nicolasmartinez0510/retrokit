import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { AVATAR_ID_LIST } from '../../common/avatars';

function emptyToUndefined({ value }: { value: unknown }) {
  if (value === '' || value === null) return undefined;
  return value;
}

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @IsIn(AVATAR_ID_LIST)
  avatarId?: string;
}

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;
}

export class UpdateMeDto {
  @IsString()
  @IsIn(AVATAR_ID_LIST)
  avatarId!: string;
}
