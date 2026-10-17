import { expect, openExample, test } from './fixtures.js';

test('stellt auf Englisch um, mit englischen Beispielen', async ({ page }) => {
  await page.click('#menuBtn');
  await page.click('[data-lang="en"]');
  await expect(page.locator('h1')).toHaveText('My RACI matrices');
  await openExample(page, 'stadtfest');
  await expect(page.locator('#matrixName')).toHaveValue('City festival 2026 – schedule');
  await expect(page.locator('[data-hint="count-A"] b')).toHaveText('Exactly one A per task');
  await expect(page.locator('[data-status="bad"]').first()).toHaveText('✗ 2× A');
  await page.click('[data-nav="people"]');
  await expect(page.locator('.pcard').first().locator('[data-group="A"] em')).toHaveText('decides · 6');
  await page.click('#menuBtn');
  await page.click('[data-lang="de"]');
  await expect(page.locator('h1')).toHaveText('Wer macht was?');
});
