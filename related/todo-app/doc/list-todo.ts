import * as fetch from 'node-fetch';

export async function main() {
  const res = await fetch('http://localhost:3000/todo').then(r => r.json());
  console.log!(res);
}