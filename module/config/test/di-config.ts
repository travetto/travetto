import { Config } from '@travetto/config';
import { Inject, Injectable } from '@travetto/di';
import { Schema } from '@travetto/schema';

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
