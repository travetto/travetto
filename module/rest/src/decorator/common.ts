import { AppError } from '@travetto/base';
import { HeaderMap, Request, RouteHandler } from '../types';
import { ControllerRegistry } from '../registry/registry';
import { EndpointConfig, ControllerConfig, DescribableConfig, EndpointDecorator } from '../registry/types';

const MIN = 1000 * 60;
const HOUR = MIN * 60;
const DAY = HOUR * 24;

const UNIT_MAPPING = { s: 1000, ms: 1, m: MIN, h: HOUR, d: DAY, w: DAY * 7, y: DAY * 365 };
type Units = keyof (typeof UNIT_MAPPING);

function register(config: Partial<EndpointConfig | ControllerConfig>) {
  return function (target: any, property?: string, descriptor?: TypedPropertyDescriptor<RouteHandler>) {
    if (descriptor) {
      return ControllerRegistry.registerPendingEndpoint(target.constructor, descriptor, config);
    } else {
      return ControllerRegistry.registerPending(target, config);
    }
  } as (EndpointDecorator & ClassDecorator);
}

export const Describe = (desc: DescribableConfig) => register(desc);

export const SetHeaders = (headers: HeaderMap) => register({ headers });
export function CacheControl(value: number, unit: Units = 's') {
  const delta = UNIT_MAPPING[unit] * value;
  return SetHeaders({
    Expires: value === 0 ? '-1' : () => `${new Date(Date.now() + delta).toUTCString()}`,
    'Cache-Control': () => `max-age=${delta}${delta === 0 ? ',no-cache' : ''}`
  });
}

export const DisableCacheControl = CacheControl.bind(null, 0, 's');

export function Accepts(contentTypes: string[]) {
  const types = new Set(contentTypes);
  const handler = async function (req: Request) {
    const contentType = req.header('content-type');
    if (!contentType || !types.has(contentType as string)) {
      throw new AppError(`Content type ${contentType} not one of ${contentTypes}`, 'data');
    }
  };

  return ControllerRegistry.createFilterDecorator(handler);
}