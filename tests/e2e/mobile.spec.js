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

test('mobil: Phasen anlegen, umbenennen, verschieben und entfernen', async ({ page }) => {
  await page.click('#exampleBtn');
  await page.click('[data-example="stadtfest"]');
  const phases = page.locator('[data-m-phase]');
  await expect(phases).toHaveCount(4);
  await phases.nth(1).click();
  await expect(page.locator('#pdName')).toHaveValue('Aufbau');
  await expect(page.locator('#phaseDialog')).toContainText('3 Aufgaben in dieser Phase');
  await page.fill('#pdName', 'Aufbau & Technik');
  await page.click('#phaseDialog [data-action="phaseUp"]');
  await page.click('#phaseDialog .btn.primary');
  await expect(phases.nth(0)).toContainText('Aufbau & Technik');
  await expect(page.locator('[data-m-task]').first()).toContainText('1.1Strom- und Gasanschluss prüfen');

  await page.click('#mAddPhase');
  await page.fill('#pdName', 'Nachlese');
  await page.click('#phaseDialog .btn.primary');
  await expect(phases).toHaveCount(5);
  await expect(phases.nth(4)).toContainText('Nachlese');

  await phases.nth(0).click();
  await page.click('#pdRemove');
  await page.click('#confirmOk');
  await expect(phases).toHaveCount(4);
  await expect(page.locator('#mobileList h3')).toHaveText('Ohne Phase');
  await expect(page.locator('[data-m-task]')).toHaveCount(14);
});
