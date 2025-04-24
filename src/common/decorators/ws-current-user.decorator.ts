import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { UserPayload } from "src/types/user-payload.type";
import { Socket } from 'socket.io';

export const WsCurrentUser = createParamDecorator(
  (data: unknown, context: ExecutionContext): UserPayload => {
    const client: Socket = context.switchToWs().getClient<Socket>();
    return client.data.user;
  },
);
