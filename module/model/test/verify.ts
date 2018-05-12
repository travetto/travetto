import { Suite, Test, BeforeAll } from '@travetto/test';
import { Model } from '..';
import { Schema, SchemaRegistry } from '@travetto/schema';
import { DependencyRegistry } from '@travetto/di';
import { QueryVerifierService } from '../src/service/query';

@Schema()
class Preferences {
  size: number;
  language?: string;
}

@Model()
class User {
  id: number;
  email: string;
  prefs: Preferences;
}

@Suite()
export class VerifyTest {

  @BeforeAll()
  async init() {
    await DependencyRegistry.init();
    await SchemaRegistry.init();
  }

  @Test()
  async verifyNested() {
    const verifier = await DependencyRegistry.getInstance(QueryVerifierService);

    verifier.verify(User, {
      where: {
        id: 5,
        prefs: {
          language: {
            $exists: true
          }
        }
      }
    })
  }

}