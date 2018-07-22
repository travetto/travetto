import { Class } from '@travetto/registry';

import { PathType, Method, HeaderMap } from '../model';
import { ControllerRegistry } from '../service';

const MIN = 1000 * 60;
const HOUR = MIN * 60;
const DAY = HOUR * 24;

const unitMapping = { s: 1000, ms: 1, m: MIN, h: HOUR, d: DAY, w: DAY * 7, y: DAY * 365 };
type Units = keyof (typeof unitMapping);

export function Controller(path = '') {
  return (target: Class) => {
    ControllerRegistry.register(target, {
      path,
      class: target,
    });
  };
}

function Handler(method: Method, path: PathType) {
  return ControllerRegistry.registerPendingRequestHandler({ method, path });
}

function HandlerWithHeaders(method: Method, headers: HeaderMap, path: PathType) {
  return ControllerRegistry.registerPendingRequestHandler({ method, headers, path });
}

export const All = (path: PathType) => Handler('all', path);
export const Get = (path: PathType) => HandlerWithHeaders('get', { Expires: '-1', 'Cache-Control': 'max-age=0, no-cache' }, path);
export const Post = (path: PathType) => Handler('post', path);
export const Put = (path: PathType) => Handler('put', path);
export const Patch = (path: PathType) => Handler('patch', path);
export const Delete = (path: PathType) => Handler('delete', path);
export const Head = (path: PathType) => Handler('head', path);
export const Options = (path: PathType) => Handler('options', path);

export function Header(headers: HeaderMap) {
  return ControllerRegistry.registerPendingRequestHandler({ headers });
}

export function Cache(value: number, unit: Units = 's') {
  const delta = unitMapping[unit] * value;
  return Header({
    Expires: () => `${new Date(Date.now() + delta).toUTCString()}`,
    'Cache-Control': () => `max-age=${delta}`
  });
}