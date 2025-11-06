import { Schema, SchemaRegistryIndex } from '@travetto/schema';
import { toConcrete, AnyMap } from '@travetto/runtime';
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

SchemaRegistryIndex.getForRegister(toConcrete<Principal>()).register(
  SchemaRegistryIndex.getClassConfig(PrincipalSchema)
);