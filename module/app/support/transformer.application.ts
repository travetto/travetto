import * as ts from 'typescript';

import {
  TransformUtil, TransformerState, DecoratorMeta, res, OnClass
} from '@travetto/compiler/src/transform-support';

export class ApplicationTransformer {

  static computeParam(state: TransformerState, p: ts.ParameterDeclaration) {
    const name = p.name.getText();
    const def = p.initializer ? TransformUtil.toLiteral(p.initializer) : undefined;

    let type = state.resolveType(p);
    let subtype;
    let meta;

    if (res.isUnionType(type)) {
      const choices = type.unionTypes
        .map(x => res.isLiteralType(x) ? x.value : undefined)
        .filter(x => x !== undefined);

      type = {
        ...type.commonType,
        name: type.name,
        undefinable: type.undefinable,
        comment: type.comment,
        nullable: type.nullable
      };
      subtype = 'choice';
      meta = { choices };
    } else if (res.isLiteralType(type)) {
      if (type.ctor === String && /file$/i.test(name)) {
        subtype = 'file';
      }
    } else {
      type = { ctor: String, name: 'string' } as res.LiteralType;
    }

    const ret = { name, type: type.name!, subtype, meta, optional: def !== undefined || type.undefinable || type.nullable, def };
    console.log('Compute Param', ret);
    return ret;
  }

  @OnClass('trv/app/Application')
  static handleClass(state: TransformerState, node: ts.ClassDeclaration, dm?: DecoratorMeta) {
    const dec = dm?.dec;

    if (!dec || !ts.isCallExpression(dec.expression)) { // If not valid
      return node;
    }

    // Find runnable method
    const runMethod = node.members
      .find(x =>
        ts.isMethodDeclaration(x) && x.name!.getText() === 'run'
      ) as ts.MethodDeclaration;

    if (!runMethod) {
      return node;
    }

    // Compute parameters
    const outParams = runMethod.parameters.map(p => this.computeParam(state, p));

    const declArgs = [...dec.expression.arguments];

    // Name only, need a config object
    if (declArgs.length === 1) {
      declArgs.push(TransformUtil.fromLiteral({}));
    }

    dec.expression.arguments = ts.createNodeArray([
      ...declArgs,
      TransformUtil.fromLiteral(outParams)
    ]);

    return ts.updateClassDeclaration(node,
      node.decorators,
      node.modifiers,
      node.name,
      node.typeParameters,
      ts.createNodeArray(node.heritageClauses),
      node.members
    );
  }
}
