import { Injectable } from '../src/decorator';
import { Util } from './util';
import { Config } from '@encore2/config';

@Config('a')
export class DbConfig {
  constructor() {
    console.log('Creating dbconfigs');
  }

  getUrl() {
    Util.work3();
    return 'mongodb://eorange';
  }
}

export class AltConfig {

}