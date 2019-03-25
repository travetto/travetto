export interface Session<T = any> {
  readonly id: string;

  signature?: string;
  expiresAt: number;
  issuedAt: number;
  payload: T;
}

export const RAW_SESSION = Symbol('raw_session');
export const RAW_SESSION_PRIV = Symbol('raw_session_priv');
