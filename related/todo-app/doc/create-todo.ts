import { JSONUtil } from '@travetto/runtime';

export async function main(key: string, port: number) {
  const result = await fetch(`http://localhost:${port}/todo`, {
    method: 'POST',
    body: JSONUtil.toUTF8({ text: `New Todo - ${key}` }),
    headers: {
      'Content-Type': 'application/json'
    }
  })
    .then(response => response.json());
  console.log!(result);
}