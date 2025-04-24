import { IsNotEmpty, IsString, IsUUID } from "class-validator";

export class DeleteRoomDto {
  @IsUUID()
  @IsString()
  @IsNotEmpty()
  room_id: string;
}