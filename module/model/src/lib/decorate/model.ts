import { SchemaRegistry, Cls } from '@encore/schema';
import { SortOptions } from '@encore/mongo';
import { ModelOptions } from '../service';

export function DefaultSort(sort: SortOptions) {
  return (target: Cls<any>) => SchemaRegistry.registerClassMetadata(target, 'model', {
    defaultSort: sort
  });
}

export function SubType(key: string) {
  return (target: Cls<any>) => {
    const parent = Object.getPrototypeOf(target) as Cls<any>;
    (target as any).collection = (parent as any).collection;

    SchemaRegistry.registerClassMetadata(target, 'model', {
      discriminator: key
    });

    // Register parent
    let parentConf = SchemaRegistry.getClassMetadata<any, ModelOptions>(parent, 'model');
    parentConf.subtypes = parentConf.subtypes || {};
    parentConf.subtypes[key] = target;

    return target;
  };
}

export function Model(collection?: string) {
  return (target: any) => {
    target.collection = collection || target.name;
    return target;
  };
}