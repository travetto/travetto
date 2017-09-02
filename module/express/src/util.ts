import { Request } from 'express';
import { RouteStack, PathType } from './model';

export function canAccept(req: Request, mime: string) {
  return (req.headers['accept'] || '').indexOf(mime) >= 0;
}


export function removeRoutes(stack: RouteStack[], toRemove: Map<PathType, Set<string>>): RouteStack[] {
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
