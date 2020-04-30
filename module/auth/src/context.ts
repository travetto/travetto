import { AppError } from '@travetto/base';

import { AuthUtil } from './util';
import { Principal, Identity } from './types';

/**
 * Combination of an identity and a principal, to be used for
 * authorizing. Provides simple access to permissions and
 * additional principal details.
 */
export class AuthContext<
  U = any,
  I extends Identity = Identity,
  P extends Principal = Principal> {

  private permsSet: Set<string>;
  private permsArr: string[];
  public identity: I;
  public principal: P;

  constructor(identity: I, principal?: P) {
    if (!principal) {
      principal = identity as (I & P);
    }
    this.principal = principal;
    this.identity = identity;
    this.permissions = principal?.permissions ?? [];
  }

  get id() {
    return this.principal?.id ?? this.identity.id;
  }

  get permissions(): Readonly<string[]> {
    return this.permsArr;
  }

  set permissions(perms: Readonly<string[]>) {
    this.permsSet = new Set(perms);
    this.permsArr = [...this.permsSet];
  }

  get permissionSet(): ReadonlySet<string> {
    return this.permsSet;
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
    if (!AuthUtil.permissionSetChecker(include, exclude, matchAll)(this.permsSet)) {
      throw new AppError('Insufficient permissions', 'permissions');
    }
  }
}