import * as ts from 'typescript';
import { AnyType, DeclarationUtil, DecoratorUtil, DocUtil, ParamDocumentation, TransformerId, TransformerState } from '@travetto/transformer';

const SCHEMA_MOD = '@travetto/schema/src/decorator/schema';
const FIELD_MOD = '@travetto/schema/src/decorator/field';
const COMMON_MOD = '@travetto/schema/src/decorator/common';

export class SchemaTransformUtil {

  /**
   * Produce concrete type given transformer type
   */
  static toConcreteType(state: TransformerState, type: AnyType, node: ts.Node, root: ts.Node = node): ts.Expression {
    switch (type.key) {
      case 'pointer': return this.toConcreteType(state, type.target, node, root);
      case 'external': return state.getOrImport(type);
      case 'tuple': return state.fromLiteral(type.subTypes.map(x => this.toConcreteType(state, x, node, root)!));
      case 'literal': {
        if ((type.ctor === Array || type.ctor === Set) && type.typeArguments?.length) {
          return state.fromLiteral([this.toConcreteType(state, type.typeArguments[0], node, root)]);
        } else if (type.ctor) {
          return state.createIdentifier(type.ctor.name!);
        }
        break;
      }
      case 'shape': {
        const uniqueId = state.generateUniqueIdentifier(node, type);

        // Build class on the fly
        const [id, existing] = state.createSyntheticIdentifier(uniqueId);
        if (!existing) {
          const cls = state.factory.createClassDeclaration(
            [
              state.createDecorator(SCHEMA_MOD, 'Schema'),
              state.createDecorator(COMMON_MOD, 'Describe',
                state.fromLiteral({
                  title: type.name,
                  description: type.comment
                })
              )
            ],
            [], id, [], [],
            Object.entries(type.fieldTypes).map(([k, v]) =>
              this.computeField(state, state.factory.createPropertyDeclaration(
                [], [], k,
                v.undefinable || v.nullable ? state.factory.createToken(ts.SyntaxKind.QuestionToken) : undefined,
                undefined, undefined
              ), { type: v, root })
            )
          );
          cls.getText = (): string => '';
          state.addStatement(cls, root || node);
        }
        return id;
      }
      case 'union': {
        if (type.commonType) {
          return this.toConcreteType(state, type.commonType, node, root);
        }
        break;
      }
      case 'unknown':
      default: {
        // Object
      }
    }
    return state.createIdentifier('Object');
  }

