export interface User {
  id: string;
  username: string;
  passwordHash: string;
  createdAt: Date;
}

export interface UserCredentials {
  username: string;
  password: string;
}

export interface PublicUser {
  id: string;
  username: string;
}

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    username: user.username,
  };
}
