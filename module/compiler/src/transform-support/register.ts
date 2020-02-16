import * as ts from 'typescript';
import { NodeTransformer, State } from './types/visitor';
import { DecoratorMeta } from './types/decorator';

const HANDLERS = Symbol('handlers');

export function getTransformHandlers(cls: any): NodeTransformer[] {
  return cls[HANDLERS];
}

function storeHandler(cls: any, handler: NodeTransformer) {
  cls[HANDLERS] = cls[HANDLERS] || [];
  cls[HANDLERS].push(handler);
}

export function OnCall(target?: string | string[]) {
  return <S extends State = State, R extends ts.Node = ts.Node>(
    inst: any, _: any, d: TypedPropertyDescriptor<(state: S, node: ts.CallExpression, dm?: DecoratorMeta) => R>
  ) => storeHandler(inst, { before: d.value?.bind(inst), type: 'call', target });
}

export function OnProperty(target?: string | string[]) {
  return <S extends State = State, R extends ts.Node = ts.Node>(
    inst: any, _: any, d: TypedPropertyDescriptor<(state: S, node: ts.PropertyDeclaration, dm?: DecoratorMeta) => R>
  ) => storeHandler(inst, { before: d.value?.bind(inst), type: 'property', target });
}

export function OnMethod(target?: string | string[]) {
  return <S extends State = State, R extends ts.Node = ts.Node>(
    inst: any, _: any, d: TypedPropertyDescriptor<(state: S, node: ts.MethodDeclaration, dm?: DecoratorMeta) => R>
  ) => storeHandler(inst, { before: d.value?.bind(inst), type: 'method', target });
}

export function OnStaticMethod(target?: string | string[]) {
  return <S extends State = State, R extends ts.Node = ts.Node>(
    inst: any, _: any, d: TypedPropertyDescriptor<(state: S, node: ts.MethodDeclaration, dm?: DecoratorMeta) => R>
  ) => storeHandler(inst, { before: d.value?.bind(inst), type: 'static-method', target });
}

export function OnClass(target?: string | string[]) {
  return <S extends State = State, R extends ts.Node = ts.Node>(
    inst: any, _: any, d: TypedPropertyDescriptor<(state: S, node: ts.ClassDeclaration, dm?: DecoratorMeta) => R>
  ) => storeHandler(inst, { before: d.value?.bind(inst), type: 'class', target });
}

export function AfterCall(target?: string | string[]) {
  return <S extends State = State, R extends ts.Node = ts.Node>(
    inst: any, _: any, d: TypedPropertyDescriptor<(state: S, node: ts.CallExpression, dm?: DecoratorMeta) => R>
  ) => storeHandler(inst, { after: d.value?.bind(inst), type: 'call', target });
}

export function AfterProperty(target?: string | string[]) {
  return <S extends State = State, R extends ts.Node = ts.Node>(
    inst: any, _: any, d: TypedPropertyDescriptor<(state: S, node: ts.PropertyDeclaration, dm?: DecoratorMeta) => R>
  ) => storeHandler(inst, { after: d.value?.bind(inst), type: 'property', target });
}

export function AfterMethod(target?: string | string[]) {
  return <S extends State = State, R extends ts.Node = ts.Node>(
    inst: any, _: any, d: TypedPropertyDescriptor<(state: S, node: ts.MethodDeclaration, dm?: DecoratorMeta) => R>
  ) => storeHandler(inst, { after: d.value?.bind(inst), type: 'method', target });
}

export function AfterStaticMethod(target?: string | string[]) {
  return <S extends State = State, R extends ts.Node = ts.Node>(
    inst: any, _: any, d: TypedPropertyDescriptor<(state: S, node: ts.MethodDeclaration, dm?: DecoratorMeta) => R>
  ) => storeHandler(inst, { after: d.value?.bind(inst), type: 'static-method', target });
}

export function AfterClass(target?: string | string[]) {
  return <S extends State = State, R extends ts.Node = ts.Node>(
    inst: any, _: any, d: TypedPropertyDescriptor<(state: S, node: ts.ClassDeclaration, dm?: DecoratorMeta) => R>
  ) => storeHandler(inst, { after: d.value?.bind(inst), type: 'class', target });
}