import { Config, ConfigLoader } from '../src';

class DbConfig {
  name: string;
  connection: string;
  hosts: string[];
}

@Config('db.mysql', DbConfig, 'db')
class TestConfig extends DbConfig {

}