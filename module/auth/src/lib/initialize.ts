import * as passport from 'passport';
import { Context } from '@encore/context';
import { app } from '@encore/express';
import { nodeToPromise } from '@encore/util';
import { Request, Response } from 'express';

app.use(passport.initialize(), passport.session());

async function logout(req: Request, res: Response) {
  await nodeToPromise(req.session, req.session.destroy);
  res.clearCookie('connect.sid', { path: '/' });
}

app.use((req: Request, res: Response, next?: Function) => {
  req.principal = req.user as any;
  Context.get().user = req.user;
  req.doLogout = () => logout(req, res);
  if (next) {
    next();
  }
});