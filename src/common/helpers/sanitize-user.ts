import { UserDto } from "src/modules/user/dto";
import { User } from "src/modules/user/entities";

export const sanitizeUser = (user: User): UserDto => {
  const { password, refresh_token, ...sanitizedUser } = user;
  return sanitizedUser;
};
