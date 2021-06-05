import { Config } from '@travetto/config';
import { Schema } from '@travetto/schema';

import { Injectable, Inject } from '../src/decorator';
import { Util } from './util';

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
    console.log('Creating dbconfigs');
  }

  getUrl() {
    Util.work3();
    return 'mongodb://oscar';
  }
}

export class AltConfig {

}