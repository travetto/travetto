import { Util, Env } from '@travetto/base';

import { ConfigUtil, Nested } from './util';

export class $ConfigSource {

  private initialized: boolean = false;
  private storage = {};   // Lowered, and flattened

  /*
    Order of specificity (least to most)
      - Resource application.yml
      - Resource {profile}.yml
      - Resource {env}.yml
      - Environment vars -> Overrides everything (happens at bind time)
  */
  init() {
    if (this.initialized) {
      return;
    }
    this.initialized = true;
    this.loadExternal();
  }

  loadExternal() {
    this.reset();
    const files = [
      ...ConfigUtil.fetchConfigs(p => p === 'application'),
      ...ConfigUtil.fetchConfigs(p => Env.hasProfile(p)),
      ...ConfigUtil.fetchConfigs(p => p === Env.env)
    ];

    if (files.length) {
      console.debug('Found configurations for', files.map(x => x.profile));
    }

    for (const f of files) {
      this.putAll(ConfigUtil.getConfigFileAsData(f.file));
    }
  }

  get(key: string) {
    return this.bindTo({}, key);
  }

  toJSON() {
    return this.storage;
  }

  reset() {
    this.storage = {};
  }

  putAll(data: Nested) {
    Util.deepAssign(this.storage, ConfigUtil.breakDownKeys(data), 'coerce');
  }

  bindTo(obj: any, key: string) {
    const keys = key?.split('.') ?? [];
    let sub: any = this.storage;

    while (keys.length && sub) {
      const next = keys.shift()!;
      sub = sub[next];
    }

    if (sub) {
      Util.deepAssign(obj, sub);
    }

    ConfigUtil.bindEnvByKey(obj, key);

    return obj;
  }
}
export const ConfigSource = new $ConfigSource();