import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsNotEmpty, IsString, IsUUID } from "class-validator";

export class DeleteMessageDto {
  @ApiProperty({ required: true })
  @IsString()
  @IsUUID()
  @IsNotEmpty()
  room_id: string;

  @ApiProperty({ required: true, type: String, isArray: true })
  @IsArray()
  @IsUUID(4, { each: true })
  @IsNotEmpty()
  message_ids: string[];
}