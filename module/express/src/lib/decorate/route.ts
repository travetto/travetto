import * as moment from 'moment';
import { PathType } from '../model';
import { RouteService } from '../service';

export function Controller(path = '') {
  return RouteService.registerRequestHandlers.bind(null, path);
}

export function All(path: PathType) {
  return RouteService.createRequestHandlerDecorator({ method: 'all', path });
}

export function Get(path: PathType) {
  return RouteService.createRequestHandlerDecorator({
    method: 'get',
    path,
    headers: {
      Expires: '-1',
      'Cache-Control': 'max-age=0, no-cache'
    }
  });
}

export function Put(path: PathType) {
  return RouteService.createRequestHandlerDecorator({ method: 'put', path });
}

export function Delete(path: PathType) {
  return RouteService.createRequestHandlerDecorator({ method: 'delete', path });
}

export function Post(path: PathType) {
  return RouteService.createRequestHandlerDecorator({ method: 'post', path });
}

export function Header(headers: { [key: string]: (string | (() => string)) }) {
  return RouteService.createRequestHandlerDecorator({ headers });
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