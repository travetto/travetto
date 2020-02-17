import * as ts from 'typescript';

import {
  TransformUtil, TransformerState, DecoratorMeta, res, OnClass
} from '@travetto/compiler/src/transform-support';

export class ApplicationTransformer {

  // TODO: Finish up, initializer and optional?
  static computeParam(state: TransformerState, p: ts.ParameterDeclaration) {
    const name = p.name.getText();
    const def = p.initializer ? TransformUtil.toLiteral(p.initializer) : undefined;

    console.debug('COmputing Param', p.getText());

    let type = state.resolveType(p);
    let subtype;
    let meta;

    if (res.isUnionType(type)) {
      const choices = type.unionTypes
        .map(x => res.isRealType(x) ? x.value : undefined)
        .filter(x => x !== undefined);

      type = type.commonType!;
      subtype = 'choice';
      meta = { choices };
    } else if (res.isRealType(type)) {
      if (type.realType === String && /file$/i.test(name)) {
        subtype = 'file';
      }
    } else {
      type = { realType: String, name: 'string' } as res.RealType;
    }

    return { name, type: type.name!, subtype, meta, optional: def || type.undefinable, def };
  }

  @OnClass('trv/app/Application')
  static handleClass(state: TransformerState, node: ts.ClassDeclaration, dm?: DecoratorMeta) {
    console.debug('COmputing App', dm?.dec?.getText());

    const dec = dm?.dec;

    if (dec && ts.isCallExpression(dec.expression)) { // Constructor

      const [runMethod] = node.members
        .filter(x => ts.isMethodDeclaration(x))
        .filter(x => x.name!.getText() === 'run') as ts.MethodDeclaration[];

      if (runMethod) {
        const outParams = runMethod.parameters.map(p => this.computeParam(state, p));

        const declArgs = [...dec.expression.arguments];

        if (dec.expression.arguments.length === 1) {
          declArgs.push(TransformUtil.fromLiteral({}));
        }

        dec.expression.arguments = ts.createNodeArray([
          ...declArgs,
          TransformUtil.fromLiteral(outParams)
        ]);

        const decls = node.decorators;
        return ts.updateClassDeclaration(node,
          decls,
          node.modifiers,
          node.name,
          node.typeParameters,
          ts.createNodeArray(node.heritageClauses),
          node.members
        );
      }
    }
    return node;
  }
}
