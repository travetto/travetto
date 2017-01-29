import { ObjectUtil } from '@encore/util';
import { MongoService } from '@encore/mongo';
import { Startup } from '@encore/lifecycle';
import { SchemaRegistry, Cls } from '@encore/schema';
import { ModelOptions, IndexConfig } from '../service';

function createIndex<T extends Cls<any>>(target: T, config: IndexConfig) {
  let mconf = SchemaRegistry.getClassMetadata<any, ModelOptions>(target, 'model');
  if (!mconf.indicies) {
    mconf.indicies = [];
  }

  mconf.indicies.push(config);

  let fields: string[];
  let fieldMap: { [key: string]: number };
  if (!Array.isArray(config.fields)) {
    fields = Object.keys(config.fields);
    fieldMap = config.fields;
  } else {
    fields = config.fields;
    fieldMap = ObjectUtil.fromPairs(config.fields.map(x => [x, 1] as [string, number]));
  }

  if (!mconf.primaryUnique && config.options.unique) {
    mconf.primaryUnique = fields;
  }

  Startup.waitFor(MongoService.createIndex(target, fieldMap, config.options)
    .then((x: any) => console.debug(`Created ${config.options.unique ? 'unique' : ''} index ${config.fields}`)));

  return target;
}

export function Index(config: IndexConfig) {
  return function <T extends Cls<any>>(target: T) {
    return createIndex(target, config);
  };
}

export function Unique(...fields: string[]) {
  return function <T extends Cls<any>>(target: T) {
    return createIndex(target, { fields, options: { unique: true } });
  };
}