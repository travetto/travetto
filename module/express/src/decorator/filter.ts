import { ControllerRegistry } from '../service';
import { AppError } from '../model';
import { Request } from 'express';

export function Accepts(contentTypes: string[]) {
  const types = new Set(contentTypes);
  const handler = async function (req: Request) {
    const contentType = req.header('content-type') as string;
    if (!contentType || !types.has(contentType)) {
      throw new AppError(`Content type ${contentType} not one of ${contentTypes}`, 400);
    }
  };

  return ControllerRegistry.createFilterDecorator(handler);
}