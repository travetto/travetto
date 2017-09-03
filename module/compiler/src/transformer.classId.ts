import * as ts from 'typescript';
import * as path from 'path';

const SEP = path.sep;
const RE_SEP = SEP === '/' ? '\\/' : SEP;
const SRC_RE = new RegExp(`${RE_SEP}src${RE_SEP}`, 'g');
const PATH_RE = new RegExp(RE_SEP, 'g');

function createStaticField(name: string, val: ts.Expression) {
  return ts.createProperty(
    undefined,
    [ts.createToken(ts.SyntaxKind.StaticKeyword)],
    name, undefined, undefined, val
  );
}

function visitNode<T extends ts.Node>(context: ts.TransformationContext, node: T, state: { file: string }): T {
  if (ts.isClassDeclaration(node)) {
    return ts.updateClassDeclaration(node,
      node.decorators,
      node.modifiers,
      node.name,
      node.typeParameters,
      ts.createNodeArray(node.heritageClauses),
      ts.createNodeArray([
        createStaticField('__filename', ts.createIdentifier('__filename')),
        createStaticField('__id', ts.createLiteral(state.file + '#' + node.name!.getText())),

        ...node.members
      ])
    ) as any;
  }
  return ts.visitEachChild(node, c => visitNode(context, c, state), context);
}

export const ClassIdTransformer = {
  transformer: (context: ts.TransformationContext) =>
    (file: ts.SourceFile) => {
      let fileRoot = file.fileName.split(process.cwd())[1]
        .replace(SRC_RE, SEP)
        .replace(PATH_RE, '.')
        .replace(/^\./, '')
        .replace(/\.(t|j)s$/, '');
      return visitNode(context, file, { file: fileRoot })
    },
  phase: 'before'
}