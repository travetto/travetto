import { Class } from '@travetto/registry';

import { Request, Response } from 'express';
import { ControllerRegistry } from '../service';
import { Filter } from '../types';
import { AppError } from '../model';

function filterAdder(fn: Filter) {
  return (target: any, propertyKey?: string, descriptor?: TypedPropertyDescriptor<any>) => {
    if (propertyKey && descriptor) {
      ControllerRegistry.registerEndpointFilter(target.constructor as Class, descriptor.value, fn);
      return descriptor;
    } else { // Class filters
      ControllerRegistry.registerControllerFilter(target, fn);
    }
  };
}

export function Accepts(contentTypes: string[]) {
  const types = new Set(contentTypes);
  const handler = async (req: Request, res: Response) => {
    const contentType = req.header('content-type') as string;
    if (!contentType || !types.has(contentType)) {
      throw new AppError(`Content type ${contentType} not one of ${contentTypes}`, 400);
    }
  };

  return filterAdder(handler);
}