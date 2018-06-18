import { PrincipalConfig } from '../principal';
import { AuthContext } from '../types';

export abstract class AuthSource<U, T extends PrincipalConfig<U> = PrincipalConfig<U>> {

  constructor(public principal: T) {
  }

  abstract retrieve(userId: string): Promise<U>;

  abstract login(userId: string, password: string): Promise<U>;

  async serialize(user: U) {
    return this.principal.getId(user);
  }

  async deserialize(userId: string) {
    const user = await this.retrieve(userId);
    return user;
  }

  register?(user: U): Promise<U>;

  changePassword?(userId: string, password: string, oldPassword?: string): Promise<U>;

  getContext(obj: U): AuthContext<U> {
    return {
      id: this.principal.getId(obj),
      permissions: this.principal.getPermissions(obj),
      principal: obj
    };
  }
}