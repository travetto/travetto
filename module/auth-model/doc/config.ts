import { InjectableFactory } from '@travetto/di';
import { ModelAuthService } from '@travetto/auth-model';
import type { ModelCrudSupport } from '@travetto/model';

import { User } from './model.ts';

class AuthConfig {
  @InjectableFactory()
  static getModelAuthService(service: ModelCrudSupport) {
    return new ModelAuthService(
      service,
      User,
      user => ({    // This converts User to a RegisteredPrincipal
        source: 'model',
        provider: 'model',
        id: user.id!,
        permissions: user.permissions,
        hash: user.hash,
        salt: user.salt,
        resetToken: user.resetToken,
        resetExpires: user.resetExpires,
        password: user.password,
        details: user,
      }),
      user => User.from(({   // This converts a RegisteredPrincipal to a User
        id: user.id,
        permissions: [...(user.permissions || [])],
        hash: user.hash,
        salt: user.salt,
        resetToken: user.resetToken,
        resetExpires: user.resetExpires,
      })
      )
    );
  }
}