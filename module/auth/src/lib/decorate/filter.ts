import { Request, Response, NextFunction } from "express";
import { ObjectUtil, nodeToPromise } from "@encore/util";
import { filterAdder } from '@encore/express';
import * as passport from "passport";

export function Authenticate(provider: string, failTo?: string) {
  let handler = passport.authenticate(provider, { failureRedirect: failTo })
  let fn = (req: Request, res: Response, next: NextFunction): Promise<any> => nodeToPromise(null, handler, req, res);
  return filterAdder(fn);
}

export async function requireAuth(config: { key?: string, include?: string[], exclude?: string[] }, req: Request, res: Response) {
  if (req.isUnauthenticated()) {
    throw { message: "User is required", statusCode: 401 };
  }
  if (config.key) {
    if (!req.principal.groupMap) {
      let prop = (req.principal as any)[config.key];
      let groups = Array.isArray(prop) ? prop as string[] : [prop as string];
      req.principal.groupMap = ObjectUtil.fromPairs(groups.map((x: string) => [x.toLowerCase(), true]) as [string, boolean][]);
    }

    if (config.exclude && config.exclude.length && config.exclude.find(x => req.principal.groupMap[x]) !== undefined) {
      throw { message: "Access forbidden", statusCode: 403 };
    }
    if (config.include && config.include.length && config.include.find(x => req.principal.groupMap[x]) === undefined) {
      throw { message: "Access forbidden", statusCode: 403 };
    }
  }
}

export function Authenticated(key?: string, include: string[] = [], exclude: string[] = []) {
  let auth = requireAuth.bind(null, {
    key,
    include: include.map(x => x.toLowerCase()),
    exclude: exclude.map(x => x.toLowerCase())
  });

  return (...args: any[]) => {
    if (args[2] && args[2].value) {
      let target: Object = args[0],
        propertyKey: string = args[1],
        descriptor: TypedPropertyDescriptor<any> = args[2];
      return filterAdder(auth)(target, propertyKey, descriptor);
    } else {
      let cls = args[0]
      cls.filters = cls.filters || [];
      cls.filters.push(auth)
      return cls;
    }
  }
}

export function Unauthenticated() {
  let unauth = (req: Express.Request) => {
    if (!req.isUnauthenticated()) {
      throw { message: "User cannot be authenticated", statusCode: 401 };
    }
  }
  return (...args: any[]) => {
    if (args[2] && args[2].value) {
      let target: Object = args[0],
        propertyKey: string = args[1],
        descriptor: TypedPropertyDescriptor<any> = args[2];
      return filterAdder(unauth)(target, propertyKey, descriptor);
    } else {
      let cls = args[0]
      cls.filters = cls.filters || [];
      cls.filters.push(unauth)
      return cls;
    }
  }
}