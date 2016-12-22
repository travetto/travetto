import { Ready } from './ready';
import { ObjectUtil, bulkRequire } from '@encore/util';

let flatten = require('flat');
let unflatten = flatten.unflatten;

type ConfigMap = { [key: string]: string | number | boolean | null | ConfigMap };

export class Configure {

  private static NULL = 'NULL' + (Math.random() * 1000) + (new Date().getTime());
  private static data: ConfigMap = {};
  private static namespaces: { [key: string]: boolean } = {};

  private static writeProperty(o: any, k: string, v: any) {
    if (typeof v === 'string') {
      if (typeof o[k] === 'boolean') {
        v = v === 'true';
      } else if (typeof o[k] === 'number') {
        v = v.indexOf('.') >= 0 ? parseFloat(v) : parseInt(v, 10);
      } else if (typeof o[k] !== 'string' && v === 'null') {
        v = Configure.NULL;
      }
    }
    o[k] = v;
  }

  private static merge(target: ConfigMap, source: ConfigMap) {
    let targetFlat = flatten(target, { delimiter: '_' });
    let sourceFlat = flatten(source, { delimiter: '_' });

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

      if (Configure.namespaces[ns]) {
        if (!keyMap[lk]) { keyMap[lk] = k; }
        Configure.writeProperty(lowerFlat, lk, sourceFlat[k]);
      }
    }

    // Return original case
    let out: ConfigMap = {};
    for (let k of Object.keys(lowerFlat)) {
      out[keyMap[k]] = lowerFlat[k];
    }
    ObjectUtil.merge(target, unflatten(out, { delimiter: '_' }));
  }

  static registerNamespace<T extends ConfigMap>(ns: string, base: T): T {
    // Store ref
    Configure.namespaces[ns] = true;
    Configure.namespaces[ns.toLowerCase()] = true;

    // Nest object
    let obj: ConfigMap = {};
    obj[ns] = base;

    // merge
    Configure.merge(Configure.data, obj);

    // Get ref to config object
    Configure.data[ns] = Configure.data[ns] || {};
    return Configure.data[ns] as T;
  }

  private static dropNulls(o: any) {
    if (ObjectUtil.isPlainObject(o)) {
      for (let k of Object.keys(o)) {
        if (o[k] === Configure.NULL) {
          delete o[k];
        } else {
          Configure.dropNulls(o[k]);
        }
      }
    } else if (Array.isArray(o)) {
      o = o.map(Configure.dropNulls).filter((x: any) => x !== Configure.NULL);
    }
    return o;
  }

  /*
    Order of specificity (least to most)
      - Local configs -> located in the source folder
      - External config file -> loaded from env/json
      - Environment vars -> Overrides everything
  */
  static initialize(env: string) {
    console.log(`Initializing: ${env}`);

    // Load all namespaces from core
    bulkRequire('**/config.ts', process.cwd() + '/node_modules/@encore');

    // Load all namespaces from app
    bulkRequire('src/app/**/config.ts');

    // Load all namespaces from lib
    bulkRequire('src/lib/**/config.ts');

    try {
      // Load env config
      let data = require(`${process.cwd()}/src/env/${env}.json`) as ConfigMap;
      Configure.merge(Configure.data, data);
    } catch (e) {
      console.log(`No config found at ${process.cwd()}/src/env/${env}.json`);
    }

    // Handle process.env
    Configure.merge(Configure.data, process.env);

    // Drop out nulls
    Configure.dropNulls(Configure.data);

    Ready.onReady(() => {
      console.log(JSON.stringify(Configure.data, null, 2));
    });

    Ready.initialize();
  }
}