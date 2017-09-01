import { Field } from './field';
import { ClsList } from '../index';

export function AutoSchema(type: ClsList, config?: { [key: string]: any }): PropertyDecorator
export function AutoSchema(): ClassDecorator
export function AutoSchema(type?: ClsList, config?: { [key: string]: any }) {
  if (type) {
    return Field(type, config);
  } else {
    return (target: any) => target
  }
}
export function Ignore(): PropertyDecorator {
  return (target: any, property: string) => { }
}