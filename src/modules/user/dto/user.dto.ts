import { ApiProperty } from "@nestjs/swagger";

export class UserDto {
  @ApiProperty({
    description: 'The unique identifier of the user',
    example: '123e4567-e89b-12d3-a456-426655440000',
  })
  id: string;

  @ApiProperty({
    description: 'The first name of the user',
    example: 'John',
  })
  first_name: string;

  @ApiProperty({
    description: 'The last name of the user',
    example: 'Doe',
  })
  last_name: string;

  @ApiProperty({
    description: 'The email address of the user',
    example: 'example@example.com',
  })
  email: string;
}