import { expect, openExample, row, stored, test } from './fixtures.js';

/** Name der Aufgabe mit Nummer `no` (Tabelle). @param {import('@playwright/test').Page} page @param {string} no */
const name = (page, no) => row(page, no).locator('.task-input').inputValue();

/**
 * Griff der Aufgabe `from` bis zur Höhe `y` der Zeile `to` ziehen (Anteil der Zeilenhöhe).
 * @param {import('@playwright/test').Page} page @param {import('@playwright/test').Locator} grip
 * @param {import('@playwright/test').Locator} to @param {number} frac
 */
async function drag(page, grip, to, frac) {
  const g = await grip.boundingBox();
  const t = await to.boundingBox();
  if (!g || !t) throw new Error('nicht sichtbar');
  await page.mouse.move(g.x + g.width / 2, g.y + g.height / 2);
  await page.mouse.down();
  await page.mouse.move(g.x + g.width / 2, g.y + g.height / 2 + 10, { steps: 3 });
  await page.mouse.move(g.x + g.width / 2, t.y + t.height * frac, { steps: 8 });
}

test.describe('Reihenfolge', () => {
  test('Ziehen am Griff: in eine andere Phase, mit Hinweis, Escape bricht ab', async ({ page }) => {
    await openExample(page, 'stadtfest');
    const moved = await name(page, '1.4');
    const target = await name(page, '2.2');
    // obere Hälfte von 2.2: davor, also in „Aufbau“ als 2.2
    await drag(page, row(page, '1.4').locator('.grip'), row(page, '2.2'), 0.25);
    await expect(page.locator('.drag-tip')).toHaveText('Nach „Aufbau“, wird 2.2');
    await expect(row(page, '2.2')).toHaveClass(/drop-before/);
    await page.mouse.up();
    await expect(page.locator('.drag-tip')).toHaveCount(0);
    expect(await name(page, '2.2')).toBe(moved);
    expect(await name(page, '2.3')).toBe(target);
    await expect(page.locator('.drop-before, .drop-after, .dragging')).toHaveCount(0);
    await stored(page, list => {
      const m = list[0];
      const t = m.tasks.find(x => x.name === moved);
      expect(t.phase).toBe(m.phases[1].id);
    });
    // untere Hälfte der letzten Aufgabe einer Phase: ans Ende dieser Phase
    const first = await name(page, '1.1');
    await drag(page, row(page, '1.1').locator('.grip'), row(page, '1.4'), 0.75);
    await expect(page.locator('.drag-tip')).toHaveText('wird 1.4');
    await page.mouse.up();
    expect(await name(page, '1.4')).toBe(first);
    // Escape bricht ab
    const now = await name(page, '1.1');
    await drag(page, row(page, '1.1').locator('.grip'), row(page, '3.1'), 0.25);
    await page.keyboard.press('Escape');
    await page.mouse.up();
    expect(await name(page, '1.1')).toBe(now);
    await expect(page.locator('.drag-tip')).toHaveCount(0);
    // Rückgängig nimmt die letzte Verschiebung zurück
    await page.click('#undoBtn');
    expect(await name(page, '1.1')).toBe(first);
  });

  test('Alt+↑/↓ im Aufgabennamen, auf dem Griff und in einer Zelle', async ({ page }) => {
    await openExample(page, 'stadtfest');
    const a = await name(page, '1.2');
    const input = row(page, '1.2').locator('.task-input');
    await input.focus();
    await page.keyboard.press('Alt+ArrowUp');
    expect(await name(page, '1.1')).toBe(a);
    await expect(row(page, '1.1').locator('.task-input')).toBeFocused();
    // Ende der Phase: weiter in die nächste
    const last = await name(page, '1.5');
    await row(page, '1.5').locator('.task-input').focus();
    await page.keyboard.press('Alt+ArrowDown');
    expect(await name(page, '2.1')).toBe(last);
    await expect(row(page, '2.1').locator('.task-input')).toBeFocused();
    // Griff: Pfeiltasten auch ohne Alt
    await row(page, '2.1').locator('.grip').focus();
    await page.keyboard.press('ArrowDown');
    expect(await name(page, '2.2')).toBe(last);
    await expect(row(page, '2.2').locator('.grip')).toBeFocused();
    // Zelle: Alt+↑, die Zelle behält den Fokus
    await row(page, '2.2').locator('[data-cell]').first().focus();
    await page.keyboard.press('Alt+ArrowUp');
    expect(await name(page, '2.1')).toBe(last);
    await expect(row(page, '2.1').locator('[data-cell]').first()).toBeFocused();
  });
});

test.describe('Reihenfolge mobil', () => {
  test.use({ viewport: { width: 390, height: 800 } });

  test('Modus „Reihenfolge“: ↑ ↓ und Ziehen, „Fertig“ beendet', async ({ page }) => {
    await page.click('#exampleBtn');
    await page.click('[data-example="stadtfest"]');
    await expect(page.locator('#mobileList')).toBeVisible();
    await page.click('#mReorder');
    await expect(page.locator('#mReorder')).toHaveText('Fertig');
    const cards = page.locator('#mobileList .m-sort');
    const nm = (/** @type {number} */ i) => cards.nth(i).locator('.nm').textContent();
    const first = await nm(0);
    const second = await nm(1);
    await expect(cards.nth(0).locator('[data-action="mUp"]')).toBeDisabled();
    await cards.nth(0).locator('[data-action="mDown"]').click();
    expect(await nm(1)).toBe(first);
    await expect(cards.nth(1).locator('.id')).toHaveText('1.2');
    // Ziehen: zweite Karte wieder an den Anfang
    await drag(page, cards.nth(1).locator('.grip'), cards.nth(0), 0.2);
    await page.mouse.up();
    expect(await nm(0)).toBe(first);
    expect(await nm(1)).toBe(second);
    await page.click('#mReorder');
    await expect(cards).toHaveCount(0);
    await expect(page.locator('#mReorder')).toContainText('Reihenfolge');
    await expect(page.locator('[data-m-phase]').first()).toBeVisible();
  });
});
