import { IsNotEmpty, IsString, IsUUID } from "class-validator";

export class RoomFetchRequestDto {
  @IsUUID()
  @IsString()
  @IsNotEmpty()
  room_id: string;
}