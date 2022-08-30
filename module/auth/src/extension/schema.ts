// @file-if @travetto/schema
import { SchemaRegistry } from '@travetto/schema';

import { PrincipalTarget } from '../internal/types';

SchemaRegistry.register(PrincipalTarget, {
  class: PrincipalTarget,
});

/*
  id: string;
  expiresAt?: Date;
  issuedAt?: Date;
  maxAge?: number;
  issuer?: string;
  details?: unknown;
  permissions?: string[];
*/

const optional = (): { required: { active: false } } => ({ required: { active: false } });

SchemaRegistry.registerPendingFieldConfig(PrincipalTarget, 'id', String, {});
SchemaRegistry.registerPendingFieldConfig(PrincipalTarget, 'expiresAt', Date, optional());
SchemaRegistry.registerPendingFieldConfig(PrincipalTarget, 'issuedAt', Date, optional());
SchemaRegistry.registerPendingFieldConfig(PrincipalTarget, 'mageAge', Number, optional());
SchemaRegistry.registerPendingFieldConfig(PrincipalTarget, 'issuer', String, optional());
SchemaRegistry.registerPendingFieldConfig(PrincipalTarget, 'permissions', [String], optional());
SchemaRegistry.registerPendingFieldConfig(PrincipalTarget, 'details', Object, optional());