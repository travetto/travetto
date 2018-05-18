import { Request, Response } from 'express';

import { SchemaRegistry, BindUtil, SchemaValidator } from '@travetto/schema';
import { isPlainObject } from '@travetto/base';
import { Class } from '@travetto/registry';

import { ControllerRegistry } from '../src/service/registry';
import { AppError } from '../src/model/error';

import * as qs from 'querystring';

function getBound<T>(cls: Class<T>, obj: any, view?: string) {
  try {
    return BindUtil.bindSchema(cls, new cls(), obj, view);
  } catch (e) {
    throw new AppError(`Supplied data is incompatiable with ${cls.__id}`);
  }
}

export async function getSchemaBody<T>(req: Request, cls: Class<T>, view?: string) {
  if (isPlainObject(req.body)) {
    const o = getBound(cls, req.body, view);
    if (SchemaRegistry.has(cls)) {
      return await SchemaValidator.validate(o, view);
    } else {
      return o;
    }
  } else {
    throw new AppError(`Body is missing or wrong type: ${req.body}`, 503);
  }
}

export function SchemaBody<T>(cls: Class<T>, view?: string) {
  return ControllerRegistry.filterAdder(async (req: Request, res: Response) => {
    req.body = await getSchemaBody(req, cls, view);
  });
}

export function SchemaQuery<T>(cls: Class<T>, view?: string) {
  return ControllerRegistry.filterAdder(async (req: Request, res: Response) => {

    const o = getBound(cls, BindUtil.expandPaths(qs.parse(req.query)), view);
    if (SchemaRegistry.has(cls)) {
      req.query = await SchemaValidator.validate(o, view);
    } else {
      req.query = o;
    }
  });
}