import { bulkRead, bulkReadSync, AppEnv, bulkFindSync, findAppFilesByExt } from '@travetto/base';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { readdirSync, readFileSync } from 'fs';
import { ConfigMap } from './map';

export class ConfigLoader {

  private static _initialized: boolean = false;
  private static map = new ConfigMap();

  static get(key: string) {
    return this.map.get(key);
  }

  static bindTo(obj: any, key: string) {
    this.map.bindTo(obj, key);
  }

  /*
    Order of specificity (least to most)
      - Module configs -> located in the node_modules/@travetto/config folder
      - Local configs -> located in the config folder
      - External config file -> loaded from env
      - Environment vars -> Overrides everything (happens at bind time)
  */
  static initialize() {
    if (this._initialized) {
      return;
    }
    this.map.reset();
    this._initialized = true;

    if (!AppEnv.test) {
      console.log(`Initializing: ${AppEnv.all.join(',')}`);
    }

    // Load all namespaces from core
    const allYaml = findAppFilesByExt('.yml');

    const files = allYaml.filter(x =>
      x.file.includes('node_modules/@travetto')
      && x.file.includes('/config/'))
      .concat(allYaml.filter(x => x.file.startsWith(`${process.cwd()}/config/`)))
      .map(x => ({ name: x.file, data: readFileSync(x.file).toString() }));

    for (const file of files) {
      const ns = path.basename(file.name, '.yml');
      yaml.safeLoadAll(file.data, doc => this.map.putAll({ [ns]: doc }));
    }

    // Handle environmental loads
    if (AppEnv.all.length) {
      const loaded: string[] = [];
      const envFiles = allYaml.filter(x => x.file.startsWith(`${process.cwd()}/env/`))
        .map(x => ({ name: x.file, data: readFileSync(x.file).toString() }))
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

    if (!process.env.QUIET_CONFIG && !AppEnv.test) {
      console.log('Configured', this.map.toJSON());
    }
  }
}