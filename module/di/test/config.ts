import { Injectable, Inject } from '../src/decorator';
import { Util } from './util';
import { Config } from '@travetto/config';

@Injectable()
export class Empty {
  public age = 10;
}

class Basic {
  @Inject()
  public empty: Empty;
}

@Config('a')
export class DbConfig<A, B> extends Basic {
  public temp: any;

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