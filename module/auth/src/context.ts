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
  /**
   * Identity of the context
   */
  public identity: I;
  /**
   * The principal of the context
   */
  public principal: P;

  constructor(identity: I, principal?: P) {
    if (!principal) {
      principal = identity as (I & P);
    }
    this.principal = principal;
    this.identity = identity;
    this.permissions = principal?.permissions ?? [];
  }

  /**
   * Get the principal/identity id
   */
  get id() {
    return this.principal?.id ?? this.identity.id;
  }

  /**
   * Get list of permissions
   */
  get permissions(): Readonly<string[]> {
    return this.permsArr;
  }

  /**
   * Set list of permissions
   */
  set permissions(perms: Readonly<string[]>) {
    this.permsSet = new Set(perms);
    this.permsArr = [...this.permsSet];
  }

  /**
   * Get permissions as a set
   */
  get permissionSet(): ReadonlySet<string> {
    return this.permsSet;
  }

  /**
   * Get principal's details
   */
  get principalDetails() {
    return this.principal.details as U;
  }

  /**
   * Set principal's details
   * @param details Details to set
   */
  set principalDetails(details: U) {
    this.principal.details = details;
  }

  /**
   * Update the principal's details
   * @param details Details to update
   */
  updatePrincipalDetails(details: U) {
    Object.assign(this.principal.details, details);
  }

  /**
   * Check permissions for a given principal
   *
   * @param include The list of permissions that should be included.
   * @param exclude The list of permissions that should be excluded.
   * @param matchAll Do all permissions need to be matched or any?
   */
  checkPermissions(include: Set<string>, exclude: Set<string>, mode: 'all' | 'any' = 'any') {
    if (!AuthUtil.permissionSetChecker(include, exclude, mode)(this.permsSet)) {
      throw new AppError('Insufficient permissions', 'permissions');
    }
  }
}