export class PrincipalTarget {
  id: string;
  expiresAt?: Date;
  issuedAt?: Date;
  maxAge?: number;
  issuer?: string;
  details?: unknown;
  permissions?: string[];
}
export class AuthorizerTarget { }
export class AuthenticatorTarget { }
export class PrincipalSerializerTarget { }