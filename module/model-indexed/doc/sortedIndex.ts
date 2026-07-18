import { Model } from '@travetto/model';
import { sortedIndex } from '@travetto/model-indexed';

@Model()
export class User {
  id: string;
  name: string;
  age: number;
  createdAt: Date;
}

export const usersByNameAge = sortedIndex(User, {
  name: 'usersByNameAge',
  key: { name: true },
  sort: { age: 1 } // 1 for ascending, -1 for descending
});

export const recentUsers = sortedIndex(User, {
  name: 'recentUsers',
  key: {}, // No key filtering
  sort: { createdAt: -1 } // Most recent first
});
