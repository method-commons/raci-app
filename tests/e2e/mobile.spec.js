import { expect, test } from './fixtures.js';

test.use({ viewport: { width: 390, height: 800 } });

test('mobil: Aufgaben als Liste, Buchstaben im Blatt, Navigation unten', async ({ page }) => {
  await page.click('#exampleBtn');
  await page.click('[data-example="stadtfest"]');
  await expect(page.locator('#mobileList')).toBeVisible();
  await expect(page.locator('#matrixTable')).toBeHidden();
  const task = page.locator('[data-m-task]').nth(2);
  await expect(task).toContainText('2× A');
  await task.click();
  await expect(page.locator('#taskDialog')).toBeVisible();
  await page.locator('#taskDialog [data-sheet-role]').first().locator('[data-key="A"]').click();
  await page.locator('#taskDialog [data-sheet-role]').first().locator('[data-key="C"]').click();
  await page.click('#taskDialog .btn.primary');
  await expect(task).toContainText('✓');
  await page.click('.nav [data-nav="roles"]');
  await expect(page.locator('h1')).toHaveText('Rollen');
});
