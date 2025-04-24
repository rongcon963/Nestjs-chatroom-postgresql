import { BaseEntity } from "src/common/entities/base.entity";
import { Column, Entity, JoinColumn, ManyToOne } from "typeorm";
import { Room } from ".";
import { User } from "src/modules/user/entities";

@Entity({ name: 'message' })
export class Message extends BaseEntity {
  @Column()
  room_id: string;

  @Column()
  text: string;

  @Column()
  created_by: string;

  @Column()
  updated_by: string;

  @ManyToOne(() => Room, (roomEntity) => roomEntity.messages)
  // @JoinColumn([{ name: 'room_id', referencedColumnName: 'id' }])
  room: Room;

  @ManyToOne(() => User, (user) => user.messages)
  @JoinColumn([{ name: 'created_by', referencedColumnName: 'id' }])
  creator: User;
}