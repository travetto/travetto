import { Request, Response } from '@travetto/rest';
import { Session } from '../types';

// TODO: Document
export abstract class SessionEncoder {
  abstract encode(req: Request, res: Response, session: Session | null): Promise<void>;
  abstract decode(req: Request): Promise<string | Session | undefined>;
}