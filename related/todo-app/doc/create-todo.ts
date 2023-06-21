export async function main(key: string) {
  const res = await fetch('http://localhost:3000/todo', {
    method: 'POST',
    body: JSON.stringify({ text: `New Todo - ${key}` }),
    headers: {
      'Content-Type': 'application/json'
    }
  })
    .then(r => r.json());
  console.log!(res);
}