  /**
   * Compute property information from declaration
   */
  static computeField<T extends ts.PropertyDeclaration | ts.ParameterDeclaration | ts.GetAccessorDeclaration | ts.SetAccessorDeclaration>(
    state: TransformerState, node: T, config: { type?: AnyType, root?: ts.Node, name?: string } = { root: node }
  ): T {

    const typeExpr = config.type ?? state.resolveType(ts.isSetAccessor(node) ? node.parameters[0] : node);
    const attrs: ts.PropertyAssignment[] = [];

    if (!ts.isGetAccessorDeclaration(node) && !ts.isSetAccessorDeclaration(node)) {
      // eslint-disable-next-line no-bitwise
      if ((ts.getCombinedModifierFlags(node) & ts.ModifierFlags.Readonly) > 0) {
        attrs.push(state.factory.createPropertyAssignment('mode', state.fromLiteral('readonly')));
      } else if (!node.questionToken && !typeExpr.undefinable && !node.initializer) {
        attrs.push(state.factory.createPropertyAssignment('required', state.fromLiteral({ active: true })));
      }
      if (node.initializer && ts.isLiteralExpression(node.initializer)) {
        attrs.push(state.factory.createPropertyAssignment('default', node.initializer));
      }
    } else {
      const acc = DeclarationUtil.getAccessorPair(node);
      if (!acc.setter) {
        attrs.push(state.factory.createPropertyAssignment('access', state.fromLiteral('readonly')));
      }
      if (!acc.getter) {
        attrs.push(state.factory.createPropertyAssignment('mode', state.fromLiteral('writeonly')));
      } else if (!typeExpr.undefinable) {
        attrs.push(state.factory.createPropertyAssignment('required', state.fromLiteral({ active: true })));
      }
    }

    if (ts.isParameter(node) || config.name !== undefined) {
      attrs.push(state.factory.createPropertyAssignment('name', state.factory.createStringLiteral(
        config.name !== undefined ? config.name : node.name.getText())
      ));
    }

    // If we have a union type
    if (typeExpr.key === 'union') {
      const values = typeExpr.subTypes.map(x => x.key === 'literal' ? x.value : undefined)
        .filter(x => x !== undefined && x !== null);

      if (values.length === typeExpr.subTypes.length) {
        attrs.push(state.factory.createPropertyAssignment('enum', state.fromLiteral({
          values,
          message: `{path} is only allowed to be "${values.join('" or "')}"`
        })));
      }
    }

    if (ts.isParameter(node)) {
      const comments = DocUtil.describeDocs(node.parent);
      const commentConfig: Partial<ParamDocumentation> = (comments.params ?? []).find(x => x.name === node.name.getText()) || {};
      if (commentConfig.description) {
        attrs.push(state.factory.createPropertyAssignment('description', state.fromLiteral(commentConfig.description)));
      }
    }

    const params: ts.Expression[] = [];

    const existing = state.findDecorator({ [TransformerId]: '@trv:schema', name: 'util' }, node, 'Field', FIELD_MOD);
    if (!existing) {
      const resolved = this.toConcreteType(state, typeExpr, node, config.root);
      params.push(resolved);
    } else {
      params.push(...DecoratorUtil.getArguments(existing) ?? []);
    }

    if (attrs.length) {
      params.push(state.factory.createObjectLiteralExpression(attrs));
    }

    const newDecs = [
      ...(node.decorators ?? []).filter(x => x !== existing),
      state.createDecorator(FIELD_MOD, 'Field', ...params)
    ];

    if (ts.isPropertyDeclaration(node)) {
      const comments = DocUtil.describeDocs(node);
      if (comments.description) {
        newDecs.push(state.createDecorator(COMMON_MOD, 'Describe', state.fromLiteral({
          description: comments.description
        })));
      }

      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      return state.factory.updatePropertyDeclaration(node as Exclude<typeof node, T>,
        newDecs, node.modifiers, node.name, node.questionToken, node.type, node.initializer) as T;
    } else if (ts.isParameter(node)) {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      return state.factory.updateParameterDeclaration(node as Exclude<typeof node, T>,
        newDecs, node.modifiers, node.dotDotDotToken, node.name, node.questionToken, node.type, node.initializer) as T;
    } else if (ts.isGetAccessorDeclaration(node)) {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      return state.factory.updateGetAccessorDeclaration(node as Exclude<typeof node, T>,
        newDecs, node.modifiers, node.name, node.parameters, node.type, node.body) as T;
    } else {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      return state.factory.updateSetAccessorDeclaration(node as Exclude<typeof node, T>,
        newDecs, node.modifiers, node.name, node.parameters, node.body) as T;
    }
  }

  /**
   * Unwrap type
   */
  static unwrapType(type: AnyType): { out: Record<string, unknown>, type: AnyType } {
    const out: Record<string, unknown> = {};

    while (type?.key === 'literal' && type.typeArguments?.length) {
      if (type.ctor === Array || type.ctor === Set) {
        out.array = true;
      }
      type = type.typeArguments?.[0] ?? { key: 'literal', ctor: Object }; // We have a promise nested
    }
    return { out, type };
  }

  /**
   * Ensure type
   * @param state
   * @param node
   */
  static ensureType(state: TransformerState, anyType: AnyType, target: ts.Node): Record<string, unknown> {
    const { out, type } = this.unwrapType(anyType);
    switch (type?.key) {
      case 'external': out.type = state.typeToIdentifier(type); break;
      case 'shape': out.type = SchemaTransformUtil.toConcreteType(state, type, target); break;
      case 'literal': {
        if (type.ctor) {
          out.type = out.array ?
            SchemaTransformUtil.toConcreteType(state, type, target) :
            state.factory.createIdentifier(type.ctor.name);
        }
      }
    }
    return out;
  }

  /**
   * Find inner return method
   * @param state
   * @param node
   * @param methodName
   * @returns
   */
  static findInnerReturnMethod(state: TransformerState, node: ts.MethodDeclaration, methodName: string): ts.MethodDeclaration | undefined {
    // Process returnType
    const { type } = this.unwrapType(state.resolveReturnType(node));
    let cls;
    switch (type?.key) {
      case 'external': {
        const [dec] = DeclarationUtil.getDeclarations(type.original!);
        cls = dec && ts.isClassDeclaration(dec) ? dec : undefined;
        break;
      }
      case 'shape': cls = type.original; break;
    }
    if (cls) {
      return state.findMethodByName(cls, methodName);
    }
  }
}