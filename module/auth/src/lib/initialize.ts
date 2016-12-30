import * as passport from 'passport';
import { Context } from '@encore/context';
import { AppService } from '@encore/express';
import { nodeToPromise } from '@encore/util';
import { Request, Response } from 'express';

AppService.use(passport.initialize(), passport.session());

async function logout(req: Request, res: Response) {
  await nodeToPromise(req.session, req.session.destroy);
  res.clearCookie('connect.sid', { path: '/' });
}

AppService.use((req: Request, res: Response, next?: Function) => {
  req.principal = req.user as any;
  Context.get().user = req.user;
  req.doLogout = () => logout(req, res);
  if (next) {
    next();
  }
});