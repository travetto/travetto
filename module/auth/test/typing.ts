import { PrincipalConfig } from '../src';

class User {
  id: string;
  pw: string;
  perms: Set<string>;
}

const config = new PrincipalConfig(User, {
  id: 'id',
  password: 'pw',
  permissions: 'perms'
});
