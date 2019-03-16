travetto: Auth-Model
===

**Install: model provider**
```bash
$ npm install @travetto/auth-model
```

This module provides the integration between the [`Auth`](https://github.com/travetto/travetto/tree/master/module/auth) module and the [`Model`](https://github.com/travetto/travetto/tree/master/module/model).

The module itself is fairly straightforward, and truly the only integration point for this module to work is defined at the model level.  The contract for authentication is established in code:

**Code: Structure of auth principal provider**
```typescript
@Model()
class User extends BaseModel {
  password?: string;
  salt?: string;
  hash?: string;
  resetToken?: string;
  resetExpires?: Date;
  permissions?: string[];
}

class AuthConfig {
  @InjectableFactory()
  static getAuthModelProvider(): PrincipalProvider {
    new ModelPrincipalProvider(
      User,
      (u:User) => ({ 
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
      (u:Identity) => User.from(({ 
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
As you can see, to use the `ModelProvider`, you need to provide mapping functions to convert between the `Principal` model, and the underlying model.  Below is an example of what using the provider would look like:

**Code: Sample usage**
```typescript
@Injectable()
class UserService {
  ...

  @Inject()
  private auth: ModelPrincipalProvider<User>;

  async register(user: User) {
    const created = await this.auth.register(user);

    await  this.sendRegistrationEmail(created);

    return created;
  }

  ...
}
```