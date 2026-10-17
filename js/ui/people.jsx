/*
 * Ansicht „Wer macht was?“: die Matrix je Rolle (oder je Person) gelesen – je Buchstabe die
 * Aufgaben – als Steckbrief zum Aushängen und Drucken.
 */
import { Model } from '../model.js';
import { Texts } from '../texts.js';
import { Variants } from '../variants.js';
import { Avatar, Badge, fill } from './components.jsx';
import { useMatrix, viewMode, viewPrefs } from './core.js';

/**
 * Steckbrief einer Gruppe (Rolle oder Person).
 * @param {{ m: Matrix, title: string, sub: string, person: string, roles: Role[] }} props
 */
function Card({ m, title, sub, person, roles }) {
  const P = Texts.people;
  const md = viewMode(m);
  const no = Model.numbers(m);
  const letters = [...m.letters].sort((a, b) => Variants.KIND_ORDER.indexOf(a.kind) - Variants.KIND_ORDER.indexOf(b.kind));
  const hide = viewPrefs.value.hideEmpty;
  return (
    <article class="card pcard" data-card={title}>
      <div class="ph">
        {person ? <Avatar name={person} /> : null}
        <div><b>{title}</b>{sub && <small>{sub}</small>}</div>
      </div>
      {letters.map(l => {
        const items = Model.ordered(m).flatMap(t => roles.map(r => ({ t, r, k: Model.keys(m, t.id, r.id, md), c: Model.cell(m, t.id, r.id) })))
          .filter(x => x.k.includes(l.key));
        if (hide && !items.length) return null;
        return (
          <div class="grp" key={l.key} data-group={l.key}>
            <Badge m={m} keys={[l.key]} size="sm" />
            <div>
              <em>{l.meaning || l.name} · {items.length}</em>
              <ul>
                {items.length ? items.map(({ t, r, k, c }) => (
                  <li key={`${t.id}-${r.id}`}>
                    <span class="id">{no[t.id]}</span>{t.name || Texts.ui.untitledTask}
                    {roles.length > 1 && <span class="sub small"> ({r.name || Texts.ui.untitledRole})</span>}
                    {k.filter(x => x !== l.key).map(x => <span key={x} class="chip sm">{fill(P.also, { key: x })}</span>)}
                    {m.options.notes && c && c.q && <span class="chip warn sm">{P.question}</span>}
                  </li>
                )) : <li class="none">{P.none}</li>}
              </ul>
            </div>
          </div>
        );
      })}
    </article>
  );
}

export function PeopleView() {
  const m = useMatrix();
  const P = Texts.people;
  const byPerson = m.options.people && viewPrefs.value.peopleBy === 'person';
  /** @type {{ title: string, sub: string, person: string, roles: Role[] }[]} */
  let cards;
  if (byPerson) {
    /** @type {Map<string, Role[]>} */
    const map = new Map();
    for (const r of m.roles) {
      const p = r.person.trim();
      if (!map.has(p)) map.set(p, []);
      /** @type {Role[]} */ (map.get(p)).push(r);
    }
    cards = [...map].map(([p, roles]) => ({ title: p || P.noPerson, sub: fill(P.rolesOf, { roles: roles.map(r => r.name || Texts.ui.untitledRole).join(', ') }), person: p, roles }));
  } else {
    cards = m.roles.map(r => ({
      title: r.name || Texts.ui.untitledRole,
      sub: [m.options.people ? r.person.trim() : '', r.description.trim()].filter(Boolean).join(' · '),
      person: m.options.people ? r.person.trim() : '',
      roles: [r],
    }));
  }
  return (
    <div class="page people-page">
      <div class="crumb-row">
        <h1>{P.title}</h1>
        <span class="sub hide-narrow">{P.intro}</span>
        <span class="spacer" />
        {m.options.people && (
          <div class="seg no-print" role="group" id="peopleBy">
            <button type="button" class={byPerson ? '' : 'on'} onClick={() => { viewPrefs.value = { ...viewPrefs.value, peopleBy: 'role' }; }}>{P.perRole}</button>
            <button type="button" class={byPerson ? 'on' : ''} data-by="person" onClick={() => { viewPrefs.value = { ...viewPrefs.value, peopleBy: 'person' }; }}>{P.perPerson}</button>
          </div>
        )}
        <label class="check-inline no-print">
          <input type="checkbox" id="hideEmpty" checked={viewPrefs.value.hideEmpty} onChange={e => { viewPrefs.value = { ...viewPrefs.value, hideEmpty: /** @type {HTMLInputElement} */ (e.currentTarget).checked }; }} />
          {P.hideEmpty}
        </label>
        <button type="button" class="btn no-print" onClick={() => window.print()}>⎙ {P.print}</button>
      </div>
      <div class="people" id="peopleCards">
        {cards.map(c => <Card key={c.title + c.roles.map(r => r.id).join()} m={m} {...c} />)}
      </div>
    </div>
  );
}
