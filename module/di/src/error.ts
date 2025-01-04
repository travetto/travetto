import { AppError, getUniqueId } from '@travetto/runtime';
import { ClassTarget } from './types';

function getName(symbol: symbol): string {
  return symbol.toString().split(/[()]/g)[1];
}

export class InjectionError extends AppError {
  constructor(message: string, target: ClassTarget, qualifiers?: symbol[]) {
    const targetClassId = getUniqueId(target);
    super(`${message}: [${targetClassId}]${qualifiers ? `[${qualifiers.map(getName)}]` : ''}`, {
      category: 'notfound',
      details: {
        qualifiers: qualifiers?.map(getName),
        target: targetClassId
      }
    });
  }
}