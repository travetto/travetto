import { Class } from '@travetto/registry';
import { ControllerDecorator } from '../types';
import { ControllerRegistry } from '../registry';

export function Controller(path = '') {
  return function (target: Class) {
    ControllerRegistry.registerPending(target, {
      basePath: path,
      class: target,
    });
  } as ControllerDecorator;
}
