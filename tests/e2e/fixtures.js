import { test as base, expect } from '@playwright/test';
import fs from 'node:fs';

/** Gebaute App, ausgeliefert von `vite preview` (siehe playwright.config.js). */
export const APP_URL = 'http://localhost:4173/';

/**
 * `page` öffnet die App mit leerem Speicher und lässt den Test bei jedem
 * JavaScript-Fehler der Seite fehlschlagen.
 */
export const test = base.extend({
  // Playwright verlangt hier ein Objektmuster als ersten Parameter
  // eslint-disable-next-line no-empty-pattern
  pageErrors: async ({}, use) => { await use([]); },
  page: async ({ page, pageErrors }, use) => {
    page.on('pageerror', e => pageErrors.push(e.message));
    await page.goto(APP_URL);
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
    await page.reload();
    await use(page);
    expect(pageErrors, 'JavaScript-Fehler auf der Seite').toEqual([]);
  },
});
export { expect };

/** Beispiel öffnen (landet in der Matrix). */
export async function openExample(page, key) {
  await page.click('#exampleBtn');
  await page.click(`[data-example="${key}"]`);
  await expect(page.locator('#matrixTable')).toBeVisible();
}

/** Neue RACI-Matrix anlegen. */
export async function createMatrix(page, name = 'Test', variant = 'raci') {
  await page.click('#newBtn');
  await page.click(`[data-pick="${variant}"]`);
  await page.fill('#nmName', name);
  await page.click('#nmCreate');
  await expect(page.locator('#matrixName')).toHaveValue(name);
}

/** Zeile einer Aufgabe (nach Nummer, z. B. „1.3“). */
export function row(page, no) {
  return page.locator('#matrixTable tr[data-task-row]').filter({ has: page.locator('.id', { hasText: new RegExp(`^${no.replace('.', '\\.')}$`) }) });
}

/** Zelle einer Aufgabe (nach Nummer) und Rolle (nach Spaltenindex). */
export function cell(page, no, roleIndex) {
  return row(page, no).locator('[data-cell]').nth(roleIndex);
}

/** Gespeicherte Matrizen aus dem localStorage (wartet auf das verzögerte Speichern). */
export async function stored(page) {
  await page.waitForTimeout(400);
  return page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('raci:matrix:')).map(k => JSON.parse(localStorage.getItem(k))));
}

/** Download auslösen und Inhalt lesen. */
export async function download(page, action) {
  const [dl] = await Promise.all([page.waitForEvent('download'), action()]);
  return { name: dl.suggestedFilename(), path: await dl.path(), text: fs.readFileSync(await dl.path(), 'utf8') };
}

/** Datei über den Dateiauswahl-Dialog der App einlesen. */
export async function chooseFile(page, button, file) {
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.click(button)]);
  await chooser.setFiles(file);
}

/** Menü „Datei“ öffnen und Eintrag wählen. */
export async function menu(page, action) {
  await page.click('#menuBtn');
  await page.click(`[data-action="${action}"]`);
}
