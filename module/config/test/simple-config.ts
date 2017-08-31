import { Config, ConfigLoader } from '../src';
import { Inject, Registry, Injectable } from '@encore/di';

class DbConfig {
  name: string;
  connection: string;
  hosts: string[];
}

@Config('db.mysql', DbConfig, 'db')
class TestConfig extends DbConfig {

}

@Injectable()
class TestService {
  @Inject('db') config: DbConfig;

  postConstruct() {
    console.log('Done!', this.config);
  }
}

ConfigLoader.initialize('test')
  .then(x => Registry.getInstance(TestService))
  .then(ins => {
    console.log('Instance', ins);
  })
  .catch(err => {
    console.error(err);
  });