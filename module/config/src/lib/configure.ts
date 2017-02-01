import { ObjectUtil, bulkRequire } from '@encore/util';

let flatten = require('flat');
let unflatten = flatten.unflatten;

type ConfigMap = { [key: string]: string | number | boolean | null | ConfigMap };
interface Finalizer<T> {
  namespace: string;
  handler: (config: T) => any;
}

export class Configure {

  private static NULL = 'NULL' + (Math.random() * 1000) + (new Date().getTime());
  private static data: ConfigMap = {};
  private static namespaces: { [key: string]: boolean } = {};
  private static initialized: boolean = false;
  private static finalizers: Finalizer<any>[] = [];

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

  static registerNamespace<T extends ConfigMap>(ns: string, base: T, finalizer?: (conf: T) => any): T {
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

    if (finalizer) {
      Configure.finalizers.push({ namespace: ns, handler: finalizer });
    }

    return new Proxy<T>(Configure.data[ns] as T, {
      has(target: T, p: PropertyKey): boolean {
        if (!Configure.initialized) {
          throw new Error('Configuration is not initialized');
        }
        return p in target;
      },
      get(target: T, p: PropertyKey, receiver: any): any {
        if (!Configure.initialized) {
          throw new Error('Configuration is not initialized');
        }
        return target[p];
      },
      set(target: T, p: PropertyKey, value: any, receiver: any): boolean {
        if (!Configure.initialized) {
          throw new Error('Configuration is not initialized');
        }
        target[p] = value;
        return true;
      },
    });
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
  static initialize(...envs: string[]) {
    console.log(`Initializing: ${envs.join(',')}`);

    // Load all namespaces from core
    bulkRequire('**/config.ts', process.cwd() + '/node_modules/@encore');

    // Load all namespaces from app
    bulkRequire('src/app/**/config.ts');

    // Load all namespaces from lib
    bulkRequire('src/lib/**/config.ts');

    for (let env of envs) {
      try {
        // Load env config
        let data = require(`${process.cwd()}/src/env/${env}.json`) as ConfigMap;
        Configure.merge(Configure.data, data);
      } catch (e) {
        console.log(`No config found at ${process.cwd()}/src/env/${env}.json`);
      }
    }

    // Handle process.env
    Configure.merge(Configure.data, process.env);

    // Drop out nulls
    Configure.dropNulls(Configure.data);

    // Post process once all config sources are loaded
    for (let finalizer of Configure.finalizers) {
      finalizer.handler(Configure.data[finalizer.namespace]);
    }

    Configure.initialized = true;
  }

  static log() {
    console.log('Configured', Configure.data);
  }
}