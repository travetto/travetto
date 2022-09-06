import { SchemaRegistry } from '@travetto/schema';
import { PrincipalTarget } from '@travetto/auth/src/internal/types';

const optional = (): { required: { active: false } } => ({ required: { active: false } });
SchemaRegistry.registerPendingFieldConfig(PrincipalTarget, 'id', String, { required: { active: true } });
SchemaRegistry.registerPendingFieldConfig(PrincipalTarget, 'expiresAt', Date, optional());
SchemaRegistry.registerPendingFieldConfig(PrincipalTarget, 'issuedAt', Date, optional());
SchemaRegistry.registerPendingFieldConfig(PrincipalTarget, 'maxAge', Number, optional());
SchemaRegistry.registerPendingFieldConfig(PrincipalTarget, 'issuer', String, optional());
SchemaRegistry.registerPendingFieldConfig(PrincipalTarget, 'permissions', [String], optional());
SchemaRegistry.registerPendingFieldConfig(PrincipalTarget, 'details', Object, optional());

SchemaRegistry.register(PrincipalTarget, {
  class: PrincipalTarget,
});