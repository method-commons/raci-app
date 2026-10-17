import { cell, download, expect, menu, openExample, row, stored, test } from './fixtures.js';

test.describe('Ansichten', () => {
  test('Rollen: senkrecht lesen, bearbeiten, entlasten', async ({ page }) => {
    await openExample(page, 'stadtfest');
    await page.click('[data-role-head] .role-head >> text=Schichtleitung');
    await expect(page.locator('h1')).toHaveText('Rollen');
    await expect(page.locator('#kpiBottleneck')).toContainText('Schichtleitung');
    await expect(page.locator('#rfName')).toHaveValue('Schichtleitung');
    await expect(page.locator('[data-role-row] [data-issue="bottleneck"]')).toHaveText('Engpass');
    await expect(page.locator('#relieve')).toContainText('An 13 von 14 Aufgaben beteiligt');
    await page.locator('[data-suggestion="execToOwner"]').first().locator('[data-action="applySuggestion"]').click();
    await expect(page.locator('#relieve')).toContainText('An 13 von 14 Aufgaben beteiligt, davon 8×');
    await page.fill('#rfDeputy', 'Ben');
    await page.click('#rfKind [data-kind="external"]');
    await page.click('[data-role-row] >> text=Marketing');
    await expect(page.locator('#rfName')).toHaveValue('Marketing');
    await page.click('#rfRemove');
    await page.click('#confirmOk');
    await expect(page.locator('[data-role-row]')).toHaveCount(6);
    await page.click('[data-nav="matrix"]');
    await expect(cell(page, '1.2', 0)).toHaveText('A/R');
    await expect(cell(page, '1.2', 1)).toHaveText('C');
    const [m] = await stored(page);
    expect(m.roles.find(r => r.name === 'Schichtleitung')).toMatchObject({ deputy: 'Ben', external: true });
  });

  test('Wer macht was? je Rolle und je Person', async ({ page }) => {
    await openExample(page, 'stadtfest');
    await page.click('[data-nav="people"]');
    const card = page.locator('.pcard').first();
    await expect(card).toContainText('Inhaberin');
    await expect(card.locator('[data-group="A"] em')).toHaveText('entscheidet · 6');
    await expect(page.locator('.pcard')).toHaveCount(7);
    await page.check('#hideEmpty');
    await expect(card.locator('[data-group="I"]')).toHaveCount(0);
    await page.click('#peopleBy [data-by="person"]');
    await expect(page.locator('.pcard')).toHaveCount(7);
    await expect(page.locator('.pcard', { hasText: 'Jonas' })).toContainText('Rollen: Service-Team');
  });

  test('Bericht: Matrix, Prüfung, offene Punkte; Markdown und CSV', async ({ page }) => {
    await openExample(page, 'stadtfest');
    await page.click('[data-nav="report"]');
    await expect(page.locator('#report h1')).toHaveText('Stadtfest 2026 – Ablauf');
    await expect(page.locator('#reportTable tbody tr')).toHaveCount(18);
    await expect(page.locator('#report .rep')).toContainText('Prüfung · 11 / 14 eindeutig');
    await expect(page.locator('#report .rep')).toContainText('Bestellt bis 500 €');
    const md = await download(page, () => page.click('#mdBtn'));
    expect(md.name).toBe('stadtfest-2026-ablauf.md');
    expect(md.text).toContain('## Prüfung · 11 / 14 eindeutig');
    const csv = await download(page, () => page.click('#csvBtn'));
    expect(csv.text).toContain('1.3;Vorbereitung;Ware & Getränke bestellen;A;C;;A/R;;;;2× A');
    const json = await download(page, () => page.click('#jsonBtn'));
    expect(JSON.parse(json.text).name).toBe('Stadtfest 2026 – Ablauf');
  });

  test('Einstellungen: Variante, eigene Buchstaben, Bereiche und Regeln', async ({ page }) => {
    await openExample(page, 'stadtfest');
    await menu(page, 'settings');
    await page.click('#variantSeg [data-variant="rasci"]');
    await expect(page.locator('#letterEditor [data-letter]')).toHaveCount(5);
    await page.click('#variantSeg [data-variant="custom"]');
    await page.click('#addLetterBtn');
    await page.locator('#letterEditor [data-letter="O"] input').nth(1).fill('Out of the loop');
    await page.locator('#letterEditor [data-letter="C"] .key-input').fill('K');
    await page.locator('#letterEditor [data-letter="C"] .key-input').press('Tab');
    await page.locator('#letterEditor [data-letter="I"] .key-input').fill('A');
    await page.locator('#letterEditor [data-letter="I"] .key-input').press('Tab');
    await expect(page.locator('.toast')).toContainText('Kürzel leer oder schon vergeben.');
    await page.uncheck('#opt-notes');
    await page.uncheck('#opt-manyConsult');
    await page.fill('#bottleneckN', '95');
    await page.locator('#bottleneckN').press('Tab');
    await page.click('#saveDefault');
    await page.click('#settingsDone');
    await expect(page.locator('#openPoints')).toHaveCount(0);
    await expect(cell(page, '1.1', 3)).toHaveText('K');
    await expect(row(page, '4.2').locator('[data-status]')).toHaveText('✓');
    await expect(page.locator('[data-hint="bottleneck"]')).toHaveAttribute('data-state', 'ok');
    await expect(page.locator('.letters-legend')).toContainText('Out of the loop');
    const [m] = await stored(page);
    expect([m.variant, m.letters.map(l => l.key), m.options.notes, m.rules.bottleneck]).toEqual(['custom', ['R', 'A', 'S', 'K', 'I', 'O'], false, 95]);
    const d = await page.evaluate(() => JSON.parse(localStorage.getItem('raci:defaults')));
    expect(d.rules.bottleneck).toBe(95);
  });

  test('Rollen und Aufgabenliste aus Menü übernehmen', async ({ page }) => {
    await openExample(page, 'kartenzahlung');
    await page.click('#homeLink');
    await openExample(page, 'stellplatz');
    await menu(page, 'copyRoles');
    await page.click('#copyRolesDialog [data-from]');
    await expect(page.locator('.toast')).toContainText('2 Rollen übernommen.');
    await menu(page, 'addTasks');
    await page.fill('#taskListText', 'Kasse prüfen\nPreise aushängen');
    await page.click('#taskListAdd');
    await expect(page.locator('.task-input')).toHaveCount(11);
    await menu(page, 'duplicate');
    await expect(page.locator('#matrixName')).toHaveValue('Fester Stellplatz Domplatz (Kopie)');
    await menu(page, 'delete');
    await page.click('#confirmOk');
    await expect(page.locator('h1')).toHaveText('Meine RACI-Matrizen');
  });
});
