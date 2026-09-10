import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { TeamRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';

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
      },
    });
    return this.tokenResponse(user.id, user.email, user.name, false);
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
    return this.tokenResponse(user.id, user.email, user.name, isFacilitator);
  }

  async me(userId: string) {
    const profile = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, createdAt: true },
    });
    if (!profile) return null;
    const isFacilitator = await this.isFacilitatorAnywhere(userId);
    return { ...profile, isFacilitator };
  }

  async isFacilitatorAnywhere(userId: string): Promise<boolean> {
    const membership = await this.prisma.teamMember.findFirst({
      where: { userId, role: TeamRole.facilitator },
      select: { id: true },
    });
    return !!membership;
  }

  signUser(userId: string, email: string, name: string) {
    return this.jwt.sign({
      sub: userId,
      email,
      name,
      type: 'user',
    });
  }

  signGuest(participantId: string, retroId: string, name: string) {
    return this.jwt.sign({
      sub: participantId,
      participantId,
      retroId,
      name,
      type: 'guest',
    });
  }

  private tokenResponse(
    id: string,
    email: string,
    name: string,
    isFacilitator: boolean,
  ) {
    return {
      accessToken: this.signUser(id, email, name),
      user: { id, email, name, isFacilitator },
    };
  }
}
