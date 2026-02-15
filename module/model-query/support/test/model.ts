import { Precision, Schema, Text, type Point } from '@travetto/schema';
import { Model, type ModelType } from '@travetto/model';

@Schema()
export class Address {
  @Text() street1: string;
  @Text() street2?: string;
}

@Model('query-todo-version')
export class Todo {
  version = 0;
  id: string;
  @Text() text: string;
}

@Model('query-person')
export class Person {
  id: string;
  @Text() name: string;
  @Precision(3, 0)
  age: number;
  gender: 'm' | 'f';
  address: Address;
}

@Model('query-simple')
export class Simple {
  id: string;
  name: string;
}

@Model('query-simple-list')
export class SimpleList {
  id: string;
  names: string[];
  simples?: Simple[];
}

@Model()
export class Names {
  id: string;
  values: string[];
}

@Schema()
export class NoteEntity {
  @Text()
  label: string;
  id: string;
}

@Model()
export class Note implements ModelType {
  id: string;
  entities?: NoteEntity[];
}

@Model()
export class Location {
  id: string;
  point: Point;
}

@Model()
export class Region {
  id: string;
  points: Point[];
}

@Model()
export class Aged {
  id: string;
  createdAt: Date;
}

@Model()
export class WithNestedLists {
  id: string;
  tags?: string[] = [];
  names?: string[] = [];
}

@Schema()
class NamedSubNested {
  names?: string[] = [];
}

@Model()
export class WithNestedNestedLists {
  id: string;
  tags?: string[] = [];
  sub?: NamedSubNested;
}

@Model('bigint-model-2')
export class BigIntModel {
  id: string;
  largeNumber: bigint;
  optionalBigInt?: bigint;
}