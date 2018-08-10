import { InjectableFactory, Inject } from '@travetto/di';
import { ModelMongoConfig, ModelMongoSource } from '@travetto/model-mongo';
import { ModelSource, ModelService } from '@travetto/model';
import { AuthProvider } from '@travetto/auth-express';
import { QueryVerifierService } from '@travetto/model/src/service/query';
import { AuthModelService, RegisteredPrincipalConfig } from '@travetto/auth-model';
import { AuthModelProvider } from '@travetto/auth-model/extension/auth.express';

import { UserService } from '../../src/service/user';
import { User } from '../../src/model/user';

export const TEST = Symbol('TEST');

class Config {
  @InjectableFactory(TEST)
  static getModelSource(config: ModelMongoConfig): ModelSource {
    return new ModelMongoSource(config);
  }

  @InjectableFactory(TEST)
  static getModelSsvc(@Inject(TEST) src: ModelSource, qvs: QueryVerifierService): ModelService {
    return new ModelService(src, qvs);
  }

  @InjectableFactory()
  static getAuthModelService(@Inject(TEST) svc: ModelService): AuthModelService<User> {
    return new AuthModelService(svc,
      new RegisteredPrincipalConfig(User, {
        id: 'email',
        password: 'password',
        salt: 'salt',
        hash: 'hash',
        resetExpires: 'resetExpires',
        resetToken: 'resetToken',
        permissions: 'permissions'
      })
    );
  }

  @InjectableFactory(TEST)
  static getProvider(svc: AuthModelService<User>): AuthProvider<User> {
    return new AuthModelProvider(svc);
  }

  @InjectableFactory(TEST)
  static getUserSvc(@Inject(TEST) svc: ModelService, strat: AuthModelService<any>): UserService {
    const out = new UserService();
    out.model = svc;
    out.strategy = strat;
    return out;
  }
}
