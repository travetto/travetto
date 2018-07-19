import * as path from 'path';
import * as yaml from 'js-yaml';
import { readFileSync } from 'fs';

import { Env, ScanApp } from '@travetto/base';
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
      - Module configs -> located in the node_modules/@travetto/<*>/config folder
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

    if (!Env.test) {
      console.info(`Initializing: ${Env.profiles.join(',')}`);
    }

    // Load all namespaces from core
    const files = ScanApp.findFiles('.yml',
      x => /config\/[^/]+.yml$/.test(x))
      .map(x => ({ name: x.file, data: readFileSync(x.file).toString() }));

    for (const file of files) {
      const ns = path.basename(file.name, '.yml');
      yaml.safeLoadAll(file.data, doc => this.map.putAll({ [ns]: doc }));
    }

    // Handle environmental loads
    if (Env.profiles.length) {
      const envFiles = ScanApp.findFiles('.yml', x => x.startsWith('profile/'))
        .map(x => ({ name: x.file, data: readFileSync(x.file).toString() }))
        .map(x => {
          const tested = path.basename(x.name, '.yml');
          const found = Env.is(tested);
          return { name: tested, found, data: x.data };
        })
        .filter(x => x.found);

      console.debug('Found configurations for', envFiles.map(x => x.name));

      for (const file of envFiles) {
        yaml.safeLoadAll(file.data, doc => this.map.putAll(doc));
      }
    }

    if (!process.env.QUIET_CONFIG && !Env.test) {
      console.info('Configured', this.map.toJSON());
    }
  }
}