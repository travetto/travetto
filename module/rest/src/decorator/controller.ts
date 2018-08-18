import { Class } from '@travetto/registry';
import { ControllerDecorator } from '../types';
import { ControllerRegistry } from '../service';

export function Controller(path = '') {
  return function (target: Class) {
    ControllerRegistry.registerPending(target, {
      basePath: path,
      class: target,
    });
  } as ControllerDecorator;
}
