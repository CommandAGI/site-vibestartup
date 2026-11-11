// Every Legal template as a PDF, filled from a sample business, written to a folder to open and check
// (pdfinfo, pdftotext, pdftoppm). Also writes the storefront's three pages as HTML.
//
//   node test/legal-pdf.mjs [out-dir]          (default: .test-results/legal)
//   node test/legal-pdf.mjs out --blank        the templates with only the business record filled: the gaps show
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { renderPdf } from '../lib/pdf.js';
import { TEMPLATES, defaults, fill, storefrontPage } from '../lib/legal-docs.js';

const out = path.resolve(process.argv[2] ?? '.test-results/legal');
const blank = process.argv.includes('--blank');
mkdirSync(out, { recursive: true });

const biz = { slug: 'tidepool-candles', name: 'Tidepool Candles', email: { address: 'tidepool-candles@commandagi.email' }, site: { url: 'https://tidepool-candles.commandagi.app' }, brand: { primary: 'hsl(187 70% 42%)', ground: 'hsl(36 60% 97%)', ink: 'hsl(240 10% 12%)' } };
const founder = { name: 'Maya Ortiz', email: 'maya@example.com' };
const values = { ...defaults(biz, founder), ...(blank ? {} : {
  state: 'Oregon', address: '1200 SE Water Ave\nPortland, OR 97214', contractor: 'Sam Lee', contractorEmail: 'sam@example.com',
  services: 'Photograph the six spring candles on a white and a lifestyle background, and deliver 18 edited images (2400 px, JPEG) for the storefront and social posts.',
  fee: '$600 fixed, half on signing and half on delivery', endDate: '2026-12-05', party: 'Driftwood Supply Co.', partyEmail: 'hello@driftwood.example',
  purpose: 'to discuss a wholesale partnership', cofounder: 'Jordan Reyes', cofounderEmail: 'jordan@example.com', founderRole: 'CEO: product, brand and sales',
  cofounderRole: 'COO: production, fulfilment and suppliers', founderShare: '60', cofounderShare: '40', contribution: '$1,500 cash and the candle-making equipment',
  agent: 'Maya Ortiz, 1200 SE Water Ave, Portland, OR 97214', client: 'Harbor Gift Shop', clientEmail: 'orders@harborgifts.example', clientAddress: '44 Front St\nAstoria, OR 97103',
  items: 'Sea Salt & Sage candle, 8 oz | 24 | 14.50\nDriftwood candle, 8 oz | 24 | 14.50\nGift box set (3 minis) | 12 | 22\nShipping (freight) | 1 | 38', taxRate: '0', invoiceNumber: 'INV-0007',
}) };

for (const t of TEMPLATES) {
  const doc = fill(t, values);
  const bytes = renderPdf({ title: doc.title, subtitle: doc.subtitle, business: { name: biz.name }, brand: biz.brand, blocks: doc.blocks });
  writeFileSync(path.join(out, doc.file), bytes);
  if (doc.storefront) writeFileSync(path.join(out, doc.storefront), storefrontPage(doc, biz.name));
  console.log(`${doc.file}\t${bytes.length} bytes`);
}
