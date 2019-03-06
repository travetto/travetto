import { AuthContext } from './types';

export abstract class AuthContextSerializer {
  abstract serialize(context: AuthContext): Promise<string>;
  abstract deserialize(content: string): Promise<AuthContext>;
}