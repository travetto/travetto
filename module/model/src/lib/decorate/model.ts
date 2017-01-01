import * as mongoose from 'mongoose';
import { ModelCls, SchemaRegistry } from '../service/registry';
import { SortOptions } from '@encore/mongo';

export function Discriminate(key: string) {
  return (target: any) => {
    const parent = Object.getPrototypeOf(target) as ModelCls<any>;
    const parentConfig = SchemaRegistry.getModelConfig(parent);
    SchemaRegistry.registerModelFacet(target, {
      collection: parentConfig.collection,
      discriminator: key
    });

    // Register parent
    let parentConf = SchemaRegistry.getModelConfig(parent);
    parentConf.discriminated = parentConf.discriminated || {};
    parentConf.discriminated[key] = target;

    return target;
  };
}

export function DefaultSort(sort: SortOptions) {
  return (target: any) => SchemaRegistry.registerModelFacet(target, { defaultSort: sort });
}

export function Model(opts: mongoose.SchemaOptions = {}) {
  return (target: any) => SchemaRegistry.registerModel<any>(target, opts);
}