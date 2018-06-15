export const AUTH = Symbol('@travetto/auth');

export interface AuthContext<U> {
  id: string;
  permissions: Set<string>;
  principal: U;
}