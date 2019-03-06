import { HeaderMap, Filter } from '../types';
import { ControllerRegistry } from '../registry/registry';
import { EndpointConfig, ControllerConfig, DescribableConfig, EndpointDecorator } from '../registry/types';

const MIN = 1000 * 60;
const HOUR = MIN * 60;
const DAY = HOUR * 24;

const UNIT_MAPPING = { s: 1000, ms: 1, m: MIN, h: HOUR, d: DAY, w: DAY * 7, y: DAY * 365 };
type Units = keyof (typeof UNIT_MAPPING);

function register(config: Partial<EndpointConfig | ControllerConfig>) {
  return function (target: any, property?: string, descriptor?: TypedPropertyDescriptor<Filter>) {
    if (descriptor) {
      return ControllerRegistry.registerPendingEndpoint(target.constructor, descriptor, config);
    } else {
      return ControllerRegistry.registerPending(target, config);
    }
  } as (EndpointDecorator & ClassDecorator);
}

export const Describe = (desc: DescribableConfig) => register(desc);

export const Header = (headers: HeaderMap) => register({ headers });
export const DisableCache = () => register({
  headers: {
    Expires: '-1',
    'Cache-Control': 'max-age=0, no-cache'
  }
});

export function Cache(value: number, unit: Units = 's') {
  const delta = UNIT_MAPPING[unit] * value;
  return Header({
    Expires: () => `${new Date(Date.now() + delta).toUTCString()}`,
    'Cache-Control': () => `max-age=${delta}`
  });
}

export const Cors = (methods: string = '*', domain: string = '*') =>
  Header({
    'Access-Control-Allow-Origin': domain,
    'Access-Control-Allow-Methods': methods
  });
