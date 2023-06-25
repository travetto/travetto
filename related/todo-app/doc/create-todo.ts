export async function main(key: string, port: number) {
  const res = await fetch(`http://localhost:${port}/todo`, {
    method: 'POST',
    body: JSON.stringify({ text: `New Todo - ${key}` }),
    headers: {
      'Content-Type': 'application/json'
    }
  })
    .then(r => r.json());
  console.log!(res);
}