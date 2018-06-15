export interface AuthContext<T = any> {
  id: string;
  permissions: Set<string>;
  principal: T;
}