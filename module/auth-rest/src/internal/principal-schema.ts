import { ClassList, SchemaRegistry } from '@travetto/schema';
import { toConcrete, Class, TypedObject } from '@travetto/runtime';
import { Principal } from '@travetto/auth';

const PrincipalTarget = toConcrete<Principal>();

const FIELDS: Record<keyof Principal, Class | ClassList> = {
  id: String,
  expiresAt: Date,
  issuedAt: Date,
  issuer: String,
  sessionId: String,
  permissions: [String],
  details: Object,
};

for (const [field, type] of TypedObject.entries(FIELDS)) {
  SchemaRegistry.registerPendingFieldConfig(toConcrete<Principal>(), field, type, { required: { active: field === 'id' } });
}

SchemaRegistry.register(PrincipalTarget, { class: PrincipalTarget });