import { Schema, SchemaRegistryIndex } from '@travetto/schema';
import { toConcrete, AnyMap } from '@travetto/runtime';
import { Principal } from '@travetto/auth';
import { RegistryV2 } from '@travetto/registry';

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

RegistryV2.getForRegister(SchemaRegistryIndex, toConcrete<Principal>()).register(
  RegistryV2.getForRegister(SchemaRegistryIndex, PrincipalSchema).get()
);