import { Injectable } from '../src/decorator';
import { Util } from './util';

@Injectable({ name: 'a' })
export class DbConfig {
  constructor() {
    console.log('Creating dbconfig');
  }

  getUrl() {
    Util.work2();
    return 'mongodb://ssdtz';
  }
}