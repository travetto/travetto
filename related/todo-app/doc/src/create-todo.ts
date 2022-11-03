import * as fetch from 'node-fetch';

export async function main() {
  const res = await fetch('http://localhost:3000/todo', {
    method: 'POST',
    body: JSON.stringify({ text: 'New Todo' }),
    headers: {
      'Content-Type': 'application/json'
    }
  })
    .then(r => r.json());
  console.log!(res);
}