import { Class } from '@travetto/registry';

export abstract class PrincipalConfig<T = any> {
  abstract get idField(): keyof T;
  abstract get passwordField(): keyof T;
  abstract get type(): Class<T>;
  abstract get permissionsField(): keyof T;

  protected lookup<U = any>(obj: T, field: keyof T): U {
    return obj[field] as any as U;
  }

  getId = (obj: T) => this.lookup<string>(obj, this.idField);
  getPassword = (obj: T): string => this.lookup(obj, this.passwordField);
  getPermissions(obj: T): Set<string> {
    const val = this.lookup<string | string[] | Set<string>>(obj, this.permissionsField);
    return val instanceof Set ? val :
      (Array.isArray(val) ? new Set(val) :
        new Set(val.trim().split(/\s*,\s*/)));
  }
}