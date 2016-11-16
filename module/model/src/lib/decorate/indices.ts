import { MongoService } from '@encore/mongo';
import { Ready } from '@encore/init';

export function Index(config: { fields: string[], unique?: boolean, sparse?: boolean }) {
  return (a: any) => {
    Ready.waitFor(MongoService.createIndex(a, config)
      .then((x: any) => console.log(`Created index ${config}`)))
    return a;
  }
}

export function Unique(...fields: string[]) {
  return (target: any) => {
    target.unique = target.unique || [];
    target.unique.push(fields);
    Ready.waitFor(MongoService.createIndex(target, { fields, unique: true })
      .then((x: any) => console.log(`Created unique index ${fields}`)))
    return target;
  }
}