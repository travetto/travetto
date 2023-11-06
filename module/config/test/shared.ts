import { InjectableFactory } from '@travetto/di';

import { Config, EnvVar } from '../src/decorator';
import { FileConfigSource } from '../src/source/file';
import { ConfigSource } from '../src/source/types';
import { ParserManager } from '../src/parser/parser';

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

export class Setup {
  @InjectableFactory()
  static getConfig(parser: ParserManager): ConfigSource {
    return new FileConfigSource(parser, 'application', 100, ['@#test/fixtures']);
  }
}

