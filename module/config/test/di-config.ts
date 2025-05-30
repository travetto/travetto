import { Config } from '@travetto/config';
import { Schema } from '@travetto/schema';
import { Injectable, Inject } from '@travetto/di';

export const CustomEmptySymbol = Symbol.for('CUSTOM_EMPTY');

@Injectable()
export class Empty {
  age = 10;
}

@Schema()
class Basic {
  @Inject()
  empty: Empty;
}

@Config('a')
export class DbConfig<A, B> extends Basic {
  temp?: unknown;

  constructor() {
    super();
    console.log('Creating db configs');
  }

  getUrl() {
    console.log('work3');
    return 'mongodb://oscar';
  }
}