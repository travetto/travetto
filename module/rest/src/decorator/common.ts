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

export const SetHeader = (headers: HeaderMap) => register({ headers });
export const DisableCache = () => register({
  headers: {
    Expires: '-1',
    'Cache-Control': 'max-age=0, no-cache'
  }
});

export function Cache(value: number, unit: Units = 's') {
  const delta = UNIT_MAPPING[unit] * value;
  return SetHeader({
    Expires: () => `${new Date(Date.now() + delta).toUTCString()}`,
    'Cache-Control': () => `max-age=${delta}`
  });
}

export function Accepts(contentTypes: string[]) {
  const types = new Set(contentTypes);
  const handler = async function (req: Request) {
    const contentType = req.header('content-type');
    if (!contentType || !types.has(contentType)) {
      throw new AppError(`Content type ${contentType} not one of ${contentTypes}`, 'data');
    }
  };

  return ControllerRegistry.createFilterDecorator(handler);
}