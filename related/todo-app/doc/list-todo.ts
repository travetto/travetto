export async function main(key: string, port: number) {
  const result = await fetch(`http://localhost:${port}/todo?q=${key}`).then(response => response.json());
  console.log!(result);
}