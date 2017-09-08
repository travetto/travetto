import { Injectable } from '../src/decorator';
import { Util } from './util';
import { Config } from '@encore2/config';

@Config('a')
export class DbConfig {
  constructor() {
    console.log('Creating dbconfig');
  }

  getUrl() {
    Util.work3();
    return 'mongodb://test2test';
  }
}

export class AltConfig {

}