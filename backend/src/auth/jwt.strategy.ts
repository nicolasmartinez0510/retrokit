import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

export class JwtPayload {
  sub!: string;
  email?: string;
  name?: string;
  type!: 'user' | 'guest' | 'anonymous';
  participantId?: string;
  retroId?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET', 'retrokit-dev-secret'),
    });
  }

  validate(payload: JwtPayload) {
    return payload;
  }
}
