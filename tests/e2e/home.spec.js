import fs from 'node:fs';
import { chooseFile, createMatrix, download, expect, menu, openExample, stored, test } from './fixtures.js';

test.describe('Startseite', () => {
  test('zeigt den Einstieg, die Buchstaben und Faustregeln', async ({ page }) => {
    await expect(page.locator('h1')).toHaveText('Meine RACI-Matrizen');
    await expect(page.locator('.page-head .sub')).toContainText('Noch keine Matrix');
    await expect(page.locator('[data-letter]')).toHaveCount(4);
    await expect(page.locator('[data-letter="A"]')).toContainText('Wer hält den Kopf hin?');
    await page.click('.letters-strip .link');
    await expect(page.locator('#helpDialog .help-body h2')).toHaveText('RACI-Methode');
    await page.click('[data-help="variants"]');
    await expect(page.locator('#helpDialog .help-body h2')).toHaveText('Varianten');
    await page.keyboard.press('Escape');
    await expect(page.locator('#helpDialog')).toHaveCount(0);
  });

  test('öffnet Beispiele und zeigt Kennzahlen und Hinweis je Karte', async ({ page }) => {
    await openExample(page, 'stadtfest');
    await page.click('#homeLink');
    await openExample(page, 'kartenzahlung');
    await page.click('#homeLink');
    const card = page.locator('[data-matrix]', { hasText: 'Stadtfest 2026' });
    await expect(card.locator('[data-stat="clear"]')).toHaveText('11 / 14 eindeutig');
    await expect(card.locator('[data-stat="bad"]')).toHaveText('2 mit Fehler');
    await expect(card.locator('.mcard-foot')).toContainText('Genau ein A je Aufgabe');
    await expect(page.locator('[data-matrix]', { hasText: 'Kartenzahlung' }).locator('.mcard-foot')).toContainText('Alle Regeln erfüllt');
    await page.click('#variantFilter [data-filter="daci"]');
    await expect(page.locator('[data-matrix]')).toHaveCount(1);
    await expect(page.locator('.page-head .sub')).toHaveText('2 Matrizen · 21 Aufgaben');
  });

  test('legt eine Matrix aus Vorlage, Liste oder mit Rollen einer anderen an', async ({ page }) => {
    await page.click('#newBtn');
    await page.click('[data-pick="rasci"]');
    await expect(page.locator('.pick-side')).toContainText('Support – unterstützt');
    await page.click('[data-start="template"] input');
    await page.selectOption('#nmTemplate', 'project');
    await page.fill('#nmName', 'Projekt X');
    await page.click('#nmCreate');
    await expect(page.locator('#matrixName')).toHaveValue('Projekt X');
    await expect(page.locator('.phase-input')).toHaveCount(3);
    await expect(page.locator('.role-head')).toHaveCount(5);
    await expect(page.locator('#matrixTable thead')).toContainText('Auftraggeber');
    await page.click('#homeLink');

    await page.click('#newBtn');
    await page.click('[data-start="roles"] input');
    await page.click('[data-start="list"] input');
    await page.fill('#nmList', '# Start\nZiele festlegen\nBudget freigeben');
    await page.click('#nmCreate');
    await expect(page.locator('#matrixName')).toHaveValue('RACI');
    await expect(page.locator('.task-input')).toHaveCount(2);
    await page.click('#homeLink');

    await page.click('#newBtn');
    await page.click('[data-start="roles"] input');
    await page.selectOption('#nmFrom', { label: 'Projekt X' });
    await page.click('#nmCreate');
    await expect(page.locator('.role-head')).toHaveCount(5);
    const all = await stored(page);
    expect(all.map(m => m.variant).sort()).toEqual(['raci', 'raci', 'rasci']);
  });

  test('dupliziert, löscht mit Rückgängig und sichert alle Matrizen', async ({ page }) => {
    await createMatrix(page, 'Erste');
    await page.click('#homeLink');
    await page.click('[data-matrix] [data-action="duplicate"]');
    await expect(page.locator('#matrixName')).toHaveValue('Erste (Kopie)');
    await page.click('#homeLink');
    await expect(page.locator('[data-matrix]')).toHaveCount(2);
    await page.locator('[data-matrix]', { hasText: 'Kopie' }).locator('[data-action="delete"]').click();
    await page.click('#confirmOk');
    await expect(page.locator('[data-matrix]')).toHaveCount(1);
    await page.click('.toast .link');
    await expect(page.locator('[data-matrix]')).toHaveCount(2);
    const dl = await download(page, () => menu(page, 'backup'));
    expect(dl.name).toMatch(/^raci-\d{4}-\d{2}-\d{2}\.json$/);
    expect(JSON.parse(dl.text).matrices).toHaveLength(2);
  });

  test('importiert JSON und CSV', async ({ page }, info) => {
    await openExample(page, 'stellplatz');
    const json = await download(page, () => menu(page, 'export'));
    expect(json.name).toBe('fester-stellplatz-domplatz.json');
    const csv = await download(page, () => menu(page, 'csv'));
    expect(csv.text).toContain('Nr.;Phase;Aufgabe;Inhaberin;Technik');
    await page.click('#homeLink');
    // gleiche Datei: schon vorhanden
    await chooseFile(page, '#importBtn', json.path);
    await expect(page.locator('.toast')).toContainText('1 schon vorhanden.');
    const file = info.outputPath('liste.csv');
    fs.writeFileSync(file, 'Aufgabe;Phase;Leitung;Team\nZiele festlegen;Start;A/R;I\nBudget freigeben;Start;A;R\n');
    await chooseFile(page, '#importBtn', file);
    await expect(page.locator('#matrixName')).toHaveValue('liste');
    await expect(page.locator('.phase-input')).toHaveValue('Start');
    await expect(page.locator('[data-status]').first()).toHaveText('✓');
    const bad = info.outputPath('kaputt.json');
    fs.writeFileSync(bad, '{"version": 99}');
    await page.click('#homeLink');
    await chooseFile(page, '#importBtn', bad);
    await expect(page.locator('.toast').last()).toContainText('Import fehlgeschlagen');
  });
});
