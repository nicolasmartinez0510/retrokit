import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { JwtPayload } from './jwt.strategy';

@Injectable()
export class UserAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = JwtPayload>(
    err: Error | null,
    user: TUser,
  ): TUser {
    if (err || !user) {
      throw err || new UnauthorizedException();
    }
    const payload = user as unknown as JwtPayload;
    if (payload.type !== 'user') {
      throw new UnauthorizedException('User authentication required');
    }
    return user;
  }
}
