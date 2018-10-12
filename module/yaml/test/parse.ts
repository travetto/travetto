import { Util } from '../src/util';
import { YamlUtil } from '../src/api';

const output = YamlUtil.parse(`
---
a: 10
b: 20
c: 30 # Random comment
# More comments

'd"a':
  - 1
  - 2
  - 3
  -
    aa: 20
    age: 20
    bb: 200
  - [1,2,3,4]
  - |
    alfdkjadlkfjadk
    adklfjadlkfjadslkfj
    adfkjalkdfjasl

    adklfjadlkfj
e: {"a": 20, "c": 30}
age: 20
`);

console.log(JSON.stringify(output, null, 2));
console.log(Util.serialize(output));

const output2 = YamlUtil.parse(`
---
- - 1
  - 2
- - a: 4
  - c: 5
  - d: 6
`);

// console.log(JSON.stringify(output2, null, 2));
// console.log(Util.serialize(output2));