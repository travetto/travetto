import { ObjectUtil } from '@encore/base';
import * as moment from "moment";
import { RequestHandler, PathType } from './types';

function createRequestHandlerDecorator(rh: RequestHandler) {
  return (target: Object, propertyKey: string, descriptor: TypedPropertyDescriptor<any>) => {
    descriptor.value.requestHandler =
      ObjectUtil.merge(descriptor.value.requestHandler || {}, rh);
    return descriptor;
  };
}

export function All(path: PathType) {
  return createRequestHandlerDecorator({ method: 'all', path });
}

export function Get(path: PathType) {
  return createRequestHandlerDecorator({
    method: 'get',
    path,
    headers: {
      Expires: '-1',
      'Cache-Control': 'max-age=0, no-cache'
    }
  });
}

export function Put(path: PathType) {
  return createRequestHandlerDecorator({ method: 'put', path });
}

export function Delete(path: PathType) {
  return createRequestHandlerDecorator({ method: 'delete', path });
}

export function Post(path: PathType) {
  return createRequestHandlerDecorator({ method: 'post', path });
}

export function Header(headers: { [key: string]: (string | (() => string)) }) {
  return createRequestHandlerDecorator({ headers });
}

export function Cache(value: number, unit: string = "second") {
  function getTime() {
    let end = moment().add(value as any, unit as any).toDate().getTime();
    let start = new Date().getTime();
    return end - start;
  }
  return Header({
    Expires: () => `${new Date(Date.now() + getTime()).toUTCString()}`,
    'Cache-Control': () => `max-age=${getTime()}`
  })
}