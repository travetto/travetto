import { Config, ConfigLoader } from '../src';

class DbConfig {
  name: string;
  connection: string;
  hosts: string[];
}

class TestConfig extends DbConfig {

}

const conf = new TestConfig();

ConfigLoader.bindTo(conf, 'db.mysql');

if (conf.name !== 'Oscar') {
  throw new Error('Should match!');
}