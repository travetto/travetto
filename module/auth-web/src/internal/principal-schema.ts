import { Schema, SchemaRegistry } from '@travetto/schema';
import { toConcrete, AnyMap, asFull } from '@travetto/runtime';
import { Principal } from '@travetto/auth';

@Schema()
export class PrincipalSchema implements Principal {
  id: string;
  details: AnyMap;
  expiresAt?: Date | undefined;
  issuedAt?: Date | undefined;
  issuer?: string | undefined;
  sessionId?: string | undefined;
  permissions?: string[] | undefined;
}

SchemaRegistry.mergeConfigs(
  asFull(SchemaRegistry.getOrCreatePending(toConcrete<Principal>())),
  SchemaRegistry.getOrCreatePending(PrincipalSchema)
);