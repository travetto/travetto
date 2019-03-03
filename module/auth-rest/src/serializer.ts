import { AuthContext } from '@travetto/auth';
import { Request, Response } from '@travetto/rest';

export abstract class AuthSerializerProvider {
  abstract serialize(req: Request, res: Response, context: AuthContext): Promise<void>;
  abstract deserialize(req: Request, res: Response): Promise<AuthContext>;
}