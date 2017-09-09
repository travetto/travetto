import { Request, Response, NextFunction } from 'express';
import { nodeToPromise } from '@encore2/base';
import { ControllerRegistry, AppError } from '@encore2/express';
import * as passport from 'passport';

export function Authenticate(provider: string = 'app', failTo?: string) {
  let passportOptions = { failureRedirect: failTo };
  let handler = passport.authenticate(provider, passportOptions);
  let fn = function (req: Request, res: Response, next: NextFunction): Promise<any> {
    req.passportOptions = passportOptions;
    return nodeToPromise(null, handler, req, res);
  };
  return ControllerRegistry.filterAdder(fn);
}

export async function requireAuth(config: { key?: string, include: string[], exclude: string[] }, req: Request, res: Response) {
  if (req.isUnauthenticated()) {
    throw new AppError('User is required', 401);
  }
  let { key, include, exclude } = config;

  if (key) {
    let groupSet = req.principal.groupSet;
    if (!groupSet) {
      let prop = (req.principal as any)[key] as string | string[];
      let groups = Array.isArray(prop) ? prop : [prop];
      groupSet = req.principal.groupSet = new Set(groups);
    }

    if (exclude.length && exclude.find(x => groupSet.has(x))) {
      throw new AppError('Access forbidden', 403);
    }
    if (include.length && include.find(x => !groupSet.has(x))) {
      throw new AppError('Access forbidden', 403);
    }
  }
}

export function Authenticated(key?: string, include: string[] = [], exclude: string[] = []) {
  return ControllerRegistry.filterAdder(requireAuth.bind(null, {
    key,
    include: include.map(x => x.toLowerCase()),
    exclude: exclude.map(x => x.toLowerCase())
  }));
}

export function Unauthenticated() {
  return ControllerRegistry.filterAdder(function (req: Express.Request) {
    if (!req.isUnauthenticated()) {
      throw new AppError('User cannot be authenticated', 401);
    }
  });
}