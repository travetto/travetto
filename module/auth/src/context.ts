import { AppError } from '@travetto/base';

import { AuthUtil } from './util';
import { Principal, Identity } from './types';

export class AuthContext<
  U = any,
  I extends Identity = Identity,
  P extends Principal = Principal
  > {

  public identity: I;
  public principal: P;
  public readonly permissions: Set<string>;

  constructor(identity: I, principal?: P) {
    if (!principal) {
      principal = identity as (I & P);
    }
    this.principal = principal;
    this.identity = identity;
    this.permissions = new Set((principal || {}).permissions || []);
  }

  get id() {
    return (this.principal && this.principal.id) || this.identity.id;
  }

  get principalDetails() {
    return this.principal.details as U;
  }

  set principalDetails(details: U) {
    this.principal.details = details;
  }

  updatePrincipalDetails(details: U) {
    Object.assign(this.principal.details, details);
  }

  checkPermissions(include: Set<string>, exclude: Set<string>, matchAll = false) {
    if (!AuthUtil.permissionSetChecker(include, exclude, matchAll)(this.permissions)) {
      throw new AppError('Insufficient permissions', 'permissions');
    }
  }
}