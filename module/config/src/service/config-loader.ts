import { bulkRead, AppInfo, bulkReadSync } from '@encore/base';
import * as flatten from 'flat';
import * as yaml from 'js-yaml';
import { EventEmitter } from 'events';
import * as _ from 'lodash';

let unflatten = flatten.unflatten;

type ConfigMap = { [key: string]: string | number | boolean | null | ConfigMap };

export class ConfigLoader {

  private static NULL = 'NULL' + (Math.random() * 1000) + (new Date().getTime());
  private static data: ConfigMap = {};
  private static _initialized: boolean = false;

  private static writeProperty(o: any, k: string, v: any) {
    if (typeof v === 'string') {
      if (typeof o[k] === 'boolean') {
        v = v === 'true';
      } else if (typeof o[k] === 'number') {
        v = v.indexOf('.') >= 0 ? parseFloat(v) : parseInt(v, 10);
      } else if (typeof o[k] !== 'string' && v === 'null') {
        v = this.NULL;
      } else if (k + '_0' in o) { // If array
        v.split(/,\s*/g).forEach((el, i) => {
          this.writeProperty(o, `${k}_${i}`, el);
        });
        return;
      }
    }
    o[k] = v;
  }

  private static merge(target: ConfigMap, source: ConfigMap, gentle = false) {
    let targetFlat = flatten(target, { delimiter: '_' }) as any;
    let sourceFlat = flatten(source, { delimiter: '_' }) as any;

    // Flatten to lower case
    let keyMap: { [key: string]: string } = {};
    let lowerFlat: ConfigMap = {};

    for (let k of Object.keys(targetFlat)) {
      let lk = k.toLowerCase();
      lowerFlat[lk] = targetFlat[k];

      // handle keys, and all substrings
      let end = k.length;
      while (end > 0) {
        let finalKey = lk.substring(0, end);
        if (keyMap[finalKey]) {
          break;
        } else {
          keyMap[finalKey] = k.substring(0, end);
          end = k.lastIndexOf('_', end);
        }
      }
    }

    for (let k of Object.keys(sourceFlat)) {
      let lk = k.toLowerCase();
      let ns = lk.split('_', 2)[0];

      if (!gentle || ns in target) {
        if (!keyMap[lk]) { keyMap[lk] = k; }
        this.writeProperty(lowerFlat, lk, sourceFlat[k]);
      }
    }

    // Return original case
    let out: ConfigMap = {};
    for (let k of Object.keys(lowerFlat)) {
      out[keyMap[k]] = lowerFlat[k];
    }
    _.merge(target, unflatten(out, { delimiter: '_' }));
  }

  private static dropNulls(o: any) {
    if (_.isPlainObject(o)) {
      for (let k of Object.keys(o)) {
        if (o[k] === this.NULL) {
          delete o[k];
        } else {
          this.dropNulls(o[k]);
        }
      }
    } else if (Array.isArray(o)) {
      o = o.map(this.dropNulls).filter((x: any) => x !== this.NULL);
    }
    return o;
  }

  static bindTo(obj: any, key: string) {
    let keys = key.split('.');
    let sub: any = this.data;
    while (keys.length && sub[keys[0]]) {
      sub = sub[keys.shift()!];
    }
    _.merge(obj, sub);
    return obj;
  }

  static get(key: string) {
    return this.bindTo({}, key);
  }

  /*
    Order of specificity (least to most)
      - Module configs -> located in the node_modules/@encore/config folder
      - Local configs -> located in the config folder
      - External config file -> loaded from env
      - Environment vars -> Overrides everything
  */
  static initialize() {
    if (this._initialized) {
      return;
    }
    this._initialized = true;

    let envs = AppInfo.ENV;
    console.log(`Initializing: ${envs.join(',')}`);

    // Load all namespaces from core
    let files = bulkReadSync('node_modules/@encore/*/config/*.yml');

    // Load all configs, exclude env configs
    files = files.concat(bulkReadSync('config/*.yml'));

    for (let file of files) {
      let ns = file.name.split('/').pop()!.split('.yml')[0];
      yaml.safeLoadAll(file.data, doc => {
        this.data[ns] = this.data[ns] || {};
        this.merge(this.data, { [ns]: doc });
      });
    }

    if (envs.length) {
      let loaded: string[] = [];
      let envFiles = bulkReadSync(`env/*.yml`, undefined, x => {
        let tested = x.split('/').pop()!.split('.yml')[0];
        let found = envs.indexOf(tested) >= 0;
        if (found) {
          loaded.push(tested);
        }
        return found;
      });

      console.log('Found configurations for', loaded);

      for (let file of envFiles) {
        yaml.safeLoadAll(file.data, doc => {
          this.merge(this.data, doc);
        });
      }
    }

    // Handle process.env
    this.merge(this.data, process.env as { [key: string]: any }, true);

    // Drop out nulls
    this.dropNulls(this.data);

    if (!process.env.QUIET_CONFIG) {
      console.log('Configured', this.data);
    }
  }
}


// Initializing
ConfigLoader.initialize();