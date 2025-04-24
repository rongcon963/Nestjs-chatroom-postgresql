import { Module } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserModule } from '../user/user.module';
import { ConnectedUser, Message, Room, RoomParticipantsUser } from './entities';
import { ConnectedUserService } from './services/connected-user.service';
import { RoomService } from './services/room.service';
import { MessageService } from './services/message.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Room,
      ConnectedUser,
      Message,
      RoomParticipantsUser,
    ]),
    UserModule,
  ],
  providers: [ChatGateway, ConnectedUserService, RoomService, MessageService],
})
export class ChatModule {}
