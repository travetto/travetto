export interface SecurityContext<T = any> {
  id: string;
  permissions: Set<string>;
  full: T;
}