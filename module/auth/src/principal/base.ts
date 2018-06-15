import { Class } from '@travetto/registry';

export abstract class PrincipalProvider<T = any> {
  abstract get idField(): string;
  abstract get passwordField(): string;
  abstract get type(): Class<T>;
  abstract get permissionsField(): string;

  protected lookup<U = any>(obj: T, field: string): U {
    return (obj as any)[field] as U;
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