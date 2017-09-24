import * as ts from 'typescript';
import * as path from 'path';
import { TransformUtil, Import, State } from '@encore2/compiler';

const SEP = path.sep;
const RE_SEP = SEP === '/' ? '\\/' : SEP;
const SRC_RE = new RegExp(`([^/]+)${RE_SEP}src${RE_SEP}`, 'g');
const PATH_RE = new RegExp(RE_SEP, 'g');

interface IState extends State {
  file: string;
  fullFile: string;
  imported?: ts.Identifier;
}

function createStaticField(name: string, val: ts.Expression) {
  return ts.createProperty(
    undefined,
    [ts.createToken(ts.SyntaxKind.StaticKeyword)],
    name, undefined, undefined, val
  );
}

function visitNode<T extends ts.Node>(context: ts.TransformationContext, node: T, state: IState): T {
  if (ts.isClassDeclaration(node)) {
    if (!state.imported) {
      state.imported = ts.createIdentifier(`import_Register`);
      state.newImports.push({
        ident: state.imported,
        path: require.resolve('../decorator/register')
      });
    }
    return ts.updateClassDeclaration(node,
      ts.createNodeArray([ts.createDecorator(ts.createCall(ts.createPropertyAccess(state.imported, ts.createIdentifier('Register')), undefined, [])), ...(node.decorators || [])]),
      node.modifiers,
      node.name,
      node.typeParameters,
      ts.createNodeArray(node.heritageClauses),
      ts.createNodeArray([
        createStaticField('__filename', ts.createLiteral(state.fullFile)),
        createStaticField('__id', ts.createLiteral(state.file + '#' + node.name!.getText())),
        ...node.members
      ])
    ) as any;
  }
  return ts.visitEachChild(node, c => visitNode(context, c, state), context);
}

export const ClassIdTransformer = {
  transformer: TransformUtil.importingVisitor<IState>((file: ts.SourceFile) => {

    let fileRoot = file.fileName.split(process.cwd() + SEP)[1];
    let ns = '@app';
    if (fileRoot.startsWith(`node_modules${SEP}`)) {
      fileRoot = fileRoot.split(`node_modules${SEP}`).pop()!;
      if (fileRoot.startsWith('@')) {
        let [ns1, ns2, ...rest] = fileRoot.split(SEP);
        ns = `${ns1}.${ns2}`;
        fileRoot = rest.join(SEP);
      }
    }

    fileRoot = fileRoot
      .replace(PATH_RE, '.')
      .replace(/^\./, '')
      .replace(/\.(t|j)s$/, '');

    return { file: `${ns}:${fileRoot}`, fullFile: file.fileName, newImports: [], imports: new Map() };
  }, visitNode),
  phase: 'before',
  priority: 1
}