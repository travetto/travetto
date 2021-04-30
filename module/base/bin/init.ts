import { EnvUtil } from '@travetto/boot/src/env';

interface InitConfig {
  env?: string;
  dynamic?: boolean;
  debug?: string;
  set?: Record<string, string>;
  append?: Record<string, (string[] | string)>;
}
/**
 * Initialization utils
 */
export class EnvInit {

  /**
   * Add item to environment variable list, not persistent
   */
  static addToList(k: string, ...items: string[]) {
    process.env[k] = [...new Set(EnvUtil.getList(k, items))].join(',');
  }

  /**
   * Initialize the app environment
   */
  static init({ env, dynamic, debug, set, append }: InitConfig = {}) {
    process.env.TRV_ENV = env ?? process.env.TRV_ENV ?? process.env.NODE_ENV ?? 'dev';
    const prod = /^prod(uction)$/i.test(process.env.TRV_ENV);
    dynamic ??= EnvUtil.isTrue('TRV_DYNAMIC');

    Object.assign(process.env, {
      NODE_ENV: prod ? 'production' : 'development',
      ...(dynamic !== undefined ? { TRV_DYNAMIC: `${dynamic}` } : {}),
      TRV_DEBUG: EnvUtil.get('TRV_DEBUG', EnvUtil.get('DEBUG', debug ?? (prod ? '0' : '')))
    }, set ?? {});

    for (const [key, vals] of Object.entries(append ?? {})) {
      this.addToList(key, ...((typeof vals === 'string' ? [vals] : vals) ?? []));
    }
  }
}