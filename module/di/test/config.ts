import { Injectable } from '../src/decorator';
import { Util } from './util';

@Injectable({ name: 'a' })
export class DbConfig {
  constructor() {
    console.log('Creating dbconfig');
  }

  getUrl() {
    Util.work3();
    return 'mongodb://ssdtz';
  }
}

export class AltConfig {

}