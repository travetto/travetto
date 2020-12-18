import * as ts from 'typescript';
import { DecoratorMeta, NodeTransformer, State, TransformPhase, TransformerType, Transformer, TransformerId } from './types/visitor';

const HandlersProp = Symbol.for('@trv:transformer/handlers');

type TransformerWithHandlers = Transformer & { [HandlersProp]?: NodeTransformer[] };

/**
 * Get all transformers
 * @param obj Object to search for transformers
 */
export function getAllTransformers(obj: any) {
  return Object.values(obj).flatMap((x: any) => x[HandlersProp] as NodeTransformer[] ?? []);
}

// Store handlers in class
function storeHandler(cls: TransformerWithHandlers, fn: Function, phase: TransformPhase, type: TransformerType, target?: string[]) {
  if (target) {
    const ns = cls[TransformerId].split('/')[0]; // Everything before the '/'
    target = target.map(x => x.startsWith('@') ? x : `${ns}/${x}`);
  }
  cls[HandlersProp] = cls[HandlersProp] ?? [];
  cls[HandlersProp]!.push({ key: `${cls[TransformerId]}/${fn.name}`, [phase]: fn.bind(cls), type, target });
}

/**
 * Listens for a `ts.CallExpression`, on descent
 */
export function OnCall(...target: string[]) {
  return <S extends State = State, R extends ts.Node = ts.Node>(
    inst: Transformer, __: any, d: TypedPropertyDescriptor<(state: S, node: ts.CallExpression) => R>
  ) => storeHandler(inst, d.value!, 'before', 'call', target);
}

/**
 * Listens for a `ts.FunctionDeclaration`, on descent
 */
export function OnFunction(...target: string[]) {
  return <S extends State = State, R extends ts.Node = ts.Node>(
    inst: Transformer, __: any, d: TypedPropertyDescriptor<(state: S, node: ts.FunctionDeclaration | ts.FunctionExpression) => R>
  ) => storeHandler(inst, d.value!, 'before', 'function', target);
}

/**
 * Listens for a `ts.ParameterDeclaration`, on descent
 */
export function OnParameter(...target: string[]) {
  return <S extends State = State, R extends ts.Node = ts.Node>(
    inst: Transformer, __: any, d: TypedPropertyDescriptor<(state: S, node: ts.ParameterDeclaration, dm?: DecoratorMeta) => R>
  ) => storeHandler(inst, d.value!, 'before', 'parameter', target);
}

/**
 * Listens for a `ts.PropertyDeclaration`, on descent
 */
export function OnProperty(...target: string[]) {
  return <S extends State = State, R extends ts.Node = ts.Node>(
    inst: Transformer, __: any, d: TypedPropertyDescriptor<(state: S, node: ts.PropertyDeclaration, dm?: DecoratorMeta) => R>
  ) => storeHandler(inst, d.value!, 'before', 'property', target);
}

/**
 * Listens for a `ts.MethodDeclaration`, on descent
 */
export function OnMethod(...target: string[]) {
  return <S extends State = State, R extends ts.Node = ts.Node>(
    inst: Transformer, __: any, d: TypedPropertyDescriptor<(state: S, node: ts.MethodDeclaration, dm?: DecoratorMeta) => R>
  ) => storeHandler(inst, d.value!, 'before', 'method', target);
}

/**
 * Listens for a static `ts.MethodDeclaration`, on descent
 */
export function OnStaticMethod(...target: string[]) {
  return <S extends State = State, R extends ts.Node = ts.Node>(
    inst: Transformer, __: any, d: TypedPropertyDescriptor<(state: S, node: ts.MethodDeclaration, dm?: DecoratorMeta) => R>
  ) => storeHandler(inst, d.value!, 'before', 'static-method', target);
}

/**
 * Listens for a `ts.ClassDeclaration`, on descent
 */
export function OnClass(...target: string[]) {
  return <S extends State = State, R extends ts.Node = ts.Node>(
    inst: Transformer, __: any, d: TypedPropertyDescriptor<(state: S, node: ts.ClassDeclaration, dm?: DecoratorMeta) => R>
  ) => storeHandler(inst, d.value!, 'before', 'class', target);
}

/**
 * Listens for a `ts.CallExpression`, on ascent
 */
export function AfterCall(...target: string[]) {
  return <S extends State = State, R extends ts.Node = ts.Node>(
    inst: Transformer, __: any, d: TypedPropertyDescriptor<(state: S, node: ts.CallExpression, dm?: DecoratorMeta) => R>
  ) => storeHandler(inst, d.value!, 'after', 'call', target);
}

/**
 * Listens for a `ts.FunctionDeclaration`, on descent
 */
export function AfterFunction(...target: string[]) {
  return <S extends State = State, R extends ts.Node = ts.Node>(
    inst: Transformer, __: any, d: TypedPropertyDescriptor<(state: S, node: ts.FunctionDeclaration | ts.FunctionExpression) => R>
  ) => storeHandler(inst, d.value!, 'after', 'function', target);
}

/**
 * Listens for a `ts.ParameterDeclaration`, on ascent
 */
export function AfterParameter(...target: string[]) {
  return <S extends State = State, R extends ts.Node = ts.Node>(
    inst: Transformer, __: any, d: TypedPropertyDescriptor<(state: S, node: ts.ParameterDeclaration, dm?: DecoratorMeta) => R>
  ) => storeHandler(inst, d.value!, 'after', 'parameter', target);
}

/**
 * Listens for a `ts.PropertyDeclaration`, on ascent
 */
export function AfterProperty(...target: string[]) {
  return <S extends State = State, R extends ts.Node = ts.Node>(
    inst: Transformer, __: any, d: TypedPropertyDescriptor<(state: S, node: ts.PropertyDeclaration, dm?: DecoratorMeta) => R>
  ) => storeHandler(inst, d.value!, 'after', 'property', target);
}

/**
 * Listens for a `ts.MethodDeclaration`, on ascent
 */
export function AfterMethod(...target: string[]) {
  return <S extends State = State, R extends ts.Node = ts.Node>(
    inst: Transformer, __: any, d: TypedPropertyDescriptor<(state: S, node: ts.MethodDeclaration, dm?: DecoratorMeta) => R>
  ) => storeHandler(inst, d.value!, 'after', 'method', target);
}

/**
 * Listens for a static `ts.MethodDeclaration`, on ascent
 */
export function AfterStaticMethod(...target: string[]) {
  return <S extends State = State, R extends ts.Node = ts.Node>(
    inst: Transformer, __: any, d: TypedPropertyDescriptor<(state: S, node: ts.MethodDeclaration, dm?: DecoratorMeta) => R>
  ) => storeHandler(inst, d.value!, 'after', 'static-method', target);
}

/**
 * Listens for a `ts.ClassDeclaration`, on ascent
 */
export function AfterClass(...target: string[]) {
  return <S extends State = State, R extends ts.Node = ts.Node>(
    inst: Transformer, __: any, d: TypedPropertyDescriptor<(state: S, node: ts.ClassDeclaration, dm?: DecoratorMeta) => R>
  ) => storeHandler(inst, d.value!, 'after', 'class', target);
}