import { Context } from '../lib/context';
import { beforeTest, afterTest } from '@encore/test';

let store: { [key: string]: any } = {};

Context.storage = {
  get: (key: string) => store[key],
  set: (key: string, val: any) => store[key] = val
};

let ctx = {};

beforeTest(() => Context.set(Object.assign({}, ctx)));
afterTest(() => Context.clear());

export function setDefault(obj: any) {
  Object.assign(ctx, obj);
}