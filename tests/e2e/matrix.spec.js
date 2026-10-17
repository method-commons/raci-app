import { cell, createMatrix, expect, openExample, row, stored, test } from './fixtures.js';

test.describe('Matrix', () => {
  test('anlegen: Rollen, Phasen und Aufgaben, Buchstaben per Tastatur', async ({ page }) => {
    await createMatrix(page, 'Stadtfest');
    await page.click('#addRoleBtn');
    await page.fill('#arName', 'Leitung');
    await page.press('#arName', 'Enter');
    await page.click('#addRoleBtn');
    await page.fill('#arName', 'Team');
    await page.click('#arAdd');
    await expect(page.locator('.role-head')).toHaveCount(2);
    await page.click('#addPhaseBtn');
    await page.locator('.phase-input').fill('Vorbereitung');
    await page.click('[data-add-task]:not([data-add-task=""])');
    await page.keyboard.type('Ware bestellen');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Kasse');
    await expect(page.locator('.task-input')).toHaveCount(2);
    await expect(row(page, '1.2')).toHaveCount(1);

    // 1.1: Leitung A, dann R → A/R; Team C
    await cell(page, '1.1', 0).focus();
    await page.keyboard.press('a');
    await page.keyboard.press('r');
    await expect(cell(page, '1.1', 0)).toHaveText('A/R');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('c');
    await expect(cell(page, '1.1', 1)).toHaveText('C');
    await expect(row(page, '1.1').locator('[data-status]')).toHaveText('✓');
    // 1.2: nur R → kein A; Entf leert
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('r');
    await expect(row(page, '1.2').locator('[data-status]')).toHaveText('✗ kein A');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('a');
    await page.keyboard.press('a');
    await expect(cell(page, '1.2', 0)).toHaveText('');
    await page.keyboard.press('a');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Delete');
    await expect(row(page, '1.2').locator('[data-status]')).toHaveText('! kein R');
    // „Kasse“ ohne Verb → Hinweis
    await expect(page.locator('[data-hint="verb"]')).toHaveAttribute('data-state', 'warn');
    await expect(page.locator('[data-hint="count-A"]')).toHaveAttribute('data-state', 'ok');
    await expect(page.locator('[data-tally]').first()).toContainText('2');

    const [m] = await stored(page);
    expect(m.phases.map(p => p.name)).toEqual(['Vorbereitung']);
    expect(m.tasks.map(t => t.name)).toEqual(['Ware bestellen', 'Kasse']);
    expect(Object.values(m.cells[m.tasks[0].id]).map(c => c.v)).toEqual([['A', 'R'], ['C']]);

    // Rückgängig und Wiederholen
    await page.click('#undoBtn');
    await expect(cell(page, '1.2', 1)).toHaveText('R');
    await page.click('#redoBtn');
    await expect(cell(page, '1.2', 1)).toHaveText('');
    await page.reload();
    await expect(cell(page, '1.1', 0)).toHaveText('A/R');
  });

  test('Auswahl an der Zelle: Buchstaben, doppeltes A auflösen, klären und Notiz', async ({ page }) => {
    await openExample(page, 'stadtfest');
    await expect(row(page, '1.3').locator('[data-status]')).toHaveText('✗ 2× A');
    await cell(page, '1.3', 3).click();
    await expect(page.locator('#cellPopover')).toContainText('Ware & Getränke bestellen');
    await expect(page.locator('#conflictHint')).toContainText('schon ein A bei Inhaberin');
    await page.click('[data-action="otherToConsult"]');
    await expect(cell(page, '1.3', 0)).toHaveText('C');
    await expect(row(page, '1.3').locator('[data-status]')).toHaveText('✓');
    await expect(page.locator('#conflictHint')).toHaveCount(0);
    await page.click('#cellPopover [data-pick-key="I"]');
    await expect(cell(page, '1.3', 3)).toHaveText('I');
    await page.click('#cellPopover [data-pick-key="A/R"]');
    await expect(cell(page, '1.3', 3)).toHaveText('A/R');
    await page.check('#cellQuestion');
    await page.fill('#cellNote', 'Nur bis 500 €');
    await expect(page.locator('#openPoints')).toContainText('Nur bis 500 €');
    await page.keyboard.press('Escape');
    await expect(page.locator('#cellPopover')).toHaveCount(0);
    await expect(row(page, '1.3').locator('[data-status]')).toHaveText('? klären');
    // Hinweis anklicken markiert die Aufgaben
    await page.click('[data-hint="count-A"]');
    await expect(row(page, '1.5')).toHaveClass(/hl/);
    await page.click('[data-hint="bottleneck"]');
    await expect(page.locator('th.role-th.hl')).toHaveCount(1);
  });

  test('Aufgabe bearbeiten: Phase, Verweis, verschieben, entfernen', async ({ page }) => {
    await openExample(page, 'stadtfest');
    await row(page, '1.5').locator('[data-action="editTask"]').click();
    await page.selectOption('#tdPhase', { label: 'Aufbau' });
    await page.fill('#tdRef', 'Plan Social Media');
    await page.locator('#taskDialog [data-sheet-role]').nth(4).locator('[data-key="A"]').click();
    await page.click('#taskDialog .btn.primary');
    await expect(row(page, '2.4').locator('.task-input')).toHaveValue('Social-Media-Ankündigung posten');
    await expect(row(page, '2.4')).toContainText('Plan Social Media');
    await expect(row(page, '2.4').locator('[data-status]')).toHaveText('✓');
    await row(page, '2.4').locator('[data-action="editTask"]').click();
    await page.click('#taskDialog [aria-label="Nach oben"]');
    await page.click('#tdRemove');
    await page.click('#confirmOk');
    await expect(page.locator('.task-input')).toHaveCount(13);
    await page.locator('tr[data-phase]').first().locator('[data-action="removePhase"]').click();
    await page.click('#confirmOk');
    await expect(page.locator('.phase-input')).toHaveCount(3);
    await expect(page.locator('.phase-none')).toHaveText('Ohne Phase');
  });

  test('Ist / Soll vergleichen und übernehmen', async ({ page }) => {
    await openExample(page, 'tagesbetrieb');
    await expect(page.locator('#planCard')).toContainText('18 Zellen in 6 Aufgaben');
    await expect(page.locator('#ownerCompare tr.chg').first()).toContainText('Inhaberin');
    await expect(cell(page, '3', 0)).toHaveText('A/R→I');
    await page.click('#planMode [data-mode="ist"]');
    await expect(cell(page, '3', 0)).toHaveText('A/R');
    await page.click('#planMode [data-mode="soll"]');
    await expect(cell(page, '3', 0)).toHaveText('I');
    await cell(page, '6', 0).focus();
    await page.keyboard.press('i');
    await expect(page.locator('#planCard')).toContainText('19 Zellen in 7 Aufgaben');
    await page.click('#applyPlanBtn');
    await page.click('#confirmOk');
    await expect(page.locator('.toast')).toContainText('19 Zellen übernommen.');
    await expect(page.locator('#planCard')).toContainText('Noch keine Änderungen');
    await page.click('#planMode [data-mode="ist"]');
    await expect(cell(page, '3', 0)).toHaveText('I');
  });

  test('Ist / Soll: im Aufgaben-Dialog und an der Zelle beide Stände bearbeiten', async ({ page }) => {
    await openExample(page, 'tagesbetrieb');
    // Aufgabe 3 „Frischware einkaufen“: Ist Inhaberin A/R, Soll Inhaberin I
    await row(page, '3').locator('[data-action="editTask"]').click();
    const inh = page.locator('#taskDialog [data-sheet-role]').first();
    await expect(page.locator('#tdMode [data-mode="soll"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(inh.locator('.other-state')).toHaveText('Ist: A/R');
    await page.click('#tdMode [data-mode="ist"]');
    await expect(inh.locator('.other-state')).toHaveText('Soll: I');
    await inh.locator('[data-key="R"]').click();
    await expect(inh.locator('.other-state')).toHaveText('Soll: I');
    await page.click('#taskDialog .btn.primary');
    await expect(cell(page, '3', 0)).toHaveText('A→I');
    let [m] = await stored(page);
    let c = m.cells.d3['r-inh'];
    expect([c.v, c.s]).toEqual([['A'], ['I']]);

    // Zelle: Ist ändern, Soll bleibt
    await cell(page, '4', 1).click();
    await page.click('#cellMode [data-mode="ist"]');
    await page.click('#cellPopover [data-pick-key="C"]');
    await expect(page.locator('#cellPopover .other-state')).toHaveText('Soll: A/R');
    await page.click('#cellMode [data-mode="soll"]');
    await page.click('#cellPopover [data-pick-key="A"]');
    await page.keyboard.press('Escape');
    await expect(cell(page, '4', 1)).toHaveText('C→A');
    [m] = await stored(page);
    c = m.cells.d4['r-sl'];
    expect([c.v, c.s]).toEqual([['C'], ['A']]);
  });
});
