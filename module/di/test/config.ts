import { Injectable } from '../src/decorator';
import { Util } from './util';
import { Config } from '@travetto/config';

@Config('a')
export class DbConfig<A, B> {
  constructor() {
    console.log('Creating dbconfigs');
  }

  getUrl() {
    Util.work3();
    return 'mongodb://oscar';
  }
}

export class AltConfig {

}