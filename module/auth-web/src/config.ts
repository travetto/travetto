import { Config } from '@travetto/config';
import { Runtime, RuntimeError, BinaryMetadataUtil } from '@travetto/runtime';
import { Ignore, Secret } from '@travetto/schema';

type KeyEntry = { key: string, id: string };

@Config('web.auth')
export class WebAuthConfig {
  applies: boolean = false;
  mode: 'cookie' | 'header' = 'cookie';
  header: string = 'Authorization';
  cookie: string = 'trv_auth';
  headerPrefix: string = 'Token';

  @Secret()
  signingKey?: string | string[];
  @Ignore()
  keyMap: Record<string, KeyEntry> & { default?: KeyEntry } = {};

  postConstruct(): void {
    if (!this.signingKey && Runtime.production) {
      throw new RuntimeError('The default signing key is only valid for development use, please specify a config value at web.auth.signingKey');
    }
    this.signingKey ??= 'dummy';

    const all = [this.signingKey].flat().map(key => ({ key, id: BinaryMetadataUtil.hash(key, { length: 8 }) }));
    this.keyMap = Object.fromEntries(all.map(entry => [entry.id, entry]));
    this.keyMap.default = all[0];
  }
}
