import { SchemaRegistry, Cls } from '@encore/schema';
import { SortOptions } from '@encore/mongo';
import { ModelOptions } from '../service';

export function DefaultSort(sort: SortOptions) {
  return function <T extends Cls<any>>(target: T) {
    return SchemaRegistry.registerClassMetadata(target, 'model', {
      defaultSort: sort
    });
  };
}

export function Subtype(key: string) {
  return function <T extends Cls<any>>(target: T) {
    const parent = SchemaRegistry.getParent(target) as Cls<any>;
    (target as any).collection = (parent as any).collection || (parent as any).name;

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

export function Collection(collection: string) {
  return function <T extends Cls<any>>(target: T) {
    (target as any).collection = collection;
    return target;
  };
}