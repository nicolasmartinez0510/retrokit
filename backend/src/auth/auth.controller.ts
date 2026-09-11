import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators';
import { LoginDto, RegisterDto, UpdateMeDto } from './dto/auth.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { JwtPayload } from './jwt.strategy';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@CurrentUser() user: JwtPayload) {
    if (user.type !== 'user') {
      return {
        id: user.sub,
        email: '',
        name: user.name ?? '',
        avatarId: user.avatarId ?? null,
        type: 'guest' as const,
        participantId: user.participantId,
        retroId: user.retroId,
      };
    }
    const profile = await this.auth.me(user.sub);
    return { ...profile, type: 'user' as const };
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me')
  async updateMe(@CurrentUser() user: JwtPayload, @Body() dto: UpdateMeDto) {
    if (user.type !== 'user') {
      throw new ForbiddenException('Solo usuarios registrados pueden cambiar el avatar');
    }
    const profile = await this.auth.updateMe(user.sub, dto);
    return { ...profile, type: 'user' as const };
  }
}
