import { bulkRead, bulkReadSync, AppEnv, bulkFindSync } from '@travetto/base';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { readdirSync } from 'fs';
import { ConfigMap } from './map';

const ENV_SEP = '_';

export class ConfigLoader {

  private static _initialized: boolean = false;
  private static map = new ConfigMap();

  static get(key: string) {
    return this.map.get(key);
  }

  static bindTo(obj: any, key: string) {
    return this.map.bindTo(obj, key);
  }

  /*
    Order of specificity (least to most)
      - Module configs -> located in the node_modules/@travetto/config folder
      - Local configs -> located in the config folder
      - External config file -> loaded from env
      - Environment vars -> Overrides everything
  */
  static initialize() {
    if (this._initialized) {
      return;
    }
    this._initialized = true;

    if (!AppEnv.test) {
      console.log(`Initializing: ${AppEnv.all.join(',')}`);
    }

    // Load all namespaces from core
    let files = bulkReadSync([/^node_modules\/@travetto\/.*\/config\/.*[.]yml$/]);

    // Load all configs, exclude env configs
    files = files.concat(bulkReadSync([/^config\/.*[.]yml$/]));

    for (const file of files) {
      const ns = path.basename(file.name, '.yml');
      yaml.safeLoadAll(file.data, doc => this.map.putAll({ [ns]: doc }));
    }

    // Handle environmental loads
    if (AppEnv.all.length) {
      const loaded: string[] = [];
      const envFiles = bulkReadSync([/^env\/.*[.]yml$/])
        .map(x => {
          const tested = path.basename(x.name, '.yml');
          const found = AppEnv.is(tested);
          return { name: tested, found, data: x.data };
        })
        .filter(x => x.found);

      console.debug('Found configurations for', envFiles.map(x => x.name));

      for (const file of envFiles) {
        yaml.safeLoadAll(file.data, doc => this.map.putAll(doc));
      }
    }

    // Handle process.env
    for (const k of Object.keys(process.env)) {
      if (k.includes(ENV_SEP)) { // Require at least one level
        this.map.putCaseInsensitivePath(k.split(ENV_SEP), process.env[k] as string);
      }
    }

    if (!process.env.QUIET_CONFIG && !AppEnv.test) {
      console.log('Configured', this.map.toJSON());
    }
  }
}