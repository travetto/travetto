import { Request } from 'express';

export function canAccept(req: Request, mime: string) {
  return (req.headers['accept'] || '').indexOf(mime) >= 0;
}
