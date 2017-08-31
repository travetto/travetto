import { beforeAll, afterAll, afterSuite, beforeSuite, afterTest, beforeTest } from '../src/util';

for (let [name, [b, a]] of [['All', [beforeAll, afterAll]], ['Test', [beforeTest, afterTest]], ['Suite', [beforeSuite, afterSuite]]]) {
  (b as any)(async () => {
    console.log(`Starting ${name}`);
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log(`Started ${name}`);
  });

  (a as any)(async () => {
    console.log(`Ending ${name}`);
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log(`Ended ${name}`);
  });
}

