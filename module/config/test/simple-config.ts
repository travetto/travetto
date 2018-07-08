import { Config, ConfigLoader } from '../src';
import * as assert from 'assert';

class DbConfig {
  name: string;
  connection: string;
  hosts: string[];
}

class TestConfig extends DbConfig {

}

const conf = new TestConfig();

ConfigLoader.bindTo(conf, 'db.mysql');

assert(conf.name === 'Oscar');

process.env.DB_MYSQL_NAME = 'Roger';

delete (ConfigLoader as any)['_initialized'];
ConfigLoader.initialize();

ConfigLoader.bindTo(conf, 'db.mysql');

assert(conf.name === 'Roger');