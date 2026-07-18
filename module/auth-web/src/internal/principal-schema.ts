import type { Principal } from '@travetto/auth';
import { type AnyMap, toConcrete } from '@travetto/runtime';
import { Schema, SchemaRegistryIndex } from '@travetto/schema';

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

SchemaRegistryIndex.getForRegister(toConcrete<Principal>()).register(SchemaRegistryIndex.getConfig(PrincipalSchema));
