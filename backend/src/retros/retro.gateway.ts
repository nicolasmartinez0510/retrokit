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
