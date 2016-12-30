import { Startup } from '@encore/lifecycle';
import { beforeAll } from '@encore/test';
import { MongoService } from '@encore/mongo';

beforeAll(async () => {
  await Startup.onStartupPromise();
  await MongoService.resetDatabase();
});