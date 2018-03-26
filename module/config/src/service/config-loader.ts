import { bulkRead, bulkReadSync, AppEnv } from '@travetto/base';
import * as flatten from 'flat';
import * as yaml from 'js-yaml';
import { EventEmitter } from 'events';
import * as _ from 'lodash';

const unflatten = flatten.unflatten;

type ConfigMap = { [key: string]: string | number | boolean | null | ConfigMap };

export class ConfigLoader {

  private static NULL = Symbol('NULL');
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
      } else if (`${k}_0` in o) { // If array
        v.split(/,\s*/g).forEach((el, i) => {
          this.writeProperty(o, `${k}_${i}`, el);
        });
        return;
      }
    }
    o[k] = v;
  }

  private static merge(target: ConfigMap, source: ConfigMap, gentle = false) {
    const targetFlat = flatten(target, { delimiter: '_' }) as any;
    const sourceFlat = flatten(source, { delimiter: '_' }) as any;

    // Flatten to lower case
    const keyMap: { [key: string]: string } = {};
    const lowerFlat: ConfigMap = {};

    for (const k of Object.keys(targetFlat)) {
      const lk = k.toLowerCase();
      lowerFlat[lk] = targetFlat[k];

      // handle keys, and all substrings
      let end = k.length;
      while (end > 0) {
        const finalKey = lk.substring(0, end);
        if (keyMap[finalKey]) {
          break;
        } else {
          keyMap[finalKey] = k.substring(0, end);
          end = k.lastIndexOf('_', end);
        }
      }
    }

    for (const k of Object.keys(sourceFlat)) {
      const lk = k.toLowerCase();
      const ns = lk.split('_', 2)[0];

      if (!gentle || ns in target) {
        if (!keyMap[lk]) { keyMap[lk] = k; }
        this.writeProperty(lowerFlat, lk, sourceFlat[k]);
      }
    }

    // Return original case
    const out: ConfigMap = {};
    for (const k of Object.keys(lowerFlat)) {
      out[keyMap[k]] = lowerFlat[k];
    }
    _.merge(target, unflatten(out, { delimiter: '_' }));
  }

  private static dropNulls(o: any) {
    if (_.isPlainObject(o)) {
      for (const k of Object.keys(o)) {
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
    const keys = key.split('.');
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
    let files = bulkReadSync('node_modules/@travetto/*/config/*.yml');

    // Load all configs, exclude env configs
    files = files.concat(bulkReadSync('config/*.yml'));

    for (const file of files) {
      const ns = file.name.split('/').pop()!.split('.yml')[0];
      yaml.safeLoadAll(file.data, doc => {
        this.data[ns] = this.data[ns] || {};
        this.merge(this.data, { [ns]: doc });
      });
    }

    if (AppEnv.all.length) {
      const loaded: string[] = [];
      const envFiles = bulkReadSync(`env/*.yml`, undefined, x => {
        const tested = x.split('/').pop()!.split('.yml')[0];
        const found = AppEnv.is(tested)
        if (found) {
          loaded.push(tested);
        }
        return !found;
      });

      console.debug('Found configurations for', loaded);

      for (const file of envFiles) {
        yaml.safeLoadAll(file.data, doc => {
          this.merge(this.data, doc);
        });
      }
    }

    // Handle process.env
    this.merge(this.data, process.env as { [key: string]: any }, true);

    // Drop out nulls
    this.dropNulls(this.data);

    if (!process.env.QUIET_CONFIG && !AppEnv.test) {
      console.log('Configured', JSON.stringify(this.data, null, 2));
    }
  }
}