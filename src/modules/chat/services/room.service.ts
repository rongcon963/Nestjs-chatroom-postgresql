import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { Message, Room, RoomParticipantsUser } from '../entities';
import { DataSource, Repository } from 'typeorm';
import { AssignUsersDto, CreateRoomDto, RoomDetailDto, UpdateRoomDto } from '../dto';
import { plainToInstance } from 'class-transformer';
import { WsException } from '@nestjs/websockets';
import { MessageService } from './message.service';
import { User } from 'src/modules/user/entities';
import { sanitizeUser } from 'src/common/helpers/sanitize-user';

@Injectable()
export class RoomService {
  constructor(
    @InjectRepository(Room)
    private readonly roomRepository: Repository<Room>,
    @InjectDataSource() private dataSource: DataSource,
    private readonly messageService: MessageService,
  ) {}

  async create(userId: string, createRoomDto: CreateRoomDto): Promise<Room> {
    const { participants, ...roomDetails } = createRoomDto;

    try {
      const newRoom = this.roomRepository.create({
        ...roomDetails,
        created_by: userId,
        updated_by: userId,
      });

      const savedRoom = await this.roomRepository.save(newRoom);

      if (participants && participants.length > 0) {
        participants.push(userId);
        await this.assignUsersToRoom(userId, {
          room_id: savedRoom.id,
          participants,
        });
      }

      return savedRoom;
    } catch (error) {
      throw new WsException('Error occurred while creating the room.');
    }
  }

  async findOne(userId: string, id: string): Promise<Room> {
    try {
      const room = await this.roomRepository.findOne({
        where: { id },
        relations: ['participants', 'participants.connectedUsers', 'messages'],
      });

      if (!room) {
        throw new WsException(`Room with ID "${id}" not found.`);
      }

      const isParticipant = room.participants.some(
        (participant) => participant.id === userId,
      );
      if (!isParticipant) {
        throw new WsException(
          `User with ID "${userId}" is not a participant of room with ID "${id}".`,
        );
      }

      room.participants = room.participants.map(
        (participant) => sanitizeUser(participant) as User,
      );

      return room;
    } catch (error) {
      throw new WsException('Error occurred while retrieving the room.');
    }
  }

  async findByUserId(userId: string): Promise<RoomDetailDto[]> {
    try {
      // const rooms = await this.roomRepository.find({
      //   where: { participants: { id: userId } },
      //   relations: ['room_participants_user'],
      // });
      const rooms = await this.roomRepository.find({
        relations: {
          participants: true,
        }, // Include participants in the result
        where: {
          participants: {
            id: userId, // Find rooms where the user is a participant
          },
        },
      });

      const roomDetailsList: RoomDetailDto[] = [];

      for (const room of rooms) {
        const lastMessageResult = await this.messageService.findByRoomId({
          room_id: room.id,
          first: 0,
          rows: 1,
        });

        const roomDetail = plainToInstance(RoomDetailDto, {
          ...room,
          lastMessage: lastMessageResult.total
            ? lastMessageResult.result[0]
            : null,
          participants: room.participants,
        });

        roomDetailsList.push(roomDetail);
      }
      return roomDetailsList;
    } catch (error) {
      throw new WsException(
        'An error occurred while retrieving user rooms. Please try again later.',
      );
    }
  }

  async update(
    user_id: string,
    room_id: string,
    updateRoomDto: UpdateRoomDto,
  ): Promise<Room> {
    const { name, participants} = updateRoomDto;

    try {
      const room = await this.roomRepository.findOne({ where: { id: room_id } });

      if (name !== undefined) {
        room.name = name;
      }

      if (participants !== undefined) {
        participants.push(user_id);
        await this.assignUsersToRoom(user_id, {
          room_id,
          participants,
        });
      }

      room.updated_by = user_id;
      const updatedRoom = await this.roomRepository.save(room);

      return updatedRoom;
    } catch (error) {
      throw new WsException('Error occurred while updating the room.');
    }
  }

  async deleteRoom(room_id: string): Promise<void> {
    try {
      await this.dataSource.transaction(async (transactionalEntityManager) => {
        await transactionalEntityManager.delete(Message, {room_id});

        await transactionalEntityManager.delete(RoomParticipantsUser, {room_id});

        const deletionResult = await transactionalEntityManager.delete(Room, {
          id: room_id,
        });

        if (deletionResult.affected === 0) {
          throw new WsException(`Room with ID "${room_id}" not found.`);
        }
      })
    } catch (error) {
      throw new WsException(
        'An error occurred while attempting to delete the room. Please try again.',
      );
    }
  }

  private async assignUsersToRoom(
    userId: string,
    assignUsersDto: AssignUsersDto,
  ): Promise<void> {
    try {
      await this.dataSource.transaction(async (transactionEntityManager) => {
        const existingParticipants = await transactionEntityManager.find(
          RoomParticipantsUser,
          {
            where: { room_id: assignUsersDto.room_id },
          },
        );

        // For logs
        // const operationType =
        //   existingParticipants.length > 0 ? 're-assigned' : 'assigned';

        await transactionEntityManager.delete(RoomParticipantsUser, {
          room_id: assignUsersDto.room_id,
        });

        const participantsToAssign = assignUsersDto.participants.map(
          (participantId) => ({
            room_id: assignUsersDto.room_id,
            user_id: participantId,
            created_by: userId,
            updated_by: userId,
          }),
        );

        await transactionEntityManager.save(
          RoomParticipantsUser,
          participantsToAssign,
        );
      });
    } catch (error) {
      throw new WsException(
        `Failed to assign users to the room: ${error.message}`,
      );
    }
  }
}
