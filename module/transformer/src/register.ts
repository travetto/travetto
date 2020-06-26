import * as ts from 'typescript';
import { DecoratorMeta, NodeTransformer, State } from './types/visitor';

const HANDLERS = Symbol.for('@trv:transformer/handlers');

/**
 * Get all transformers
 * @param obj Object to search for transformers
 */
export function getAllTransformers(obj: any) {
  return Object.values(obj).flatMap(x => (x as any)[HANDLERS] as NodeTransformer[] ?? []);
}

// Store handlers in class
function storeHandler(cls: any, handler: NodeTransformer) {
  cls[HANDLERS] = cls[HANDLERS] ?? [];
  cls[HANDLERS].push(handler);
}

/**
 * Listens for a `ts.CallExpression`, on descent
 */
export function OnCall(target?: string | string[]) {
  return <S extends State = State, R extends ts.Node = ts.Node>(
    inst: any, __: any, d: TypedPropertyDescriptor<(state: S, node: ts.CallExpression) => R>
  ) => storeHandler(inst, { before: d.value?.bind(inst), type: 'call', target });
}

/**
 * Listens for a `ts.FunctionDeclaration`, on descent
 */
export function OnFunction(target?: string | string[]) {
  return <S extends State = State, R extends ts.Node = ts.Node>(
    inst: any, __: any, d: TypedPropertyDescriptor<(state: S, node: ts.FunctionDeclaration) => R>
  ) => storeHandler(inst, { before: d.value?.bind(inst), type: 'function', target });
}

/**
 * Listens for a `ts.ParameterDeclaration`, on descent
 */
export function OnParameter(target?: string | string[]) {
  return <S extends State = State, R extends ts.Node = ts.Node>(
    inst: any, __: any, d: TypedPropertyDescriptor<(state: S, node: ts.ParameterDeclaration, dm?: DecoratorMeta) => R>
  ) => storeHandler(inst, { before: d.value?.bind(inst), type: 'parameter', target });
}

/**
 * Listens for a `ts.PropertyDeclaration`, on descent
 */
export function OnProperty(target?: string | string[]) {
  return <S extends State = State, R extends ts.Node = ts.Node>(
    inst: any, __: any, d: TypedPropertyDescriptor<(state: S, node: ts.PropertyDeclaration, dm?: DecoratorMeta) => R>
  ) => storeHandler(inst, { before: d.value?.bind(inst), type: 'property', target });
}

/**
 * Listens for a `ts.MethodDeclaration`, on descent
 */
export function OnMethod(target?: string | string[]) {
  return <S extends State = State, R extends ts.Node = ts.Node>(
    inst: any, __: any, d: TypedPropertyDescriptor<(state: S, node: ts.MethodDeclaration, dm?: DecoratorMeta) => R>
  ) => storeHandler(inst, { before: d.value?.bind(inst), type: 'method', target });
}

/**
 * Listens for a static `ts.MethodDeclaration`, on descent
 */
export function OnStaticMethod(target?: string | string[]) {
  return <S extends State = State, R extends ts.Node = ts.Node>(
    inst: any, __: any, d: TypedPropertyDescriptor<(state: S, node: ts.MethodDeclaration, dm?: DecoratorMeta) => R>
  ) => storeHandler(inst, { before: d.value?.bind(inst), type: 'static-method', target });
}

/**
 * Listens for a `ts.ClassDeclaration`, on descent
 */
export function OnClass(target?: string | string[]) {
  return <S extends State = State, R extends ts.Node = ts.Node>(
    inst: any, __: any, d: TypedPropertyDescriptor<(state: S, node: ts.ClassDeclaration, dm?: DecoratorMeta) => R>
  ) => storeHandler(inst, { before: d.value?.bind(inst), type: 'class', target });
}

/**
 * Listens for a `ts.CallExpression`, on ascent
 */
export function AfterCall(target?: string | string[]) {
  return <S extends State = State, R extends ts.Node = ts.Node>(
    inst: any, __: any, d: TypedPropertyDescriptor<(state: S, node: ts.CallExpression, dm?: DecoratorMeta) => R>
  ) => storeHandler(inst, { after: d.value?.bind(inst), type: 'call', target });
}

/**
 * Listens for a `ts.FunctionDeclaration`, on descent
 */
export function AfterFunction(target?: string | string[]) {
  return <S extends State = State, R extends ts.Node = ts.Node>(
    inst: any, __: any, d: TypedPropertyDescriptor<(state: S, node: ts.FunctionDeclaration) => R>
  ) => storeHandler(inst, { after: d.value?.bind(inst), type: 'function', target });
}

/**
 * Listens for a `ts.ParameterDeclaration`, on ascent
 */
export function AfterParameter(target?: string | string[]) {
  return <S extends State = State, R extends ts.Node = ts.Node>(
    inst: any, __: any, d: TypedPropertyDescriptor<(state: S, node: ts.ParameterDeclaration, dm?: DecoratorMeta) => R>
  ) => storeHandler(inst, { after: d.value?.bind(inst), type: 'parameter', target });
}

/**
 * Listens for a `ts.PropertyDeclaration`, on ascent
 */
export function AfterProperty(target?: string | string[]) {
  return <S extends State = State, R extends ts.Node = ts.Node>(
    inst: any, __: any, d: TypedPropertyDescriptor<(state: S, node: ts.PropertyDeclaration, dm?: DecoratorMeta) => R>
  ) => storeHandler(inst, { after: d.value?.bind(inst), type: 'property', target });
}

/**
 * Listens for a `ts.MethodDeclaration`, on ascent
 */
export function AfterMethod(target?: string | string[]) {
  return <S extends State = State, R extends ts.Node = ts.Node>(
    inst: any, __: any, d: TypedPropertyDescriptor<(state: S, node: ts.MethodDeclaration, dm?: DecoratorMeta) => R>
  ) => storeHandler(inst, { after: d.value?.bind(inst), type: 'method', target });
}

/**
 * Listens for a static `ts.MethodDeclaration`, on ascent
 */
export function AfterStaticMethod(target?: string | string[]) {
  return <S extends State = State, R extends ts.Node = ts.Node>(
    inst: any, __: any, d: TypedPropertyDescriptor<(state: S, node: ts.MethodDeclaration, dm?: DecoratorMeta) => R>
  ) => storeHandler(inst, { after: d.value?.bind(inst), type: 'static-method', target });
}

/**
 * Listens for a `ts.ClassDeclaration`, on ascent
 */
export function AfterClass(target?: string | string[]) {
  return <S extends State = State, R extends ts.Node = ts.Node>(
    inst: any, __: any, d: TypedPropertyDescriptor<(state: S, node: ts.ClassDeclaration, dm?: DecoratorMeta) => R>
  ) => storeHandler(inst, { after: d.value?.bind(inst), type: 'class', target });
}