export async function main(key: string, port: number) {
  const res = await fetch(`http://localhost:${port}/todo?q=${key}`).then(r => r.json());
  console.log!(res);
}