import { Room } from "../../entities";
import { MessageDto } from "../message/message.dto";

export class RoomDetailDto extends Room {
  last_message: MessageDto;
}