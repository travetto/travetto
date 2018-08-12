import { InjectableFactory, Inject, Application } from '@travetto/di';
import { ModelMongoSource, ModelMongoConfig } from '@travetto/model-mongo';
import { ModelSource, ModelService } from '@travetto/model';
import { AuthModelProvider } from '@travetto/auth-model/extension/auth.express';
import { AuthModelService, RegisteredPrincipalConfig } from '@travetto/auth-model';
import { QueryVerifierService } from '@travetto/model/src/service/query';
import { AssetSource } from '@travetto/asset';
import { AssetMongoConfig, AssetMongoSource } from '@travetto/asset-mongo';
import { AuthProvider } from '@travetto/auth-express';
import { ExpressApp } from '@travetto/express';
import { AuthPassportOperator } from '@travetto/auth-express/extension/passport';
import { ContextOperator } from '@travetto/express/extension/context';

import { AuthMongo, AUTH } from './config';
import { User } from './model/user';

@Application('sample')
export class SampleApp {

  @InjectableFactory()
  static getAssetSource(config: AssetMongoConfig): AssetSource {
    return new AssetMongoSource(config);
  }

  @InjectableFactory(AUTH)
  static getModelSource(conf: AuthMongo): ModelSource {
    return new ModelMongoSource(conf);
  }

  @InjectableFactory()
  static getAuthModelService(@Inject(AUTH) src: ModelSource, qsvc: QueryVerifierService): AuthModelService<User> {
    return new AuthModelService(
      new ModelService(src, qsvc),
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

  @InjectableFactory(AUTH)
  static getProvider(svc: AuthModelService<User>): AuthProvider<User> {
    return new AuthModelProvider(svc);
  }

  @InjectableFactory()
  static getSource(config: ModelMongoConfig): ModelSource {
    return new ModelMongoSource(config);
  }

  @Inject()
  private contextOp: ContextOperator;

  @Inject()
  private express: ExpressApp;

  run() {
    this.express.run();
  }
}