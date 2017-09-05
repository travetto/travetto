import { ObjectUtil } from '@encore/util';
import { SchemaRegistry, Class } from '@encore/schema';
import { ModelOptions, IndexConfig } from '../service';

function createIndex<T extends Class>(target: T, config: IndexConfig) {
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

  MongoService.registerIndex(target, fieldMap, config.options);

  return target;
}

export function Index(config: IndexConfig) {
  return function <T extends Class>(target: T) {
    return createIndex(target, config);
  };
}

export function Unique(...fields: string[]) {
  return function <T extends Class>(target: T) {
    return createIndex(target, { fields, options: { unique: true } });
  };
}