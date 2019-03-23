import { Request, Response } from '@travetto/rest';
import { Session } from '../types';

export abstract class SessionEncoder {
  abstract encode(req: Request, res: Response, session: Session): Promise<void>;
  abstract decode(req: Request): Promise<string | Session | undefined>;
}