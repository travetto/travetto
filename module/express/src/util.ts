import { Request } from 'express';
import { RouteStack, PathType, ControllerConfig, Method } from './model';

export function canAccept(req: Request, mime: string) {
  return (req.headers['accept'] || '').indexOf(mime) >= 0;
}

function removeRoutes(stack: RouteStack[], toRemove: Map<PathType, Set<string>>): RouteStack[] {
  return stack.slice(0).map(x => {
    if (x.route) {
      if (x.route.stack) {
        x.route.stack = removeRoutes(x.route.stack, toRemove);
      }
      if (toRemove.has(x.route.path)) {
        let method = x.route.methods && Object.keys(x.route.methods)[0];
        if (toRemove.get(x.route.path)!.has(method)) {
          console.debug(`Dropping ${method}/${x.route.path}`);
          return null;
        }
      }
    }
    return x;
  }).filter(x => !!x) as RouteStack[];
}

export function removeAllRoutes(stack: RouteStack[], config: ControllerConfig) {
  // Un-register
  let controllerRoutes = new Map<PathType, Set<Method>>();
  for (let { method, path } of config.handlers) {
    if (!controllerRoutes.has(path!)) {
      controllerRoutes.set(path!, new Set());
    }
    controllerRoutes.get(path!)!.add(method!);
  }
  return removeRoutes(stack, controllerRoutes);
}