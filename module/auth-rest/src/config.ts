import { Config } from '@travetto/config';
import { Runtime, AppError, BinaryUtil } from '@travetto/runtime';
import { Ignore, Secret } from '@travetto/schema';

type KeyRec = { key: string, id: string };

@Config('rest.auth')
export class RestAuthConfig {
  mode: 'cookie' | 'header' = 'cookie';
  header: string = 'Authorization';
  cookie: string = 'trv_auth';
  headerPrefix: string = 'Token';
  @Secret()
  signingKey?: string | string[];

  @Secret()
  @Ignore()
  keyMap: Record<string, KeyRec> & { default?: KeyRec } = {};

  postConstruct(): void {
    if (!this.signingKey && Runtime.production) {
      throw new AppError('The default signing key is only valid for development use, please specify a config value at rest.auth.signingKey');
    }
    this.signingKey ??= 'dummy';
    const all = [this.signingKey].flat();
    for (const key of all) {
      const record: KeyRec = { key, id: BinaryUtil.hash(key, 8) };
      if (key === all[0]) {
        this.keyMap.default = record;
      }
      this.keyMap[record.id] = record;
    }
  }
}
