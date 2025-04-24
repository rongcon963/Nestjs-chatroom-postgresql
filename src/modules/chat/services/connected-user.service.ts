import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { ConnectedUser } from "../entities";
import { DeleteResult, Repository } from "typeorm";
import { WsException } from "@nestjs/websockets";

@Injectable()
export class ConnectedUserService {
  constructor(
    @InjectRepository(ConnectedUser)
    private readonly connectedUserRepository: Repository<ConnectedUser>,
  ) {}

  async create(userId: string, socketId: string): Promise<ConnectedUser> {
    try {
      const newUserConnection = this.connectedUserRepository.create({
        user_id: userId,
        socket_id: socketId,
      });
      return await this.connectedUserRepository.save(newUserConnection);
    } catch (err) {
      throw new WsException('Error creating new user connection.');
    }
  }

  async delete(socketId: string): Promise<DeleteResult> {
    try {
      return await this.connectedUserRepository.delete({ socket_id:socketId });
    } catch (err) {
      throw new WsException('Error removing user connection.');
    }
  }

  async deleteAll(): Promise<void> {
    try {
      await this.connectedUserRepository
        .createQueryBuilder('connectedUser')
        .delete()
        .execute();
    } catch (err) {
      throw new WsException('Error clearing all user connections.')
    }
  }
}