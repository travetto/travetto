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

/**
 * Decorator used to add description metadata to a class or method
 * @param desc The describe config
 */
export const Describe = (desc: DescribableConfig) => register(desc);

/**
 * Set response headers on success
 * @param headers The response headers to set
 */
export const SetHeaders = (headers: HeaderMap) => register({ headers });

/**
 * Set the max-age of a response based on the config
 * @param value The value for the duration
 * @param unit The unit of measurement
 */
export function CacheControl(value: number, unit: Units = 's') {
  const delta = UNIT_MAPPING[unit] * value;
  return SetHeaders({
    Expires: value === 0 ? '-1' : () => `${new Date(Date.now() + delta).toUTCString()}`,
    'Cache-Control': () => `max-age=${delta}${delta === 0 ? ',no-cache' : ''}`
  });
}

/**
 * Disable cache control, ensuring endpoint will not cache
 */
export const DisableCacheControl = CacheControl.bind(null, 0, 's');

/**
 * Define an endpoint to support specific input types
 * @param contentTypes The list of mime types to support
 */
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