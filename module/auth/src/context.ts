import { AppError } from '@travetto/base';

import { AuthUtil } from './util';
import { Principal, Identity } from './types';

const EMPTY_SET = new Set<string>();

export class AuthContext<
  U = any,
  I extends Identity = Identity,
  P extends Principal = Principal
  > {

  public identity: I;
  public principal: P;

  constructor(identity: I, principal?: P) {
    if (!principal) {
      principal = identity as (I & P);
    }
    this.principal = principal;
    this.identity = identity;
    this.principal.permissions = this.principal.permissions || new Set<string>();
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

  checkPermissions(include: string[] | Set<string>, exclude: string[] | Set<string>, matchAll = true) {
    const perms = this.principal ? this.principal.permissions : EMPTY_SET;
    if (!AuthUtil.permissionSetChecker(include, exclude, matchAll)(perms)) {
      throw new AppError('Insufficient permissions', 'permissions');
    }
  }
}