import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { TeamRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { avatarForSeed, isAvatarId, parseAvatarId } from '../common/avatars';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto, RegisterDto, UpdateMeDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (existing) {
      throw new ConflictException('El email ya está registrado');
    }
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        passwordHash,
        name: dto.name.trim(),
        avatarId: isAvatarId(dto.avatarId) ? dto.avatarId : null,
      },
    });
    const avatarId = user.avatarId ?? avatarForSeed(user.id);
    if (!user.avatarId) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { avatarId },
      });
    }
    return this.tokenResponse(user.id, user.email, user.name, avatarId, false);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    const isFacilitator = await this.isFacilitatorAnywhere(user.id);
    const avatarId = parseAvatarId(user.avatarId, user.id);
    return this.tokenResponse(
      user.id,
      user.email,
      user.name,
      avatarId,
      isFacilitator,
    );
  }

  async me(userId: string) {
    const profile = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatarId: true,
        createdAt: true,
      },
    });
    if (!profile) return null;
    const isFacilitator = await this.isFacilitatorAnywhere(userId);
    return {
      ...profile,
      avatarId: parseAvatarId(profile.avatarId, profile.id),
      isFacilitator,
    };
  }

  async updateMe(userId: string, dto: UpdateMeDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) throw new NotFoundException('User not found');
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { avatarId: dto.avatarId },
      select: {
        id: true,
        email: true,
        name: true,
        avatarId: true,
        createdAt: true,
      },
    });
    const isFacilitator = await this.isFacilitatorAnywhere(userId);
    return { ...updated, isFacilitator };
  }

  async isFacilitatorAnywhere(userId: string): Promise<boolean> {
    const membership = await this.prisma.teamMember.findFirst({
      where: { userId, role: TeamRole.facilitator },
      select: { id: true },
    });
    return !!membership;
  }

  signUser(userId: string, email: string, name: string, avatarId?: string) {
    return this.jwt.sign({
      sub: userId,
      email,
      name,
      avatarId,
      type: 'user',
    });
  }

  signGuest(
    participantId: string,
    retroId: string,
    name: string,
    avatarId?: string,
  ) {
    return this.jwt.sign({
      sub: participantId,
      participantId,
      retroId,
      name,
      avatarId,
      type: 'guest',
    });
  }

  private tokenResponse(
    id: string,
    email: string,
    name: string,
    avatarId: string,
    isFacilitator: boolean,
  ) {
    return {
      accessToken: this.signUser(id, email, name, avatarId),
      user: { id, email, name, avatarId, isFacilitator },
    };
  }
}
