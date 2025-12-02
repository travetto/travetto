export async function main(key: string, port: number) {
  const response = await fetch(`http://localhost:${port}/todo?q=${key}`).then(r => r.json());
  console.log!(response);
}