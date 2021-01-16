import { Config } from '@travetto/config';

import { Injectable, Inject } from '../src/decorator';
import { Util } from './util';

@Injectable()
export class Empty {
  age = 10;
}

class Basic {
  @Inject()
  empty: Empty;
}

@Config('a')
export class DbConfig<A, B> extends Basic {
  temp: unknown;

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