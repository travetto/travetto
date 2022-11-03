import { InjectableFactory } from '@travetto/di';
import { ModelAuthService, RegisteredPrincipal } from '@travetto/auth-model';
import { ModelCrudSupport } from '@travetto/model';

import { User } from './model';

class AuthConfig {
  @InjectableFactory()
  static getModelAuthService(svc: ModelCrudSupport) {
    return new ModelAuthService(
      svc,
      User,
      (u: User) => ({    // This converts User to a RegisteredPrincipal
        source: 'model',
        provider: 'model',
        id: u.id,
        permissions: u.permissions,
        hash: u.hash,
        salt: u.salt,
        resetToken: u.resetToken,
        resetExpires: u.resetExpires,
        password: u.password,
        details: u,
      }),
      (u: Partial<RegisteredPrincipal>) => User.from(({   // This converts a RegisteredPrincipal to a User
        id: u.id,
        permissions: [...(u.permissions || [])],
        hash: u.hash,
        salt: u.salt,
        resetToken: u.resetToken,
        resetExpires: u.resetExpires,
      })
      )
    );
  }
}