// This file is part of Retrokit.
//
// Copyright (C) 2026 Nicolas Martinez
//
// Retrokit is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// Retrokit is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with Retrokit.  If not, see <https://www.gnu.org/licenses/>.

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
