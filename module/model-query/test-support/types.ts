import { Precision, Schema, Text } from '@travetto/schema';

import { Model, BaseModel, ModelType } from '@travetto/model';
import { Point } from '../src/model/where-clause';

@Schema()
export class Address {
  @Text() street1: string;
  @Text() street2?: string;
}

@Model()
export class Person extends BaseModel {
  @Text() name: string;
  @Precision(3, 0)
  age: number;
  gender: 'm' | 'f';
  address: Address;
}

@Model()
export class Simple {
  id?: string;
  name: string;
}

@Model()
export class SimpleList {
  id?: string;
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
  id?: string;
  point: Point;
}

@Model()
export class Region {
  id?: string;
  points: Point[];
}