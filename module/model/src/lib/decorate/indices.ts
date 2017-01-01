import { ObjectUtil } from '@encore/util';
import { MongoService } from '@encore/mongo';
import { Startup } from '@encore/lifecycle';
import { ModelRegistry, IndexConfig } from '../service/registry';

function createIndex(target: any, config: IndexConfig) {
  let mconf = ModelRegistry.getModelConfig(target);
  mconf.indices.push(config);

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
  return (target: any) => createIndex(target, config);
}

export function Unique(...fields: string[]) {
  return (target: any) => createIndex(target, { fields, options: { unique: true } })
}