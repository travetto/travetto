import * as ts from 'typescript';
import { TransformUtils, Import } from '@encore/base';

interface State {
  imports: Import[],
  path: string
}

export const Transformer =
  (context: ts.TransformationContext) =>
    (file: ts.SourceFile) => {
      let state: State = { imports: [], path: require.resolve(file.fileName) };
      let ret = visitNode(context, file, state);

      if (state.imports.length) {
        TransformUtils.addImport(ret, state.imports);
      }
      return ret;
    };


function visitNode<T extends ts.Node>(context: ts.TransformationContext, node: T, state: State): T {
  if (ts.isClassDeclaration(node)) {
    let foundDec = TransformUtils.getDecorator(node, require.resolve('./injectable'), 'Injectable');
    let cons;
    for (let member of node.members) {
      if (ts.isConstructorDeclaration(member)) {
        cons = member;
        break;
      }
    }

    let ret = ts.visitEachChild(node, c => visitNode(context, c, state), context);

    if (cons) {
      let dec = foundDec!;
      let expr = (dec.expression as ts.CallExpression).arguments[0] as ts.ObjectLiteralExpression;
      if (!expr) {
        expr = ts.createObjectLiteral([]);
      }
      let props = [
        ...expr.properties,
        ts.createPropertyAssignment(
          ts.createLiteral('dependencies'),
          ts.createArrayLiteral(
            (cons.parameters! || []).map(x => {
              let name = TransformUtils.getDecorator(x, require.resolve('./injectable'), 'Inject');
              let type = TransformUtils.getTypeChecker().getTypeAtLocation(x);
              let decl = type!.symbol!.valueDeclaration!;
              let path = (decl as any).parent.fileName;
              let ident = ts.createIdentifier(`${(decl as any).name.text}`);
              let importName = ts.createUniqueName(`import_${(decl as any).name.text}`);

              if (require.resolve(path) !== state.path) {
                state.imports.push({
                  ident: importName,
                  path
                });

                let obj = ts.createObjectLiteral([
                  ts.createPropertyAssignment('class', ts.createPropertyAccess(importName, ident)),
                  ts.createPropertyAssignment('name', name ? (name.expression as ts.CallExpression).arguments[0] : ts.createIdentifier('undefined'))
                ]);
                return obj;
              } else {
                let obj = ts.createObjectLiteral([
                  ts.createPropertyAssignment('class', (decl as any).name),
                ]);
                return obj;
              }
            })
          )
        )
      ];

      dec = ts.updateDecorator(dec, ts.updateCall(
        (dec.expression as ts.CallExpression),
        (dec.expression as ts.CallExpression).expression,
        undefined,
        [ts.updateObjectLiteral(expr!, props)]
      ))

      ret = ts.updateClassDeclaration(ret,
        [dec, ...(ret.decorators! || []).filter(x => x !== foundDec)],
        ret.modifiers, ret.name,
        ret.typeParameters,
        ret.heritageClauses as any,
        ret.members) as any;
    }

    return ret;
  } else {
    return ts.visitEachChild(node, c => visitNode(context, c, state), context);
  }
}

