import { Schema } from '@travetto/schema'; // @line-if @travetto/schema

@Schema() // @line-if @travetto/schema
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