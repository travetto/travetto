import { Inject, Registry, Injectable } from '@encore/di';
import { Context } from '../index';
import { bulkRequire } from '@encore/base';

bulkRequire('src/**/*.ts');

@Injectable()
class TestService {
  @Inject() context: Context;

  postConstruct() {
    console.log('Context Found', this.context);
  }
}

Registry.getInstance(TestService)
  .then(ins => {
    console.log('Instance', ins);
  })
  .catch(err => {
    console.error(err);
  });