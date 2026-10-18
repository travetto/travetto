import { Model, TransientField, type ModelId } from '@travetto/model';
import { Schema } from '@travetto/schema';

import { keyedIndex, sortedIndex, uniqueIndex } from '../../../src/indexes.ts';

@Model('index_user')
export class User {
  id: ModelId;
  name: string;
}

export const userNameIndex = keyedIndex(User, {
  name: 'userName',
  key: { name: true }
});

@Model('index_unique_user')
export class UniqueUser {
  id: ModelId;
  name: string;
}

export const userUniqueNameIndex = uniqueIndex(UniqueUser, {
  name: 'userUniqueName',
  key: { name: true }
});

@Model('index_user_2')
export class User2 {
  id: ModelId;
  name: string;
}

@Model()
export class User3 {
  id: ModelId;
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
  id: ModelId;
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

@Model('computed_indexed_user')
export class ComputedIndexedUser {
  id: ModelId;
  name: string;
  get nameUppercase(): string {
    return this.name.toUpperCase();
  }
}

export const computedNameIndex = keyedIndex(ComputedIndexedUser, {
  name: 'computedName',
  key: { nameUppercase: true }
});

@Model('transient_indexed_user')
export class TransientIndexedUser {
  id: ModelId;
  @TransientField()
  name?: string;
}

export const transientNameIndex = keyedIndex(TransientIndexedUser, {
  name: 'transientName',
  key: { name: true }
});
