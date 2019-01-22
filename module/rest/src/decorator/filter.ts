import { ControllerRegistry } from '../registry';
import { RestError } from '../error';
import { Request } from '../types';

export function Accepts(contentTypes: string[]) {
  const types = new Set(contentTypes);
  const handler = async function (req: Request) {
    const contentType = req.header('content-type');
    if (!contentType || !types.has(contentType)) {
      throw new RestError(`Content type ${contentType} not one of ${contentTypes}`, 400);
    }
  };

  return ControllerRegistry.createFilterDecorator(handler);
}