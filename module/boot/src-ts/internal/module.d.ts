import * as Mod from 'module';

declare global {
  namespace NodeJS {
    interface Module {
      _load(req: string, parent: Module): unknown;
      _resolveFilename(req: string, parent: Module): string;
      _compile(contents: string, file: string): unknown;
    }
  }
  interface NodeModule {
    _load(req: string, parent: NodeModule): unknown;
    _resolveFilename(req: string, parent: NodeModule): string;
    _compile(contents: string, file: string): unknown;
  }
}
