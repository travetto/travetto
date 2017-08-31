import { ObjectUtil } from '@encore/util';
import { bulkRead } from '@encore/base';
import * as flatten from 'flat';
import * as yaml from 'js-yaml';

let unflatten = flatten.unflatten;

type ConfigMap = { [key: string]: string | number | boolean | null | ConfigMap };

export class ConfigLoader {

  private static NULL = 'NULL' + (Math.random() * 1000) + (new Date().getTime());
  private static data: ConfigMap = {};
  private static namespaces: { [key: string]: boolean } = {};
  private static initialized: boolean = false;

  private static writeProperty(o: any, k: string, v: any) {
    if (typeof v === 'string') {
      if (typeof o[k] === 'boolean') {
        v = v === 'true';
      } else if (typeof o[k] === 'number') {
        v = v.indexOf('.') >= 0 ? parseFloat(v) : parseInt(v, 10);
      } else if (typeof o[k] !== 'string' && v === 'null') {
        v = this.NULL;
      }
    }
    o[k] = v;
  }

  private static merge(target: ConfigMap, source: ConfigMap) {
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

      if (this.namespaces[ns]) {
        if (!keyMap[lk]) { keyMap[lk] = k; }
        this.writeProperty(lowerFlat, lk, sourceFlat[k]);
      }
    }

    // Return original case
    let out: ConfigMap = {};
    for (let k of Object.keys(lowerFlat)) {
      out[keyMap[k]] = lowerFlat[k];
    }
    ObjectUtil.merge(target, unflatten(out, { delimiter: '_' }));
  }

  static registerNamespace<T extends ConfigMap>(base: T) {
    const ns = base['namespace'] as string;

    // Store ref
    this.namespaces[ns] = true;
    this.namespaces[ns.toLowerCase()] = true;

    // Nest object
    let obj: ConfigMap = {};
    obj[ns] = base;

    // merge
    this.merge(this.data, obj);

    // Get ref to config object
    this.data[ns] = this.data[ns] || {};
  }

  private static dropNulls(o: any) {
    if (ObjectUtil.isPlainObject(o)) {
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

  static bindTo(obj: any, ns: string) {
    ObjectUtil.merge(obj, this.data[ns]);
  }

  /*
    Order of specificity (least to most)
      - Local configs -> located in the source folder
      - External config file -> loaded from env/json
      - Environment vars -> Overrides everything
  */
  static async initialize(...envs: string[]) {
    console.log(`Initializing: ${envs.join(',')}`);

    // Load all namespaces from core
    let files = await bulkRead('/node_modules/@encore**/config.yaml');

    // Load all namespaces from app
    files = files.concat(await bulkRead('src/**/config.yaml'));

    for (let file of files) {
      let obj = yaml.safeLoad(file.data);
      this.registerNamespace(obj);
    }

    files = await bulkRead(`src/env/{${envs.join(',')}}.yaml`)
    let loaded = [];
    for (let file of files) {
      let obj = yaml.safeLoad(file.data);
      this.merge(this.data, obj.data);
      loaded.push(file.name.split('/').pop()!.split('.yaml')[0]);
    }

    console.log('Found configurations for', loaded);

    // Handle process.env
    this.merge(this.data, process.env as { [key: string]: any });

    // Drop out nulls
    this.dropNulls(this.data);

    this.initialized = true;
  }

  static log() {
    console.log('Configured', this.data);
  }
}