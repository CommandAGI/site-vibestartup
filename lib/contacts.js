// A business's customers and sign-ups are contacts: `contacts/<email>.vcf`, one vCard 3.0 each (docs/schema.md). A
// storefront sign-up is `CATEGORIES:signup` with the consent it gave in NOTE (the words, when, on which page); a buyer
// is `CATEGORIES:customer`. Pure: no call, so a plain node run tests it (test/schema.mjs).

const escV = s => String(s ?? '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');
const unescV = s => String(s ?? '').replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1');

/** The file name of a contact: its address, lowercased, with only the characters a file name keeps. */
export const contactFile = email => `${String(email).trim().toLowerCase().replace(/[^a-z0-9@._+-]/g, '_')}.vcf`;

/** A contact as a vCard. `c`: { email, name, source: 'storefront' | 'checkout' | …, since, consent: { text, at, page }, country }. */
export function vcardOf(c) {
  const note = { source: c.source ?? null, since: c.since ?? null, consent: c.consent ?? null, country: c.country ?? null };
  return [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${escV(c.name || c.email)}`,
    `N:${escV(c.name || '')};;;;`,
    `EMAIL;TYPE=INTERNET:${escV(c.email)}`,
    `CATEGORIES:${c.source === 'storefront' ? 'signup' : 'customer'}`,
    `NOTE:${escV(JSON.stringify(note))}`,
    'END:VCARD',
    '',
  ].join('\r\n');
}

/** A vCard read back as a contact; null when it names no address. Lines folded per RFC 6350 are unfolded first. */
export function contactOf(text) {
  const lines = String(text ?? '').replace(/\r?\n[ \t]/g, '').split(/\r?\n/);
  const field = key => { const l = lines.find(x => x.toUpperCase().startsWith(key) && /[:;]/.test(x[key.length] ?? '')); return l == null ? null : unescV(l.slice(l.indexOf(':') + 1)); };
  const email = field('EMAIL');
  if (!email) return null;
  let note = {};
  try { note = JSON.parse(field('NOTE') ?? '{}') ?? {}; } catch { note = { text: field('NOTE') }; }
  const cats = (field('CATEGORIES') ?? '').toLowerCase().split(',');
  const fn = field('FN');
  return { email, name: fn && fn !== email ? fn : '', source: note.source ?? (cats.includes('signup') ? 'storefront' : 'checkout'), since: note.since ?? null, consent: note.consent ?? null, country: note.country ?? null, updates: cats.includes('signup') };
}
