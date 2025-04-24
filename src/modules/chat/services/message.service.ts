import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Message } from '../entities';
import { ILike, Repository } from 'typeorm';
import { CreateMessageDto, DeleteMessageDto, FilterMessageDto, MessageDto, UpdateMessageDto } from '../dto';
import { TResultAndCount } from 'src/types/result-and-count.type';
import { WsException } from '@nestjs/websockets';

@Injectable()
export class MessageService {
  constructor(
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
  ) {}

  async create(
    userId: string,
    createMessageDto: CreateMessageDto,
  ): Promise<TResultAndCount<MessageDto>> {
    try {
      const newMessage = this.messageRepository.create({
        ...createMessageDto,
        created_by: userId,
        updated_by: userId,
      });

      await this.messageRepository.save(newMessage);

      return await this.findByRoomId({ room_id: createMessageDto.room_id });
    } catch (errpr) {
      throw new WsException(
        'An error occurred while creating the message. Please try again.',
      );
    }
  }

  async findByRoomId(filterMessageDto: FilterMessageDto): Promise<TResultAndCount<MessageDto>> {
    const { first = 0, rows = 20, filter = '', room_id } = filterMessageDto;

    try {
      const [result, total] = await this.messageRepository.findAndCount({
        where: { text: ILike(`%${filter}%`), room_id},
        relations: ['creator'],
        order: {created_at: 'DESC'},
        take: rows,
        skip: first,
      });

      const sanitizedMessages = result.map((message) => {
        const { creator } = message;
        const {password, refresh_token, ...sanitizedCreator } = creator;
        return { ...message, creator: sanitizedCreator };
      });

      return { result: sanitizedMessages, total };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new WsException(
          error.message || 'The requested resource was not found.',
        );
      }

      if (error instanceof WsException) {
        throw error;
      }

      throw new WsException(
        'An error occurred while fetching messages. Please try again later.',
      );
    }
  }

  async update(
    userId: string,
    updateMessageDto: UpdateMessageDto
  ): Promise<Message> {
    const {message_id, text} = updateMessageDto;

    try {
      const existingMessage = await this.messageRepository.findOne({
        where: { id: message_id },
      });

      if (!existingMessage) {
        throw new NotFoundException(
          `Message with ID "${message_id}" not found.`,
        );
      }

      if (existingMessage.created_by !== userId) {
        throw new WsException(
          'Access Denied: You can only update your own messages.',
        );
      }

      await this.messageRepository.update(
        { id: message_id },
        { text, created_at: new Date() },
      );

      return await this.messageRepository.findOne({
        where: {
          id: message_id,
        },
      });
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new WsException(
          error.message || 'The requested resource was not found.',
        );
      }

      if (error instanceof WsException) {
        throw error;
      }

      throw new WsException(
        'An error occurred while updating the message. Please try again.',
      );
    }
  }

  async delete(
    userId: string,
    deleteMessageDto: DeleteMessageDto,
  ): Promise<void> {
    const { room_id, message_ids } = deleteMessageDto;

    try {
      for (const messageId of message_ids) {
        const message = await this.messageRepository.findOne({
          where: { id: messageId, room_id },
        });

        if (!message) {
          continue;
        }

        if (message.created_by !== userId) {
          throw new WsException(
            `Access Denied: You can only delete your own messages.`,
          );
        }

        await this.messageRepository.delete({ id: messageId})
      }
    } catch (error) {
      if (error instanceof WsException) {
        throw error;
      }

      throw new WsException(
        'An unexpected error occurred. Please try again later.',
      );
    }
  }
}
