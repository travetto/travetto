import * as ts from 'typescript';

import { FsUtil, RegisterUtil } from '@travetto/boot';
import { Util } from '@travetto/base';
import { TransformUtil, TransformerState } from '@travetto/compiler';

interface IState extends TransformerState {
  module: string;
  file: string;
}

const REGISTER_MOD = require.resolve('../src/decorator');

function visitNode<T extends ts.Node>(context: ts.TransformationContext, node: T, state: IState): T {
  if (state.path === REGISTER_MOD) { // Cannot process self
    return node;
  }

  if (ts.isClassDeclaration(node) && node.name && node.parent && ts.isSourceFile(node.parent)) {
    const methods: any = {};

    for (const child of node.members) {
      if (ts.isMethodDeclaration(child)) {
        const hash = Util.naiveHash(child.getText());

        const conf: any = {
          hash
        };

        methods[child.name.getText()] = conf;
      }
    }

    const isAbstract = (node.modifiers! || []).filter(x => x.kind === ts.SyntaxKind.AbstractKeyword).length > 0;

    const ret = ts.updateClassDeclaration(node,
      ts.createNodeArray([
        TransformUtil.createDecorator(state, REGISTER_MOD, 'Register')
        , ...(node.decorators || [])]),
      node.modifiers,
      node.name,
      node.typeParameters,
      ts.createNodeArray(node.heritageClauses),
      ts.createNodeArray([
        TransformUtil.createStaticField('__filename', FsUtil.toUnix(state.file)),
        TransformUtil.createStaticField('__id', `${state.module}#${node.name!.getText()}`),
        TransformUtil.createStaticField('__hash', Util.naiveHash(node.getText())),
        TransformUtil.createStaticField('__methods', TransformUtil.extendObjectLiteral(methods)),
        TransformUtil.createStaticField('__abstract', TransformUtil.fromLiteral(isAbstract)),
        ...node.members
      ])
    ) as any;

    ret.parent = node.parent;

    for (const el of ret.members) {
      if (!el.parent) {
        el.parent = ret;
      }
    }

    return ret;
  }
  return ts.visitEachChild(node, c => visitNode(context, c, state), context);
}

export const ClassMetadataTransformer = {
  transformer: TransformUtil.importingVisitor<IState>((file: ts.SourceFile) => ({
    module: RegisterUtil.computeModuleFromFile(file.fileName),
    file: file.fileName
  }), visitNode),
  phase: 'before',
  key: 'registry',
};