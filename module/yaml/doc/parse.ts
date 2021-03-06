import { YamlUtil } from '@travetto/yaml';

export function main() {
  const obj = YamlUtil.parse(`
  name: Source
  age: 20
  fields:
    sub: 
      - a
      - b 
      - c
    sub2: [1,2,3]
    sub3: {"k":5, "v":20}
  `);

  console.log(JSON.stringify(obj, null, 2));
}