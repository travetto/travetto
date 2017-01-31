import * as mongo from 'mongodb';

export interface Named {
  name: string;
  collection?: string;
};

export interface Base {
  _id: string;
}

export type IndexConfig = [any, mongo.IndexOptions];