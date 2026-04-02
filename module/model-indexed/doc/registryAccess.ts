import { ModelRegistryIndex } from '@travetto/model';
import { Model } from '@travetto/model';

@Model()
export class User {
  id: string;
  name: string;
}

export function registryAccessExample() {
  const registry = ModelRegistryIndex.get(User);
  const indexes = registry.indices; // Map of all indexes for the model

  // Access a specific index
  const userByName = indexes['userByName'];
  return userByName;
}
