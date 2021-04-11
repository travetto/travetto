import { AppError } from '@travetto/base';

type PermSet = Set<string> | ReadonlySet<string>;

type PermissionChecker = {
  all: (perms: PermSet) => boolean;
  any: (perms: PermSet) => boolean;
};

/**
 * Standard auth utilities
 */
export class AuthUtil {

  static #checkExcCache = new Map<string, PermissionChecker>();
  static #checkIncCache = new Map<string, PermissionChecker>();

  /**
   * Build a permission checker against the provided permissions
   *
   * @param perms Set of permissions to check
   * @param defaultIfEmpty If no perms passed, default to empty
   */
  static #buildChecker(perms: Iterable<string>, defaultIfEmpty: boolean): PermissionChecker {
    const permArr = [...perms].map(x => x.toLowerCase());
    let all = (_: PermSet) => defaultIfEmpty;
    let any = (_: PermSet) => defaultIfEmpty;
    if (permArr.length) {
      all = (uPerms: PermSet) => permArr.every(x => uPerms.has(x));
      any = (uPerms: PermSet) => permArr.some(x => uPerms.has(x));
    }
    return { all, any };
  }

  /**
   * Build a permission checker off of an include, and exclude set
   *
   * @param include Which permissions to include
   * @param exclude Which permissions to exclude
   * @param matchAll Whether not all permissions should be matched
   */
  static permissionChecker(include: Iterable<string>, exclude: Iterable<string>, mode: 'all' | 'any' = 'any') {
    const incKey = [...include].sort().join(',');
    const excKey = [...exclude].sort().join(',');

    if (!this.#checkIncCache.has(incKey)) {
      this.#checkIncCache.set(incKey, this.#buildChecker(include, true));
    }
    if (!this.#checkExcCache.has(excKey)) {
      this.#checkExcCache.set(excKey, this.#buildChecker(exclude, false));
    }

    const includes = this.#checkIncCache.get(incKey)![mode];
    const excludes = this.#checkExcCache.get(excKey)![mode];

    return {
      includes, excludes, check: (perms: PermSet) => includes(perms) && !excludes(perms)
    };
  }

  /**
   * Build a permission checker off of an include, and exclude set
   *
   * @param include Which permissions to include
   * @param exclude Which permissions to exclude
   * @param matchAll Whether not all permissions should be matched
   */
  static checkPermissions(permissions: Iterable<string>, include: Iterable<string>, exclude: Iterable<string>, mode: 'all' | 'any' = 'any') {
    const { check } = this.permissionChecker(include, exclude, mode);
    if (!check(!(permissions instanceof Set) ? new Set(permissions) : permissions)) {
      throw new AppError('Insufficient permissions', 'permissions');
    }
  }
}