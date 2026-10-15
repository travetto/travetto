import { Model, type ModelId, type ModelType } from '@travetto/model';
import { LongText, type Point, Precision, Schema, Text } from '@travetto/schema';

@Schema()
export class Address {
  @Text() street1: string;
  @Text() street2?: string;
}

@Model('query-todo-version')
export class Todo {
  version = 0;
  id: ModelId;
  @Text() text: string;
}

@Model('query-person')
export class Person {
  id: ModelId;
  @Text() name: string;
  @Precision(3, 0)
  age: number;
  gender: 'm' | 'f';
  address: Address;
}

@Model('query-simple')
export class Simple {
  id: ModelId;
  name: string;
}

@Model('query-simple-list')
export class SimpleList {
  id: ModelId;
  names: string[];
  simples?: Simple[];
}

@Model()
export class Names {
  id: ModelId;
  values: string[];
}

@Schema()
export class NoteEntity {
  @Text()
  label: string;
  id: ModelId;
}

@Model()
export class Note implements ModelType {
  id: ModelId;
  entities?: NoteEntity[];
}

@Model()
export class Location {
  id: ModelId;
  point: Point;
}

@Model()
export class Region {
  id: ModelId;
  points: Point[];
}

@Model()
export class Aged {
  id: ModelId;
  createdAt: Date;
}

@Model()
export class MultiFieldModel {
  id: ModelId;
  createdAt: Date;
  score: number;
}

@Model()
export class WithNestedLists {
  id: ModelId;
  tags?: string[] = [];
  names?: string[] = [];
}

@Schema()
class NamedSubNested {
  names?: string[] = [];
}

@Model()
export class WithNestedNestedLists {
  id: ModelId;
  tags?: string[] = [];
  sub?: NamedSubNested;
}

@Model('bigint-model-2')
export class BigIntModel {
  id: ModelId;
  largeNumber: bigint;
  optionalBigInt?: bigint;
}

@Schema()
export class Child {
  name: string;
}

@Schema()
export class Family {
  children?: Child[];
}

@Model()
export class PersonFamily implements ModelType {
  id: ModelId;
  family?: Family;
}

@Schema()
export class RecipeIngredient {
  name: string;
}

@Schema()
export class RecipeSection {
  ingredients: RecipeIngredient[] = [];
}

@Model()
export class Recipe implements ModelType {
  id: ModelId;
  sections: RecipeSection[] = [];
}

@Model('query-article')
export class Article implements ModelType {
  id: ModelId;
  @Text() title: string;
  @LongText() content: string;
  status: 'draft' | 'published';
}
