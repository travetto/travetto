export async function main(key: string, port: number) {
  const response = await fetch(`http://localhost:${port}/todo`, {
    method: 'POST',
    body: JSON.stringify({ text: `New Todo - ${key}` }),
    headers: {
      'Content-Type': 'application/json'
    }
  })
    .then(result => result.json());
  console.log!(response);
}