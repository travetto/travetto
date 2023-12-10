import { Config, EnvVar } from '../src/decorator';

@Config('name')
export class NameConfig {
  @EnvVar('NAME_ACTIVE')
  active = false;
}

@Config('db.mysql')
export class TestConfig {
  @EnvVar('DB_ANON_HOSTS')
  anonHosts = ['a', 'b'];
  @EnvVar('DB_MYSQL_NAME')
  name: string;
  connection: string;
  hosts: string[];
}
