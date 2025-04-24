import { HttpStatus, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './entities';
import { Repository } from 'typeorm';
import { UserDto } from './dto';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}
  
  async create(createUserDto: CreateUserDto): Promise<UserDto> {
    try {
      const user = this.userRepository.create(createUserDto);
      return await this.userRepository.save(user);
    } catch (err) {
      throw new InternalServerErrorException('Fail to create user');
    }
  }

  async findAll(): Promise<UserDto[]> {
    try {
      const users = await this.userRepository.find();
      return users;
    } catch (err) {
      throw new InternalServerErrorException('Fail to get all users');
    }
  }

  async findOne(userId: string): Promise<UserDto> {
    try {
      const user = await this.userRepository.findOne({
        where: {
          id: userId
        }
      });

      if (!user) {
        throw new InternalServerErrorException(`User with ID "${userId}" not found`);
      }

      return user;
    } catch (err) {
      throw new NotFoundException(`Failed to find user with ID "${userId}"`);
    }
  }

  async findUserByEmail(email: string): Promise<User> {
    try {
      const user = await this.userRepository.findOne({
        where: {
          email: email
        }
      });
      
      if (!user) {
        throw new NotFoundException(`User with email "${email}" not found`);
      }

      return user;
    } catch (err) {
      throw new InternalServerErrorException('Fail to get user by email', err);
    }
  }

  async update(userId: string, updateUserDto: UpdateUserDto): Promise<UserDto> {
    try {
      const user = await this.findOne(userId);

      Object.assign(user, updateUserDto);
      return await this.userRepository.save(user);
    } catch (err) {
      throw new InternalServerErrorException(`Fail to update user with ID "${userId}"`);
    }
  }

  async remove(userId: string) {
    try {
      const user = await this.findOne(userId);

      await this.userRepository.delete({ id: user.id });
      
      return {
        status: HttpStatus.OK,
        message: 'The user has been successfully deleted.'
      }
    } catch (err) {
      throw new InternalServerErrorException(`Fail to remove user with ID "${userId}"`);
    }
  }
}
