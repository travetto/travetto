import { Field } from './field';
import { ClsList } from '../index';

export function AutoSchema(type: ClsList): PropertyDecorator
export function AutoSchema(): ClassDecorator
export function AutoSchema(type?: ClsList) {
  if (type) {
    return Field(type);
  } else {
    return (target: any) => target
  }
}
export function Ignore(): PropertyDecorator {
  return (target: any, property: string) => { }
}