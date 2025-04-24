import { PartialType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto';
import { IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @ApiProperty({
    required: false,
    description: 'The refresh token of the user',
    example: 'updated-refresh-token',
  })
  @IsString()
  @IsOptional()
  refresh_token: string;
}
