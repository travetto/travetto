import { Field } from './field';
import { SchemaRegistry } from '../service';

export function Schema(auto: boolean = true): ClassDecorator {
  return (target: any) => {
    SchemaRegistry.registerClass(target, {});
  };
}