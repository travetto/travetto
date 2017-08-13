import * as ts from 'typescript';

export const Transformer =
  (context: ts.TransformationContext) =>
    (file: ts.SourceFile) =>
      visitNode(context, file);

let inSchema: boolean[] = [];

function visitNode(context: ts.TransformationContext, node: ts.Node): ts.Node {
  //const typeChecker = program.getTypeChecker();
  if (ts.isClassDeclaration(node)) {
    let decs = (node.decorators || [] as any as ts.NodeArray<ts.Decorator>).filter(d => !!d.expression);
    if (decs && decs.length && decs.find(d => d.expression.getText().trim() === 'AutoSchema')) {
      inSchema.unshift(true);
    } else {
      inSchema.unshift(false);
    }
    ts.visitEachChild(node, c => visitNode(context, c), context);
    inSchema.shift();
    return node;
  } else if (ts.isPropertyDeclaration(node) && inSchema[0] && !node.decorators!.find(x => x.expression.getText() === 'Ignore')) {
    node.decorators = node.decorators || [] as any;
    node.decorators!.unshift(ts.createDecorator(ts.createCall(ts.createIdentifier('AutoSchema'), undefined, [])))
    console.log("Auto Schema", node.name.getText(), node.type!.getText());
  }
  ts.visitEachChild(node, c => visitNode(context, c), context);
  return node;
}

