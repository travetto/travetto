import { AuthContext, AuthContextSerializer } from '@travetto/auth';
import { Response, Request } from '@travetto/rest';

export abstract class RestAuthContextSerializer extends AuthContextSerializer {
  abstract writeToResponse(request: Request, response: Response, content: string, context: AuthContext): Promise<void>;
  abstract getFromRequest(request: Request): Promise<string | undefined>;

  refresh?(request: Request, response: Response, context: AuthContext): Promise<void>;

  async restore(req: Request): Promise<AuthContext | undefined> {
    const input = await this.getFromRequest(req);

    if (input) {
      const ctx = await this.deserialize(input);
      if (ctx) {
        console.log('Restoring', ctx);
        return ctx;
      }
    }
  }

  async store(request: Request, res: Response, context: AuthContext): Promise<void> {
    const output = await this.serialize(context);
    this.writeToResponse(request, res, output, context);
  }
}