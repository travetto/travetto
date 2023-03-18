import fetch from 'node-fetch';

export async function main(key: string) {
  const res = await fetch(`http://localhost:3000/todo?q=${key}`).then(r => r.json());
  console.log!(res);
}