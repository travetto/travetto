import { MongoService } from '@encore/mongo';
import { Ready } from '@encore/init';
import { getModelConfig, IndexConfig } from '../service/registry';

function createIndex(target: any, config: IndexConfig) {
  getModelConfig(target).indices.push(config);

  Ready.waitFor(MongoService.createIndex(target, config)
    .then((x: any) => console.log(`Created ${config.unique ? 'unique' : ''} index ${config}`)))

  return target;
}

export function Index(config: IndexConfig) {
  return (target: any) => createIndex(target, config)
}

export function Unique(...fields: string[]) {
  return (target: any) => createIndex(target, { fields, unique: true })
}