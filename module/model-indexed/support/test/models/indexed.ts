import { Model } from '@travetto/model';
import { Schema } from '@travetto/schema';

import { keyedIndex, sortedIndex, uniqueIndex } from '../../../src/indexes.ts';

@Model('index_user')
export class User {
  id: string;
  name: string;
}

export const userNameIndex = keyedIndex(User, {
  name: 'userName',
  key: { name: true }
});

@Model('index_unique_user')
export class UniqueUser {
  id: string;
  name: string;
}

export const userUniqueNameIndex = uniqueIndex(UniqueUser, {
  name: 'userUniqueName',
  key: { name: true }
});

@Model('index_user_2')
export class User2 {
  id: string;
  name: string;
}

@Model()
export class User3 {
  id: string;
  name: string;
  age: number;
  color?: string;
}

export const userAgeIndex = sortedIndex(User3, {
  name: 'userAge',
  key: { name: true },
  sort: { age: 1 }
});
export const userAgeReversedIndex = sortedIndex(User3, {
  name: 'userAgeReverse',
  key: { name: true },
  sort: { age: -1 }
});
export const userAgeNoKeyIndex = sortedIndex(User3, {
  name: 'userAgeNoKey',
  key: {},
  sort: { age: 1 }
});

@Schema()
export class Child {
  name: string;
  age: number;
}

@Model()
export class User4 {
  id: string;
  createdDate?: Date = new Date();
  color: string;
  child: Child;
}

export const childAgeIndex = sortedIndex(User4, {
  name: 'childAge',
  key: { child: { name: true } },
  sort: { child: { age: 1 } }
});

export const nameCreatedIndex = sortedIndex(User4, {
  name: 'nameCreated',
  key: { child: { name: true } },
  sort: { createdDate: 1 }
});
