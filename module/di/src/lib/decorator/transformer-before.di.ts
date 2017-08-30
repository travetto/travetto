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

function processDeclaration(state: State, param: ts.ParameterDeclaration | ts.PropertyDeclaration) {
  let name = TransformUtils.getDecorator(param, require.resolve('./injectable'), 'Inject');
  let type = TransformUtils.getTypeChecker().getTypeAtLocation(param);
  let decl = type!.symbol!.valueDeclaration!;
  let path = (decl as any).parent.fileName;
  let ident = ts.createIdentifier(`${(decl as any).name.text}`);
  let importName = ts.createUniqueName(`import_${(decl as any).name.text}`);

  if (require.resolve(path) !== state.path) {
    state.imports.push({
      ident: importName,
      path
    });

    return TransformUtils.fromLiteral({
      class: ts.createPropertyAccess(importName, ident),
      name: name ? (name.expression as ts.CallExpression).arguments[0] : undefined
    });
  } else {
    return TransformUtils.fromLiteral({
      class: (decl as any).name
    });
  }
}

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

    let fields = node.members
      .filter(x => ts.isPropertyDeclaration(x))
      .filter(x => !!TransformUtils.getDecorator(x, require.resolve('./injectable'), 'Inject'));

    let ret = ts.visitEachChild(node, c => visitNode(context, c, state), context);

    if (cons || fields.length) {
      let dec = foundDec!;
      let expr = (dec.expression as ts.CallExpression).arguments[0] as ts.ObjectLiteralExpression;
      let deps: any = {};
      if (cons) {
        deps.cons = (cons.parameters! || [])
          .map(x => processDeclaration(state, x));
      }
      if (fields) {
        deps.fields = fields
          .map(x => [x.name!.getText(), processDeclaration(state, x as ts.PropertyDeclaration)] as [string, ts.Node])
          .reduce((acc, [name, node]) => {
            acc[name] = node;
            return acc;
          }, {} as any);
      }
      let conf = TransformUtils.extendObjectLiteral({
        annotations: (node.decorators! || []).map(x => TransformUtils.getDecoratorIdent(x)),
        dependencies: deps
      });

      dec = ts.updateDecorator(dec, ts.updateCall(
        (dec.expression as ts.CallExpression),
        (dec.expression as ts.CallExpression).expression,
        undefined,
        [conf]
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

