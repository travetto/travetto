import { Field } from './field';
import { ClsList } from '../index';

export function AutoSchema(type: any): PropertyDecorator
export function AutoSchema(): ClassDecorator
export function AutoSchema(type?: ClsList) {
  if (type) {
    return Field(type);
  } else {
    return (target: any) => target
  }
}