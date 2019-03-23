export interface Session<T = any> {
  readonly id: string;

  signature?: string;
  expiresAt: number;
  issuedAt: number;
  payload: T;
}