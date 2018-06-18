import { Class } from '@travetto/registry';

export type PrincipalFields<T> = {
  id: keyof T;
  password: keyof T;
  permissions: keyof T;
};

export class PrincipalConfig<T = any, U extends PrincipalFields<T> = PrincipalFields<T>> {

  constructor(public readonly type: Class<T>, public readonly fields: U) { }

  protected lookup<V = any>(obj: T, field: keyof T): V {
    return obj[field] as any as V;
  }

  getId = (obj: T) => this.lookup<string>(obj, this.fields.id);
  getPassword = (obj: T) => this.lookup<string>(obj, this.fields.password);
  getPermissions(obj: T) {
    const val = this.lookup<string | string[] | Set<string>>(obj, this.fields.permissions);
    return val instanceof Set ? val :
      (Array.isArray(val) ? new Set(val) :
        new Set(val.trim().split(/\s*,\s*/)));
  }
}