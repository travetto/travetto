import { Ready } from './ready';
import { ObjectUtil, bulkRequire } from '@encore/util';

let flatten = require('flat');
let unflatten = flatten.unflatten;

let NULL = 'NULL' + (Math.random() * 1000) + (new Date().getTime());

type ConfigMap = { [key: string]: string | number | boolean | null | ConfigMap };
let config: ConfigMap = {};
let namespaces: { [key: string]: boolean } = {};

function writeProperty(o: any, k: string, v: any) {
  if (typeof v === 'string') {
    if (typeof o[k] === 'boolean') {
      v = v === 'true';
    } else if (typeof o[k] === 'number') {
      v = v.indexOf('.') >= 0 ? parseFloat(v) : parseInt(v, 10);
    } else if (typeof o[k] !== 'string' && v === 'null') {
      v = NULL;
    }
  }
  o[k] = v;
}

function merge(target: ConfigMap, source: ConfigMap) {
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

    if (namespaces[ns]) {
      if (!keyMap[lk]) { keyMap[lk] = k; }
      writeProperty(lowerFlat, lk, sourceFlat[k]);
    }
  }

  // Return original case
  let out: ConfigMap = {};
  for (let k of Object.keys(lowerFlat)) {
    out[keyMap[k]] = lowerFlat[k];
  }
  ObjectUtil.merge(target, unflatten(out, { delimiter: '_' }));
}

export function registerNamespace<T extends ConfigMap>(ns: string, base: T): T {
  // Store ref
  namespaces[ns] = true;
  namespaces[ns.toLowerCase()] = true;

  // Nest object
  let obj: ConfigMap = {};
  obj[ns] = base;

  // merge
  merge(config, obj);

  // Get ref to config object
  config[ns] = config[ns] || {};
  return config[ns] as T;
}

function dropNulls(o: any) {
  if (ObjectUtil.isPlainObject(o)) {
    for (let k of Object.keys(o)) {
      if (o[k] === NULL) {
        delete o[k];
      } else {
        dropNulls(o[k]);
      }
    }
  } else if (Array.isArray(o)) {
    o = o.map(dropNulls).filter((x: any) => x !== NULL);
  }
  return o;
}

/*
  Order of specificity (least to most)
    - Local configs -> located in the source folder
    - External config file -> loaded from env/json
    - Environment vars -> Overrides everything
*/
export function configure(name: string) {
  console.log(`Initializing: ${name}`);

  // Load all namespaces from core
  bulkRequire('**/config.ts', process.cwd() + '/node_modules/@encore');

  // Load all namespaces from app
  bulkRequire('src/app/**/config.ts');

  try {
    // Load env config
    let data = require(`${process.cwd()}/src/env/${name}.json`) as ConfigMap;
    merge(config, data);
  } catch (e) {
    console.log(`No config found at ${process.cwd()}/src/env/${name}.json`);
  }

  // Handle process.env
  merge(config, process.env);

  // Drop out nulls
  dropNulls(config);

  Ready.onReady(() => {
    console.log(JSON.stringify(config, null, 2));
  });

  Ready.initialize();
}