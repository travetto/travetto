import * as ts from 'typescript';
import { DecoratorMeta } from './types/decorator';

import { ImportManager } from './importer';
import { TypeResolver } from './resolver';

export class DecoratorManager {
  readonly decorators = new Map<string, ts.PropertyAccessExpression>();

  constructor(private imports: ImportManager, private resolver: TypeResolver) { }

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

  getDecoratorIdent(d: ts.Decorator): ts.Identifier {
    if (ts.isCallExpression(d.expression)) {
      return d.expression.expression as ts.Identifier;
    } else if (ts.isIdentifier(d.expression)) {
      return d.expression;
    } else {
      throw new Error('No Identifier');
    }
  }

  getDecoratorMeta(dec: ts.Decorator): DecoratorMeta {
    const ident = this.getDecoratorIdent(dec);
    return ({
      dec,
      ident,
      targets: this.resolver.readDocsTags(ident, 'augments').map(x => x.replace(/trv \//, 'trv/')),
      name: ident ?
        ident.escapedText! as string :
        undefined as any as string
    });
  }

  getDecoratorList(node: ts.Node): DecoratorMeta[] {
    return ((node.decorators ?? []) as ts.Decorator[])
      .map(dec => this.getDecoratorMeta(dec))
      .filter(x => !!x.ident);
  }
}