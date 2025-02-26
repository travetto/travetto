import { AppError } from '@travetto/runtime';
import { ClassTarget } from './types.ts';

function getName(symbol: symbol): string {
  return symbol.toString().split(/[()]/g)[1];
}

export class InjectionError extends AppError {
  constructor(message: string, target: ClassTarget, qualifiers?: symbol[]) {
    super(`${message}: [${target.Ⲑid}]${qualifiers ? `[${qualifiers.map(getName)}]` : ''}`, {
      category: 'notfound',
      details: {
        qualifiers: qualifiers?.map(getName),
        target: target.Ⲑid
      }
    });
  }
}