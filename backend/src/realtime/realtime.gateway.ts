import { randomUUID } from 'crypto';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtPayload } from '../auth/jwt.strategy';
import { RealtimeEventsService } from './realtime-events.service';

const CONFETTI_COOLDOWN_MS = 1000;

@WebSocketGateway({
  cors: { origin: '*' },
})
export class RealtimeGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly lastConfettiAt = new Map<string, number>();

  constructor(
    private readonly events: RealtimeEventsService,
    private readonly jwt: JwtService,
  ) {}

  afterInit(server: Server) {
    this.events.setServer(server);
  }

  handleConnection(client: Socket) {
    const token = client.handshake.auth?.token;
    if (typeof token !== 'string' || !token) return;
    try {
      const payload = this.jwt.verify<JwtPayload>(token);
      if (payload?.type === 'user' && payload.sub) {
        client.data.userId = payload.sub;
        void client.join(`user:${payload.sub}`);
      }
    } catch {
      // guests and invalid tokens can still join retro rooms
    }
  }

  handleDisconnect(client: Socket) {
    this.lastConfettiAt.delete(client.id);
  }

  @SubscribeMessage('join-retro')
  async handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { retroId: string },
  ) {
    if (!body?.retroId) return { ok: false };
    await client.join(`retro:${body.retroId}`);
    return { ok: true };
  }

  @SubscribeMessage('leave-retro')
  async handleLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { retroId: string },
  ) {
    if (!body?.retroId) return { ok: false };
    await client.leave(`retro:${body.retroId}`);
    return { ok: true };
  }

  @SubscribeMessage('throw-confetti')
  handleThrowConfetti(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { retroId?: string; id?: string },
  ) {
    const retroId = body?.retroId?.trim();
    if (!retroId) return { ok: false };
    const room = `retro:${retroId}`;
    if (!client.rooms.has(room)) return { ok: false };

    const now = Date.now();
    const last = this.lastConfettiAt.get(client.id) ?? 0;
    if (now - last < CONFETTI_COOLDOWN_MS) return { ok: false };
    this.lastConfettiAt.set(client.id, now);

    const id =
      typeof body.id === 'string' && body.id.length > 0 && body.id.length <= 64
        ? body.id
        : randomUUID();
    this.server.to(room).emit('confetti', { id });
    return { ok: true };
  }
}
