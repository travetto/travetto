declare module 'router' {
  import { NextFunction, NextHandleFunction } from 'connect'
  import { IncomingMessage, ServerResponse } from 'http'

  export type Path = string | RegExp | Array<string | RegExp>

  export namespace Router {
    export interface RouteType {
      new(path: string): Route
      prototype: Route
    }

    type Method = 'all' | 'head' | 'get' | 'post' | 'delete' | 'put' | 'patch' | 'options'

    export type Route = { readonly path: Path; } & Record<Method, (middleware: NextHandleFunction, ...middlewares: NextHandleFunction[]) => Route>

    export interface Options {
      caseSensitive?: boolean
      strict?: boolean
      mergeParams?: <C extends {}, P extends {}>(currentParams: C, parentParams: P) => Record<string | number, any>
    }

    export interface Layer {
      handle: Function;
    }

    export type ParamCallback<K = string | number> = (
      req: IncomingMessage,
      res: ServerResponse,
      next: NextFunction,
      value: any,
      name: K,
    ) => any

    interface InnerRouter extends NextHandleFunction {
      stack: Layer[];
      route(path: Path): Route
      param: <K extends string | number>(name: K, fn: ParamCallback<K>) => this
    }

    export type Router = InnerRouter & Record<'use' | Method, {
      (path: Path, middleware: NextHandleFunction, ...middlewares: NextHandleFunction[]): Router
      (middleware: NextHandleFunction, ...middlewares: NextHandleFunction[]): Router
    }>

    interface RouterType {
      new(options?: Options): Router
      (options?: Options): Router
      Route: RouteType
      prototype: Router
    }
  }

  export type RouterType = Router.RouterType
  const Router: RouterType
  export default Router
}
