import { Class } from '@travetto/registry';

import { PathType } from '../model';
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

export function All(path: PathType) {
  return ControllerRegistry.registerPendingRequestHandler({ method: 'all', path });
}

export function Get(path: PathType) {
  return ControllerRegistry.registerPendingRequestHandler({
    method: 'get',
    path,
    headers: {
      Expires: '-1',
      'Cache-Control': 'max-age=0, no-cache'
    }
  });
}

export function Put(path: PathType) {
  return ControllerRegistry.registerPendingRequestHandler({ method: 'put', path });
}

export function Delete(path: PathType) {
  return ControllerRegistry.registerPendingRequestHandler({ method: 'delete', path });
}

export function Post(path: PathType) {
  return ControllerRegistry.registerPendingRequestHandler({ method: 'post', path });
}

export function Header(headers: { [key: string]: (string | (() => string)) }) {
  return ControllerRegistry.registerPendingRequestHandler({ headers });
}

export function Cache(value: number, unit: Units = 's') {
  const delta = unitMapping[unit] * value;
  return Header({
    Expires: () => `${new Date(Date.now() + delta).toUTCString()}`,
    'Cache-Control': () => `max-age=${delta}`
  });
}