import { BaseEntity } from "src/common/entities/base.entity";
import { User } from "src/modules/user/entities";
import { Column, Entity, JoinTable, ManyToMany, OneToMany, Unique } from "typeorm";
import { Message } from ".";

@Entity({ name: 'room' })
@Unique(['name'])
export class Room extends BaseEntity {
  @Column({ nullable: true })
  name: string;

  @Column()
  type: string;

  @Column()
  created_by: string;

  @Column()
  updated_by: string;

  @ManyToMany(() => User, (user) => user.rooms)
  @JoinTable({
    name: 'room_participants_user',
    joinColumn: {
      name: 'room_id',
      referencedColumnName: 'id',
    },
    inverseJoinColumn: {
      name: 'user_id',
      referencedColumnName: 'id',
    },
  })
  participants: User[];

  @OneToMany(() => Message, (message) => message.room)
  messages: Message[];
}