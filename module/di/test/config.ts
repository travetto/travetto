import { Injectable, Inject } from '@travetto/di';
import { Util } from './util.ts';

@Injectable()
export class Empty {
  age = 10;
}

@Injectable()
export class DbConfig {
  temp?: unknown;

  @Inject()
  empty: Empty;

  constructor() {
    console.log('Creating db configs');
  }

  getUrl() {
    Util.work3();
    return 'mongodb://oscar';
  }
}

export class AltConfig {

}