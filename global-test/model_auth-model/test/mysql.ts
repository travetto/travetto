import { InjectableFactory } from '@travetto/di';
import { MysqlModelConfig, MysqlModelService } from '@travetto/model-mysql';
import { Suite } from '@travetto/test';

import { AuthModelServiceSuite, TestModelSvcSymbol } from '@travetto/auth-model/support/test/model.ts';
import { WithSuiteContext } from '@travetto/context/support/test/context.ts';

class Config {
  @InjectableFactory(TestModelSvcSymbol)
  static modelProvider(svc: MysqlModelService) {
    return svc;
  }
}

@WithSuiteContext()
@Suite()
class MySQLAuthModelServiceSuite extends AuthModelServiceSuite<MysqlModelService> {
  serviceClass = MysqlModelService;
  configClass = MysqlModelConfig;
}
