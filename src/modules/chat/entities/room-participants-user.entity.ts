import { BaseEntity } from "src/common/entities/base.entity";
import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from "typeorm";
import { Room } from "./room.entity";
import { User } from "src/modules/user/entities";

@Entity({ name: 'room_participants_user' })
export class RoomParticipantsUser extends BaseEntity {
  @PrimaryColumn({ name: 'room_id' })
  room_id: string;

  @PrimaryColumn({ name: 'user_id' })
  user_id: string;
  // @PrimaryColumn({ name: 'room_id' })
  // roomId: number;

  // @PrimaryColumn({ name: 'user_id' })
  // userId: number;

  @Column()
  created_by: string;

  @Column()
  updated_by: string;

  @ManyToOne(() => Room, (room) => room.participants)
  @JoinColumn({ name: 'room_id' })
  room: Room;

  @ManyToOne(() => User, (user) => user.rooms)
  @JoinColumn({ name: 'user_id' })
  user: User;
}
