import { InjectableFactory } from '@travetto/di';
import { ModelPrincipalSource } from '../../../src/principal';
import { RegisteredIdentity } from '../../../src/identity';

import { User } from './model';

class AuthConfig {
  @InjectableFactory()
  static getModelPrincipalSource() {
    return new ModelPrincipalSource(
      User,
      (u: User) => ({    // This converts User to a RegisteredIdentity
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
      (u: Partial<RegisteredIdentity>) => User.from(({   // This converts a RegisteredIdentity to a User
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