import * as mongoose from "mongoose";
import { Cls, ModelCls, getModelConfig, registerModel, registerModelFacet } from '../service/registry';
import { SortOptions } from '@encore/mongo';

export function Discriminate(key: string) {
  return (target: any) => {
    const parent = Object.getPrototypeOf(target) as ModelCls<any>;
    const parentConfig = getModelConfig(parent);
    registerModelFacet(target, {
      collection: parentConfig.collection,
      discriminator: key
    });

    //Register parent
    let parentConf = getModelConfig(parent);
    parentConf.discriminated = parentConf.discriminated || {};
    parentConf.discriminated[key] = target;

    return target;
  };
}

export function getDiscriminator(cls: any): string | undefined {
  return getModelConfig(cls).discriminator;
}

export function DefaultSort(sort: SortOptions) {
  return (target: any) => registerModelFacet(target, { defaultSort: sort })
}

export function getDefaultSort(cls: any): Object | undefined {
  return getModelConfig(cls).defaultSort;
}

export function Model(opts: mongoose.SchemaOptions = {}) {
  return (target: any) => registerModel(target, opts);
}