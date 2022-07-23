import { AppError } from '@travetto/base';
import { ClassTarget } from './types';

function getName(symbol: symbol): string {
  return symbol.toString().split(/[()]/g)[1];
}

export class InjectionError extends AppError {
  constructor(message: string, target: ClassTarget, qualifiers?: symbol[]) {
    super(`${message}: [${target.ᚕid}]${qualifiers ? `[${qualifiers.map(getName)}]` : ''}`, 'notfound');
  }
}