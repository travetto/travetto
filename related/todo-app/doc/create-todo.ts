export async function main(key: string, port: number) {
  const result = await fetch(`http://localhost:${port}/todo`, {
    method: 'POST',
    body: JSON.stringify({ text: `New Todo - ${key}` }),
    headers: {
      'Content-Type': 'application/json'
    }
  })
    .then(response => response.json());
  console.log!(result);
}