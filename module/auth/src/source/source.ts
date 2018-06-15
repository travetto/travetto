import { PrincipalProvider } from '../principal';
import { SecurityContext } from './types';

export abstract class AuthSource<U, T extends PrincipalProvider<U> = PrincipalProvider<U>> {
  principalProvider: T;

  abstract fetchPrincipal(userId: string): Promise<U>;

  abstract login(userId: string, password: string): Promise<U>;

  async serialize(user: U) {
    return this.principalProvider.getId(user);
  }

  async deserialize(userId: string) {
    const user = await this.fetchPrincipal(userId);
    return user;
  }

  register?(user: U, password: string): Promise<U>;

  changePassword?(userId: string, password: string, oldPassword?: string): Promise<U>;

  getSecurityContext(obj: U): SecurityContext {
    return {
      id: this.principalProvider.getId(obj),
      permissions: this.principalProvider.getPermissions(obj),
      full: obj
    };
  }
}