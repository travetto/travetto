# Model Auth Source
## Model-based authentication and registration support for the travetto framework

**Install: @travetto/auth-model**
```bash
npm install @travetto/auth-model
```

This module provides the integration between the [Authentication](https://github.com/travetto/travetto/tree/1.0.0-dev/module/auth "Authentication scaffolding for the travetto framework") module and the [Data Modeling](https://github.com/travetto/travetto/tree/1.0.0-dev/module/model "Datastore abstraction for CRUD operations with advanced query support.").

The module itself is fairly straightforward, and truly the only integration point for this module to work is defined at the model level.  The contract for authentication is established in code as providing translation to and from a [RegisteredIdentity](./src/identity.ts#L5)

A registered identity extends the base concept of an identity, by adding in additional fields needed for local registration, specifically password management information.

**Code: Registered Identity**
```typescript
export interface RegisteredIdentity extends Identity {
  /**
   * Password hash
   */
  hash: string;
  /**
   * Password salt
   */
  salt: string;
  /**
   * Temporary Reset Token
   */
  resetToken?: string;
  /**
   * End date for the reset token
   */
  resetExpires?: Date;
  /**
   * The actual password, only used on password set/update
   */
  password?: string;
}
```

**Code: A valid user model**
```typescript
import { Model, BaseModel } from '@travetto/model';
import { RegisteredIdentity } from '@travetto/auth-model/src/identity';

@Model()
export class User extends BaseModel implements RegisteredIdentity {
  id: string;
  source: string;
  details: Record<string, any>;
  password?: string;
  salt: string;
  hash: string;
  resetToken?: string;
  resetExpires?: Date;
  permissions: string[];
}
```

## Configuration

Additionally, there exists a common practice of mapping various external security principals into a local contract. These external identities, as provided from countless authentication schemes, need to be homogeonized for use.  This has been handled in other frameworks by using external configuration, and creating a mapping between the two set of fields.  Within this module, the mappings are defined as functions in which you can translate to the model from an identity or to an identity from a model.

**Code: Principal Source configuration**
```typescript
import { InjectableFactory } from '@travetto/di';
import { ModelPrincipalSource } from '@travetto/auth-model/src/principal';
import { RegisteredIdentity } from '@travetto/auth-model/src/identity';

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
```

**Code: Sample usage**
```typescript
import { AppError } from '@travetto/base';
import { Injectable, Inject } from '@travetto/di';
import { ModelPrincipalSource } from '@travetto/auth-model/src/principal';
import { User } from './model';

@Injectable()
class UserService {

  @Inject()
  private auth: ModelPrincipalSource<User>;

  async authenticate(identity: User) {
    try {
      return await this.auth.authenticate(identity.id!, identity.password!);
    } catch (err) {
      if (err instanceof AppError && err.category === 'notfound') {
        return await this.auth.register(identity);
      } else {
        throw err;
      }
    }
  }
}
```

