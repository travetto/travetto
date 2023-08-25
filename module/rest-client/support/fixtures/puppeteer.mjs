import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({ headless: 'new', args: ['--allow-file-access-from-files'] });
const page = await browser.newPage();

await page.setViewport({ width: 1080, height: 1024 });
await page.goto(`file://${process.argv.pop()}`);

const selector = await page.waitForSelector('output');

console.log(await selector?.evaluate(el => el.textContent));

await browser.close();