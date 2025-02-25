import { ClassList, SchemaRegistry } from '@travetto/schema';
import { Class, TypedObject } from '@travetto/runtime';

import { PrincipalTarget } from '@travetto/auth/src/internal/types.ts';

const FIELDS: Record<keyof PrincipalTarget, Class | ClassList> = {
  id: String,
  expiresAt: Date,
  issuedAt: Date,
  maxAge: Number,
  issuer: String,
  permissions: [String],
  details: Object,
};

for (const [field, type] of TypedObject.entries(FIELDS)) {
  SchemaRegistry.registerPendingFieldConfig(PrincipalTarget, field, type, { required: { active: field === 'id' } });
}

SchemaRegistry.register(PrincipalTarget, { class: PrincipalTarget });