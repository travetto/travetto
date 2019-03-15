import { AuthContext } from '@travetto/auth';
import { Response, Request } from '@travetto/rest';

export abstract class RestAuthContextSerializer {

  abstract serialize(request: Request, response: Response, content: string): Promise<void>;
  abstract deserialize(request: Request): Promise<string | undefined>;

  refresh?(request: Request, response: Response, context: AuthContext): Promise<void>;
}