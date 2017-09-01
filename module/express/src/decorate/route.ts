import * as moment from 'moment';
import { PathType } from '../model';
import { RouteRegistry } from '../service';
import { Class } from '@encore/di';

export function Controller(path = '') {
  return (target: Class) => {
    RouteRegistry.finalizeClass({
      path,
      class: target
    });
  };
}

export function All(path: PathType) {
  return RouteRegistry.registerPendingRequestHandlder({ method: 'all', path });
}

export function Get(path: PathType) {
  return RouteRegistry.registerPendingRequestHandlder({
    method: 'get',
    path,
    headers: {
      Expires: '-1',
      'Cache-Control': 'max-age=0, no-cache'
    }
  });
}

export function Put(path: PathType) {
  return RouteRegistry.registerPendingRequestHandlder({ method: 'put', path });
}

export function Delete(path: PathType) {
  return RouteRegistry.registerPendingRequestHandlder({ method: 'delete', path });
}

export function Post(path: PathType) {
  return RouteRegistry.registerPendingRequestHandlder({ method: 'post', path });
}

export function Header(headers: { [key: string]: (string | (() => string)) }) {
  return RouteRegistry.registerPendingRequestHandlder({ headers });
}

export function Cache(value: number, unit = 'second') {
  function getTime() {
    let end = moment().add(value as any, unit as any).toDate().getTime();
    let start = new Date().getTime();
    return end - start;
  }
  return Header({
    Expires: () => `${new Date(Date.now() + getTime()).toUTCString()}`,
    'Cache-Control': () => `max-age=${getTime()}`
  });
}