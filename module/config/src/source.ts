import { Util } from '@travetto/base';

import { ConfigUtil, Nested } from './util';

export class $ConfigSource {

  private initialized: boolean = false;
  private storage = {};   // Lowered, and flattened

  /*
    Order of specificity (least to most)
      - Module configs -> located in the node_modules/@travetto/<*>/config folder
      - Resource profile files
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
    for (const data of ConfigUtil.getAllConfigFilesAsData()) {
      this.putAll(data);
    }
    const files = ConfigUtil.getActiveProfileFiles();

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