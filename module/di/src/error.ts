import { RuntimeError, type Class } from '@travetto/runtime';

function getName(symbol: symbol): string {
  return symbol.toString().split(/[()]/g)[1];
}

export class InjectionError extends RuntimeError {
  constructor(message: string, target: Class, qualifiers?: symbol[]) {
    super(`${message}: [${target.Ⲑid}]${qualifiers ? `[${qualifiers.map(getName)}]` : ''}`, {
      category: 'notfound',
      details: {
        qualifiers: qualifiers?.map(getName),
        target: target.Ⲑid
      }
    });
  }
}