travetto: Auth-Model
===

**Install: model provider**
```bash
$ npm install @travetto/auth-model
```

This module provides the integration between the [`Auth`](https://github.com/travetto/travetto/tree/master/module/auth) module and the [`Model`](https://github.com/travetto/travetto/tree/master/module/model).

The module itself is fairly straightforward, and truly the only integration point for this module to work is defined at the model level.  The contract for authentication is established in code as providing translation to and from a [`RegisteredIdentity`](./src/identity.ts).  

A registered identity extends the base concept of an identity, by adding in additional fields needed for local registration, specifically password management information.

**Code: Registered Identity, and a valid User model**
```typescript
export interface RegisteredIdentity extends Identity {
  hash: string;
  salt: string;
  resetToken: string;
  resetExpires: Date;
  password?: string;
}

@Model()
class User extends BaseModel implements RegisteredIdentity {
  password?: string;
  salt?: string;
  hash?: string;
  resetToken?: string;
  resetExpires?: Date;
  permissions?: string[];
}
```

## Configuration
Additionally, there exists a common practice of mapping various external security principals into a local contract. These external identities, as provided from countless authentication schemes, need to be homogeonized for use.  This has been handled in other frameworks by using external configuration, and creating a mapping between the two set of fields.  Within this module, the mappings are defined as functions in which you can translate to the model from an identity or to an identity from a model.


**Code: Principal Provider configuration**
```typescript

class AuthConfig {
  @InjectableFactory()
  static getModelPrincipalProvider(): PrincipalProvider {
    new ModelPrincipalProvider(
      User,
      (u:User) => ({    // This converts User to a RegisteredIdentity
        provider: 'model',
        id: u.id, 
        permissions: new Set(u.permissions), 
        hash: u.hash,
        salt: u.salt,
        resetToken: u.resetToken,
        resetExpires: u.resetExpires,
        password: u.password,
        details: u, 
      }),
      (u:RegisteredIdentity) => User.from(({   // This converts a RegisteredIdentity to a User
        id: u.id, 
        permissions: [...(u.permissions||[])],
        hash: u.hash,
        salt: u.salt,
        resetToken: u.resetToken,
        resetExpires: u.resetExpires,
      })
    );
  }
}
```

**Code: Sample usage**
```typescript
@Injectable()
class UserService {
  ...

  @Inject()
  private auth: ModelPrincipalProvider<User>;

  async authenticate(identity: RegisteredIdentity) {
    try {
      return await svc.authenticate(identity.id!, identity.password!);
    } catch (err) {
      if (err instanceof AppError && err.category === 'notfound') {
        return await svc.register(identity);
      } else {
        throw err;
      }
    }
  }

  ...
}
```