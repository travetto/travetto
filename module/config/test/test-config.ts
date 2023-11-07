import { InjectableFactory } from '@travetto/di';

import { ConfigSource } from '../src/source/types';
import { FileConfigSource } from '../src/source/file';
import { ParserManager } from '../src/parser/parser';

class Config {
  @InjectableFactory()
  static getConfig(parser: ParserManager): ConfigSource {
    return new FileConfigSource(parser, ['@#test/fixtures']);
  }
}