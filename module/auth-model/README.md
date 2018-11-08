travetto: Auth-Model
===

**Install: model provider**
```bash
$ npm install @travetto/auth-model
```

This module provides the integration between the [`Auth`](https://github.com/travetto/travetto/tree/master/module/auth) module and the [`Model`](https://github.com/travetto/travetto/tree/master/module/model).

The module itself is fairly straightforward, and truly the only integration point for this module to work is defined at the model level.  The contract for the authentication model requires the following structure:

**Code: Structure of registered user**
```typescript
export interface RegisteredPrincipalFields<T> {
  id: keyof T;
  permissions: keyof T;
  hash: keyof T;
  salt: keyof T;
  password: keyof T;
  resetToken: keyof T;
  resetExpires: keyof T;
}
```

The above is the input for the ```RegisteredPrincipalConfig```, and so the fields do not need to be of the same name, but the concept and typing need to be supported.  A very basic example would be:

**Code: Sample config/wiring for user model**
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

class Config {
  @InjectableFactory()
  static getAuthService(service: ModelService): AuthModelService<User> {
    return new AuthModelService<User>(
      service, new RegisteredPrincipalConfig(User, {
        id: 'id',
        password: 'password',
        permissions: 'permissions',
        hash: 'hash',
        salt: 'salt',
        resetExpires: 'resetExpires',
        resetToken: 'resetToken'
      })
    );
  }
}

@Injectable()
class UserService {
  ...

  @Inject()
  private auth: AuthModelService<User>;

  async register(user: User) {
    const created = await this.auth.register(user);

    await  this.sendRegistrationEmail(created);

    return created;
  }

  ...
}
```