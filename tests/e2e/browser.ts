// Real-browser helpers for e2e tests (puppeteer-core + installed Chromium).
import puppeteer, { type Browser, type Page } from "puppeteer-core";

export const CHROME_PATH = process.env.CHROME_PATH ?? "/usr/bin/chromium";

export function launch(): Promise<Browser> {
  return puppeteer.launch({
    executablePath: CHROME_PATH,
    args: ["--no-sandbox"],
  });
}

/** A page on the app with empty storage, English UI and confirm() accepted. */
export async function openApp(browser: Browser, url: string): Promise<Page> {
  const page = await browser.newPage();
  page.on("dialog", (d) => d.accept());
  page.on("pageerror", (e) => {
    throw e;
  });
  await page.setViewport({ width: 1280, height: 800 });
  await page.goto(url);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector("aside");
  return page;
}

export async function center(page: Page, selector: string) {
  const box = await (await page.$(selector))?.boundingBox();
  if (!box) throw new Error(`No visible element for ${selector}`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** Clicks the first element matching `selector` whose text contains `text`. */
export async function clickText(page: Page, selector: string, text: string) {
  for (const el of await page.$$(selector))
    if ((await el.evaluate((e) => e.textContent ?? "")).includes(text))
      return el.click();
  throw new Error(`No ${selector} containing "${text}"`);
}

/**
 * Switches the UI language from the Options tab, then comes back to the tab
 * that was open (identified by its data-testid, e.g. "tab-students").
 */
export async function setLanguage(page: Page, lang: string, back: string) {
  await page.click("[data-testid='tab-options']");
  await page.select("[data-testid='language']", lang);
  await page.click(`[data-testid='${back}']`);
}

const SCREENSHOTS = `${import.meta.dir}/../../.e2e-screenshots`;

/** Saves a screenshot to .e2e-screenshots/<name>.png for a visual check. */
export async function screenshot(page: Page, name: string) {
  await Bun.$`mkdir -p ${SCREENSHOTS}`;
  await page.screenshot({ path: `${SCREENSHOTS}/${name}.png` });
}

/** Parsed state of a persisted store. */
export function stored<T>(page: Page, key: string): Promise<T> {
  return page.evaluate(
    (k) => JSON.parse(localStorage.getItem(k) ?? "null")?.state,
    key,
  );
}
