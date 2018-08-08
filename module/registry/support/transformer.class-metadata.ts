import * as path from 'path';

import { Env } from '@travetto/base/src/env';
import { TransformUtil, TransformerState } from '@travetto/compiler';

const stringHash = require('string-hash');

interface IState extends TransformerState {
  file: string;
  fullFile: string;
}

const REGISTER_MOD = require.resolve('../src/decorator/register');

function visitNode<T extends ts.Node>(context: ts.TransformationContext, node: T, state: IState): T {
  if (state.path === REGISTER_MOD) { // Cannot process self
    return node;
  }

  if (ts.isClassDeclaration(node) && node.name && node.parent && ts.isSourceFile(node.parent)) {
    const methods: any = {};

    for (const child of node.members) {
      if (ts.isMethodDeclaration(child)) {
        const hash = stringHash(child.getText());

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
        TransformUtil.createStaticField('__filename', state.fullFile.replace(/[\\\/]/g, path.sep)),
        TransformUtil.createStaticField('__id', `${state.file}#${node.name!.getText()}`),
        TransformUtil.createStaticField('__hash', stringHash(node.getText())),
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
  transformer: TransformUtil.importingVisitor<IState>((file: ts.SourceFile) => {
    let fileRoot = file.fileName.replace(/[\\\/]/g, path.sep);

    let ns = '@sys';

    if (fileRoot.includes(Env.cwd)) {
      fileRoot = fileRoot.split(Env.cwd)[1].replace(/^[\\\/]+/, '');
      ns = '@app';
      if (fileRoot.startsWith('node_modules')) {
        fileRoot = fileRoot.split('node_modules').pop()!.replace(/^[\\\/]+/, '');
        if (fileRoot.startsWith('@')) {
          const [ns1, ns2, ...rest] = fileRoot.split(/[\\\/]/);
          ns = `${ns1}.${ns2}`;
          fileRoot = rest.join('.');
        }
      }
    }

    fileRoot = fileRoot
      .replace(/[\\\/]+/g, '.')
      .replace(/^\./, '')
      .replace(/\.(t|j)s$/, '');

    return { file: `${ns}:${fileRoot}`, fullFile: file.fileName };
  }, visitNode),
  phase: 'before',
  priority: 0
};