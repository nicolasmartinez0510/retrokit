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
  ConnectedSocket,
  MessageBody,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { RetroEventsService } from './retro-events.service';

@WebSocketGateway({
  cors: { origin: '*' },
})
export class RetroGateway implements OnGatewayInit {
  @WebSocketServer()
  server!: Server;

  constructor(private readonly events: RetroEventsService) {}

  afterInit(server: Server) {
    this.events.setServer(server);
  }

  @SubscribeMessage('join-retro')
  handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { retroId: string },
  ) {
    if (!body?.retroId) return { ok: false };
    client.join(`retro:${body.retroId}`);
    return { ok: true };
  }
}
