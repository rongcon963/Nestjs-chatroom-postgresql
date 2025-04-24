import { Exclude, instanceToPlain } from "class-transformer";
import { BaseEntity } from "src/common/entities/base.entity";
import { Message, Room } from "src/modules/chat/entities";
import { ConnectedUser } from "src/modules/chat/entities/connected-user.entity";
import { Column, Entity, ManyToMany, OneToMany } from "typeorm";

@Entity({ name: 'user' })
export class User extends BaseEntity {
  @Column({ nullable: true })
  first_name: string;

  @Column({ nullable: true })
  last_name: string;

  @Column({ unique: true })
  email: string;

  @Exclude({ toPlainOnly: true })
  @Column()
  password: string;

  @Exclude({ toPlainOnly: true })
  @Column({ nullable: true })
  refresh_token: string;

  toJSON() {
    return instanceToPlain(this);
  }

  @ManyToMany(() => Room, (room) => room.participants)
  rooms: Room[];

  @OneToMany(() => ConnectedUser, (connectedUser) => connectedUser.user)
  connected_users: ConnectedUser[];

  @OneToMany(() => Message, (message) => message.creator)
  messages: Message[];
}
