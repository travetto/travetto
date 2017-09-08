import { Field } from './field';
import { ClassList, SchemaRegistry } from '../service';

export function Schema(auto: boolean = true): ClassDecorator {
  return (target: any) => {
    console.log('Schema', target.__id);
    SchemaRegistry.registerClass(target, {});
  };
}