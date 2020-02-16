import * as ts from 'typescript';
import { ImportManager } from './imports';

export class DecoratorManager {
  readonly decorators = new Map<string, ts.PropertyAccessExpression>();

  constructor(private imports: ImportManager) { }

  importDecorator(pth: string, name: string) {
    if (!this.decorators.has(name)) {
      const ref = this.imports.importFile(pth);
      const ident = ts.createIdentifier(name);
      this.decorators.set(name, ts.createPropertyAccess(ref.ident, ident));
    }
  }

  createDecorator(name: string, ...contents: (ts.Expression | undefined)[]) {
    return ts.createDecorator(
      ts.createCall(
        this.decorators.get(name)!,
        undefined,
        contents.filter(x => !!x) as ts.Expression[]
      )
    );
  }
}