import { Class } from '@travetto/registry';
import { ControllerRegistry } from '../service';

export function Controller(path = '') {
  return (target: Class) => {
    ControllerRegistry.registerPending(target, {
      basePath: path,
      class: target,
    });
  };
}
