import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketServer,
  WsException,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConnectedUserService } from './services/connected-user.service';
import { UserPayload } from 'src/types/user-payload.type';
import { UnauthorizedException, UseFilters } from '@nestjs/common';
import { WsExceptionFilter } from 'src/common/filters/ws-exception.filter';
import { RoomService } from './services/room.service';
import { WsCurrentUser } from 'src/common/decorators/ws-current-user.decorator';
import {
  CreateMessageDto,
  CreateRoomDto,
  DeleteMessageDto,
  DeleteRoomDto,
  FilterMessageDto,
  RoomFetchRequestDto,
  UpdateMessageDto,
  UpdateRoomDto,
} from './dto';
import { WsValidationPipe } from 'src/common/pipes/ws-validation.pipe';
import { RoomTypeEnum } from './enums/room-type.enum';
import { User } from '../user/entities';
import { MessageService } from './services/message.service';

@UseFilters(WsExceptionFilter)
@WebSocketGateway(4800, { cors: { origin: '*' } })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly connectedUserService: ConnectedUserService,
    private readonly roomService: RoomService,
    private readonly messageService: MessageService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.connectedUserService.deleteAll();
  }

  async handleConnection(socket: Socket): Promise<void> {
    try {
      const user = this.authenticateSocket(socket);
      await this.initializeUserConnection(user, socket);
    } catch (err) {
      this.handleConnectionError(socket, err);
    }
  }

  async handleDisconnect(socket: Socket): Promise<void> {
    await this.connectedUserService.delete(socket.id);
  }

  @SubscribeMessage('createRoom')
  async onCreateRoom(
    @WsCurrentUser() currentUser: UserPayload,
    @MessageBody(new WsValidationPipe()) createRoomDto: CreateRoomDto,
  ): Promise<void> {
    try {
      this.validateRoomTypeAndParticipants(
        createRoomDto.type,
        createRoomDto.participants,
        currentUser.id,
      );

      const newRoom = await this.roomService.create(
        currentUser.id,
        createRoomDto,
      );

      const createdRoomWithDetails = await this.roomService.findOne(
        currentUser.id,
        newRoom.id,
      );

      await this.notifyRoomParticipants(
        createdRoomWithDetails.participants,
        'roomCreated',
        createdRoomWithDetails,
      );
    } catch (err) {
      throw new WsException('Error occurred while creating the room.');
    }
  }

  @SubscribeMessage('getRoomDetails')
  async onFetchRoomDetails(
    @WsCurrentUser() currentUser: UserPayload,
    @MessageBody(new WsValidationPipe())
    roomFetchRequestDto: RoomFetchRequestDto,
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    const { id: userId } = currentUser;
    const { room_id } = roomFetchRequestDto;

    try {
      const room = await this.roomService.findOne(userId, room_id);

      client.emit('roomDetailsFetched', room);
    } catch (error) {
      throw new WsException('Error occurred while fetching room details.');
    }
  }

  @SubscribeMessage('updateRoom')
  async onUpdateRoom(
    @WsCurrentUser() currentUser: UserPayload,
    @MessageBody(new WsValidationPipe()) updateRoomDto: UpdateRoomDto,
  ): Promise<void> {
    try {
      const room = await this.roomService.findOne(
        currentUser.id,
        updateRoomDto.room_id,
      );

      if (room.type === RoomTypeEnum.DIRECT && updateRoomDto.participants) {
        throw new WsException(
          'Direct rooms cannot have their participants updated.',
        );
      }

      this.validateRoomTypeAndParticipants(
        room.type,
        updateRoomDto.participants,
        currentUser.id,
      );

      await this.roomService.update(
        currentUser.id,
        updateRoomDto.room_id,
        updateRoomDto,
      );

      const updatedRoom = await this.roomService.findOne(
        currentUser.id,
        updateRoomDto.room_id,
      );

      await this.notifyRoomParticipants(
        updatedRoom.participants,
        'roomUpdated',
        updatedRoom,
      );
    } catch (error) {
      throw new WsException('Error occurred while updating room details.');
    }
  }

  @SubscribeMessage('deleteRoom')
  async onDeleteRoom(
    @WsCurrentUser() currentUser: UserPayload,
    @MessageBody(new WsValidationPipe()) deleteRoomDto: DeleteRoomDto,
  ): Promise<void> {
    const { id: user_id } = currentUser;
    const { room_id } = deleteRoomDto;

    try {
      const roomToDelete = await this.roomService.findOne(user_id, room_id);

      this.verifyUserAuthorization(roomToDelete.participants, user_id);

      await this.roomService.deleteRoom(room_id);

      await this.notifyRoomParticipants(
        roomToDelete.participants.filter(
          (participants) => participants.id !== user_id,
        ),
        'roomDeleted',
        { message: `Room with ID ${room_id} has been successfully deleted.` },
      );
    } catch (error) {
      throw new WsException('Error occurred while deleting the room.');
    }
  }

  @SubscribeMessage('sendMessage')
  async onSendMessage(
    @WsCurrentUser() currentUser: UserPayload,
    @MessageBody(new WsValidationPipe()) createMessageDto: CreateMessageDto,
  ): Promise<void> {
    const userId = currentUser.id;
    const { room_id } = createMessageDto;

    try {
      const newMessage = await this.messageService.create(
        userId,
        createMessageDto,
      );

      const room = await this.roomService.findOne(userId, room_id);
      await this.notifyRoomParticipants(
        room.participants,
        'messageSent',
        newMessage,
      );
    } catch (error) {
      throw new WsException('Error occurred while sending the message.');
    }
  }

  @SubscribeMessage('findAllMessages')
  async onFindAllMessages(
    @WsCurrentUser() currentUser: UserPayload,
    @MessageBody(new WsValidationPipe()) filterMessageDto: FilterMessageDto,
    @ConnectedSocket() socket: Socket,
  ): Promise<void> {
    const { id: userId } = currentUser;
    const { room_id } = filterMessageDto;

    try {
      const room = await this.roomService.findOne(userId, room_id);

      const isParticipant = room.participants.some(
        (participant) => participant.id === userId,
      );
      if (!isParticipant) {
        throw new WsException(
          'Access Denied: You must be a member of the room to view messages.',
        );
      }

      const messages = await this.messageService.findByRoomId(filterMessageDto);
      this.server.to(socket.id).emit('allMessages', messages);
    } catch (error) {
      throw new WsException('Error occurred while fetching messages.');
    }
  }

  @SubscribeMessage('updateMessage')
  async onUpdateMessage(
    @WsCurrentUser() currentUser: UserPayload,
    @MessageBody(new WsValidationPipe()) updateMessageDto: UpdateMessageDto,
  ): Promise<void> {
    const userId = currentUser.id;

    try {
      const updatedMessage = await this.messageService.update(
        userId,
        updateMessageDto,
      );

      const updatedConversation = await this.messageService.findByRoomId({
        room_id: updatedMessage.room_id,
      });

      const room = await this.roomService.findOne(
        userId,
        updatedMessage.room_id,
      );
      await this.notifyRoomParticipants(
        room.participants,
        'messageUpdated',
        updatedConversation,
      );
    } catch (error) {
      throw new WsException('Error occurred while updating the message.');
    }
  }

  @SubscribeMessage('deleteMessage')
  async onDeleteMessage(
    @WsCurrentUser() currentUser: UserPayload,
    @MessageBody(new WsValidationPipe()) deleteMessageDto: DeleteMessageDto,
  ): Promise<void> {
    const userId = currentUser.id;
    const {room_id, message_ids} = deleteMessageDto;

    try {
      const room = await this.roomService.findOne(userId, room_id);

      await this.messageService.delete(userId, deleteMessageDto);

      await this.notifyRoomParticipants(room.participants, 'messageDeleted', {
        message_ids,
      });
    } catch (error) {
      throw new WsException('Error occurred while deleting messages.');
    }
  }

  private verifyUserAuthorization(participants: User[], user_id: string): void {
    const isParticipant = participants.some(
      (participants) => participants.id === user_id,
    );

    if (!isParticipant) {
      throw new WsException(
        `Deletion failed: You are not authorized to delete this room.`,
      );
    }
  }

  private validateRoomTypeAndParticipants(
    roomType: string,
    participants: string[],
    userId: string,
  ): void {
    if (participants.includes(userId)) {
      throw new WsException(
        'The room owner or updater should not be included in the participants list.',
      );
    }

    if (roomType === RoomTypeEnum.DIRECT && participants.length !== 1) {
      throw new WsException(
        'Direct chat must include exactly one participant aside from the room owner or updater.',
      );
    }

    if (roomType === RoomTypeEnum.GROUP && participants.length < 1) {
      throw new WsException(
        'Group chat must include at least one participant aside from the room owner or updater.',
      );
    }

    const uniqueParticipantIds = new Set(participants);
    if (uniqueParticipantIds.size !== participants.length) {
      throw new WsException('The participants list contains duplicates.');
    }
  }

  private async notifyRoomParticipants(
    participants: User[],
    event: string,
    payload: any,
  ): Promise<void> {
    const notificationPromises = participants.flatMap((participants) =>
      participants.connected_users.map(({ socket_id }) => ({
        socket_id,
        promise: this.emitToSocket(socket_id, event, payload),
      })),
    );

    const results = await Promise.allSettled(
      notificationPromises.map((np) => np.promise),
    );

    results.forEach((result, index) => {
      const { socket_id } = notificationPromises[index];
      if (result.status === 'fulfilled') {
        console.error(
          `Notification sent successfully to Socket ID ${socket_id} for event '${event}'`,
        );
      } else if (result.status === 'rejected') {
        console.error(
          `Failed to notify Socket ID ${socket_id} for event '${event}': ${result.reason}`,
        );
      }
    });
  }

  private async emitToSocket(
    socketId: string,
    event: string,
    payload: any,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.to(socketId).emit(event, payload, (response: any) => {
        if (response && response.error) {
          reject(new Error(response.error));
        } else {
          resolve();
        }
      });
    });
  }

  private authenticateSocket(socket: Socket): UserPayload {
    const token = this.extractJwtToken(socket);
    return this.jwtService.verify<UserPayload>(token, {
      secret: process.env.ACCESS_TOKEN_SECRET,
    });
  }

  private async initializeUserConnection(
    userPayload: UserPayload,
    socket: Socket,
  ): Promise<void> {
    socket.data.user = userPayload;
    await this.connectedUserService.create(userPayload.id, socket.id);

    const rooms = await this.roomService.findByUserId(userPayload.id);
    this.server.to(socket.id).emit('userAllRooms', rooms);
  }

  private handleConnectionError(socket: Socket, error: Error): void {
    socket.emit('exception', 'Authentication error');
    socket.disconnect();
  }

  private extractJwtToken(socket: Socket): string {
    const authHeader = socket.handshake.headers.authorization;
    if (!authHeader)
      throw new UnauthorizedException('No authorization header found');

    // const [bearer, token] = authHeader.split(' ');
    // if (bearer !== 'Bearer' || !token)
    //   throw new UnauthorizedException('Invalid or missing token');

    return authHeader;
    //return token;
  }
}
