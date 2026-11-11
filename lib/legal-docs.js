// The Legal tab's document library: plain-English starter templates a young founder needs, filled from the business
// record and a few fields the founder types. Each template is a list of blocks that lib/pdf.js sets as a PDF and
// `blocksToHtml` shows as the preview (and, for the storefront's three, as a page of the storefront). No dependency,
// so it runs in the browser and in Node (test/legal-pdf.mjs renders every template).

const escHtml = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const usd = n => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(n) || 0);
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
export const longDate = iso => { const d = new Date(`${iso}T12:00:00`); return isNaN(d) ? String(iso ?? '') : d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }); };
const addDays = (iso, n) => { const d = new Date(`${iso}T12:00:00`); if (isNaN(d)) return ''; d.setDate(d.getDate() + (Number(n) || 0)); return longDate(d.toISOString().slice(0, 10)); };
const number = s => Number(String(s ?? '').replace(/[$,\s]/g, '')) || 0;

export const US_STATES = ['Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut', 'Delaware', 'District of Columbia', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming'];

/** Every field a template may ask for. `type` is an input type, `textarea` or `select`. */
export const FIELDS = {
  business: { label: 'Business name' },
  founder: { label: 'Your full name' },
  email: { label: 'Contact email', type: 'email' },
  website: { label: 'Storefront address', placeholder: 'https://…', optional: true },
  state: { label: 'State or province', list: 'us-states', hint: 'Where the business is based; its law governs.' },
  country: { label: 'Country' },
  date: { label: 'Date', type: 'date' },
  address: { label: 'Business address', type: 'textarea', placeholder: 'Street, city, state, ZIP', optional: true },
  refundDays: { label: 'Return window (days)', type: 'number' },
  returnShipping: { label: 'Who pays return shipping', type: 'select', options: ['the customer', 'us'] },
  contractor: { label: 'Contractor\'s name' },
  contractorEmail: { label: 'Contractor\'s email', type: 'email', optional: true },
  services: { label: 'The work', type: 'textarea', placeholder: 'Design a logo and three social images…' },
  fee: { label: 'Fee', placeholder: '$500 fixed, or $40 an hour' },
  paymentDays: { label: 'Pay invoices within (days)', type: 'number' },
  endDate: { label: 'Work ends by', type: 'date', hint: 'Leave empty: until the work is done.', optional: true },
  party: { label: 'Other party\'s name', hint: 'A person or a company.' },
  partyEmail: { label: 'Other party\'s email', type: 'email', optional: true },
  purpose: { label: 'Why you share information', placeholder: 'to discuss a possible partnership' },
  ndaYears: { label: 'Confidential for (years)', type: 'number' },
  cofounder: { label: 'Co-founder\'s full name' },
  cofounderEmail: { label: 'Co-founder\'s email', type: 'email', optional: true },
  founderRole: { label: 'Your role', placeholder: 'CEO: product, sales, money' },
  cofounderRole: { label: 'Co-founder\'s role', placeholder: 'CTO: the site and the tech' },
  founderShare: { label: 'Your share (%)', type: 'number' },
  cofounderShare: { label: 'Co-founder\'s share (%)', type: 'number' },
  vestYears: { label: 'Vesting (years)', type: 'number' },
  cliffMonths: { label: 'Cliff (months)', type: 'number' },
  contribution: { label: 'Your starting contribution', placeholder: '$1,000 cash' },
  agent: { label: 'Registered agent', placeholder: 'Name and address in the state' },
  invoiceNumber: { label: 'Invoice number' },
  client: { label: 'Client\'s name' },
  clientEmail: { label: 'Client\'s email', type: 'email', optional: true },
  clientAddress: { label: 'Client\'s address', type: 'textarea', optional: true },
  items: { label: 'Items, one a line', type: 'textarea', placeholder: 'Logo design | 1 | 450\nSocial images | 3 | 25', hint: 'Description | quantity | price each' },
  taxRate: { label: 'Sales tax (%)', type: 'number' },
  dueDays: { label: 'Due in (days)', type: 'number' },
  payment: { label: 'How to pay', type: 'textarea' },
};

/** The fields' starting values, from the business record and the founder. */
export function defaults(biz = {}, founder = {}) {
  const email = biz.email?.address || founder.email || '';
  return {
    business: biz.name ?? '', founder: founder.name ?? '', email, website: biz.site?.brandUrl ?? biz.site?.url ?? '', state: '', country: 'United States',
    date: today(), address: '', refundDays: '30', returnShipping: 'the customer', paymentDays: '14', ndaYears: '2',
    founderShare: '50', cofounderShare: '50', vestYears: '4', cliffMonths: '12', invoiceNumber: 'INV-0001', taxRate: '0',
    dueDays: '14', payment: `Reply to ${email || 'this email'} to pay by card or bank transfer.`,
  };
}

/** The values a template reads: a missing one shows as its label in brackets, so the gap is plain to see. */
const reader = v => {
  const f = k => String(v[k] ?? '').trim() || `[${FIELDS[k]?.label ?? k}]`;
  const us = /^(us|usa|united states( of america)?)$/i.test(String(v.country ?? '').trim());
  const law = String(v.state ?? '').trim()
    ? (us ? `the laws of the State of ${v.state.trim()}` : `the laws of ${v.state.trim()}, ${f('country')}`)
    : (us ? `the laws of the State of [${FIELDS.state.label}]` : `the laws of ${f('country')}`);
  const place = [String(v.state ?? '').trim(), String(v.country ?? '').trim()].filter(Boolean).join(', ') || `[${FIELDS.state.label}]`;
  return { f, law, place, us, date: longDate(v.date || today()), site: String(v.website ?? '').trim().replace(/^https?:\/\//, '').replace(/\/$/, '') || 'our website' };
};

// ---------- the templates ----------

const terms = v => {
  const { f, law, date, site } = reader(v);
  return {
    subtitle: `Effective ${date} · ${site}`,
    blocks: [
      { p: `These terms are the agreement between you and **${f('business')}** ("we", "us") when you visit ${site} or buy from us. By placing an order you agree to them. They are written to be read: if something is unclear, write to ${f('email')} and we will explain.` },
      { h: '1. Who we are' },
      { p: `${f('business')} is run by ${f('founder')} from ${reader(v).place}. You can reach us at ${f('email')}.` },
      { h: '2. Using the site' },
      { p: 'You may browse and buy for your own use. Please do not misuse the site: no attempts to break it, scrape it at scale, or use it for anything unlawful. We may suspend access for anyone who does.' },
      { h: '3. Products and prices' },
      { p: 'We describe each product as accurately as we can. Colours and photos may vary slightly from the real thing. Prices are in US dollars and include any discount shown. We may change prices at any time, but a change never affects an order we have already confirmed.' },
      { h: '4. Orders and payment' },
      { list: [
        'An order is a request to buy. It becomes a contract when we confirm it by email.',
        'Card payments are processed by our payment provider (Stripe). We never see or store your full card number.',
        'We may refuse or cancel an order, for example if a product is out of stock or a price was clearly wrong. If we cancel, you get a full refund.',
      ] },
      { h: '5. Delivery' },
      { p: 'We ship physical products to the address you give us and send tracking when the carrier provides it. Delivery times are estimates. Digital products are delivered by email or download link. Risk passes to you when the product is delivered.' },
      { h: '6. Returns and refunds' },
      { p: `Our Refund & Returns Policy explains what you can return and how. It is part of these terms. In short: most items can be returned within ${f('refundDays')} days of delivery.` },
      { h: '7. Digital products' },
      { p: 'When you buy a digital product we grant you a personal, non-transferable licence to use it. You may not resell, share or publish it as your own unless the product page says you can.' },
      { h: '8. Our content' },
      { p: `The site, its text, images, logo and designs belong to ${f('business')} or to those who licensed them to us. Please do not copy them without permission.` },
      { h: '9. Warranties' },
      { p: 'We stand behind what we sell: if a product arrives damaged or not as described, we will fix it under our refund policy. Beyond that, and to the extent the law allows, the site and products are provided "as is", without other warranties. Nothing here limits rights you have as a consumer that cannot be limited by law.' },
      { h: '10. Limitation of liability' },
      { p: 'To the extent the law allows, our total liability to you for any claim about an order is limited to the amount you paid for that order, and we are not liable for indirect or consequential losses. We do not exclude liability we cannot exclude by law, such as for fraud or for death or injury caused by our negligence.' },
      { h: '11. Governing law' },
      { p: `These terms are governed by ${law}. If we have a dispute, we will first try to settle it by talking. If we cannot, the courts of that place decide, unless the law where you live gives you the right to go to your local courts.` },
      { h: '12. Changes to these terms' },
      { p: 'We may update these terms. The date at the top shows the latest version. The terms that apply to an order are the ones in force when you placed it.' },
      { h: '13. Contact' },
      { p: `Questions, complaints or notices: ${f('email')}.` },
    ],
  };
};

const privacy = v => {
  const { f, date, site } = reader(v);
  return {
    subtitle: `Effective ${date} · ${site}`,
    blocks: [
      { p: `This policy explains what personal information **${f('business')}** collects, why, and what you can ask us to do with it. We collect as little as we can and we never sell it.` },
      { h: 'What we collect' },
      { list: [
        '**When you order:** your name, email address, shipping address and what you bought.',
        '**When you write to us:** your message and your email address.',
        '**When you join our list:** your email address, and the date you joined.',
        '**When you visit:** basic technical data that every web server records (your IP address, browser type, the pages requested). Our host keeps it briefly for security and to count visits.',
      ] },
      { p: 'We do not collect your card number. Payments are handled by Stripe, which has its own privacy policy.' },
      { h: 'How we use it' },
      { list: [
        'To process, ship and support your order.',
        'To answer your messages.',
        'To send emails you asked for. Every marketing email has an unsubscribe link.',
        'To keep the site secure and working, and to meet our legal and tax duties.',
      ] },
      { h: 'Who we share it with' },
      { p: 'Only with the services that help us run the business, and only what they need:' },
      { list: [
        '**Stripe**, to take payments.',
        '**CommandAGI**, which hosts our site, email and files.',
        '**Shipping carriers**, to deliver your order.',
        '**Authorities**, when the law requires it.',
      ] },
      { h: 'Cookies' },
      { p: 'We do not use advertising or tracking cookies. If the checkout or a provider sets a cookie, it is only to make that feature work.' },
      { h: 'How long we keep it' },
      { p: 'Order records are kept as long as tax law requires (usually up to seven years). Messages and list sign-ups are kept until you ask us to delete them or they are no longer needed.' },
      { h: 'Your rights' },
      { p: `You can ask to see the information we hold about you, correct it, download it, or delete it. You can also object to how we use it. Write to ${f('email')}; we answer within 30 days. Depending on where you live (for example California or the European Union), the law may give you further rights, and you can complain to your data protection authority.` },
      { h: 'Children' },
      { p: 'Our site is not meant for children under 13, and we do not knowingly collect their information.' },
      { h: 'Security' },
      { p: 'We use reputable providers, encrypted connections and limited access to keep your information safe. No system is perfect; if a breach affects you, we will tell you.' },
      { h: 'Changes' },
      { p: 'If we change this policy we will update the date above, and tell you by email if the change is significant.' },
      { h: 'Contact' },
      { p: `${f('business')}, ${f('founder')}, ${f('email')}.` },
    ],
  };
};

const refunds = v => {
  const { f, date, site } = reader(v);
  const days = f('refundDays');
  const weShip = String(v.returnShipping ?? '') === 'us';
  return {
    subtitle: `Effective ${date} · ${site}`,
    blocks: [
      { p: `We want you to be happy with what you buy from **${f('business')}**. If you are not, here is how to make it right.` },
      { h: 'Returns' },
      { p: `You can return most items within **${days} days** of delivery for a full refund. Items should be unused and in their original packaging.` },
      { h: 'What cannot be returned' },
      { list: [
        'Items made or personalised to your order, unless they arrive faulty.',
        'Digital products once downloaded or accessed, unless they do not work as described.',
        'Gift cards.',
        'Perishable goods, and items that cannot be resold for hygiene reasons once opened.',
      ] },
      { h: 'How to return an item' },
      { list: [
        `Email ${f('email')} with your order number and what you want to return.`,
        'We reply with the return address and any instructions, usually within two business days.',
        'Send the item back with tracking. Keep the receipt until your refund arrives.',
      ], ordered: true },
      { h: 'Return shipping' },
      { p: weShip ? 'We pay for return shipping: we send you a prepaid label.' : 'You pay for return shipping, unless the item arrived damaged, faulty or not as described. Then we pay.' },
      { h: 'Refunds' },
      { p: 'Once we receive and check the item, we refund your original payment method within 5 business days and email you to confirm. Your bank may take a few more days to show it. Original shipping charges are refunded only if the return is our fault.' },
      { h: 'Damaged, faulty or wrong items' },
      { p: `If something arrives damaged, faulty or not what you ordered, email ${f('email')} within 14 days with a photo. We will send a replacement or a full refund, including shipping, whichever you prefer.` },
      { h: 'Exchanges' },
      { p: 'Want a different size or colour? Return the item for a refund and place a new order: it is the fastest way.' },
      { h: 'Cancelling an order' },
      { p: 'You can cancel any order that has not shipped yet for a full refund. Just email us.' },
      { p: 'This policy does not affect your statutory rights as a consumer.', muted: true },
    ],
  };
};

const contractor = v => {
  const { f, law, date, place } = reader(v);
  const end = String(v.endDate ?? '').trim();
  return {
    subtitle: `Made on ${date}`,
    blocks: [
      { parties: [
        { label: 'Client', lines: [f('business'), `represented by ${f('founder')}`, f('email')] },
        { label: 'Contractor', lines: [f('contractor'), String(v.contractorEmail ?? '').trim()] },
      ] },
      { p: `This agreement sets out the work the Contractor will do for the Client and how it will be paid. It starts on ${date}.` },
      { h: '1. The work' },
      { p: f('services') },
      { p: `The Contractor decides how, when and where to do the work, and uses their own tools. ${end ? `The work is to be finished by ${longDate(end)}.` : 'The work continues until it is done or this agreement ends.'}` },
      { h: '2. Payment' },
      { list: [
        `**Fee:** ${f('fee')}.`,
        `The Contractor sends an invoice when the work (or an agreed milestone) is delivered. The Client pays within **${f('paymentDays')} days** of receiving it.`,
        'Expenses are paid only if the Client approved them in writing before they were spent.',
      ] },
      { h: '3. Independent contractor' },
      { p: 'The Contractor is self-employed, not an employee, partner or agent of the Client. The Contractor is responsible for their own taxes, insurance and benefits, and may work for others, as long as it does not breach this agreement.' },
      { h: '4. Who owns the work' },
      { p: 'Once the Client has paid for it, everything the Contractor makes for the Client under this agreement (designs, code, text, files) belongs to the Client, and the Contractor assigns all rights in it to the Client. The Contractor keeps the right to show the work in a portfolio unless the Client asks them not to. Tools and know-how the Contractor had before stay the Contractor\'s; the Client may use any that are built into the work.' },
      { h: '5. Confidentiality' },
      { p: 'The Contractor keeps the Client\'s non-public information confidential, uses it only for this work, and returns or deletes it when the work ends.' },
      { h: '6. Quality' },
      { p: 'The Contractor will do the work with reasonable skill and care, and confirms that the work is their own and does not knowingly infringe anyone else\'s rights.' },
      { h: '7. Ending the agreement' },
      { p: 'Either side may end this agreement with 7 days\' written notice (email is fine), or at once if the other side seriously breaks it. The Client pays for work done up to the end; the Contractor hands over that work.' },
      { h: '8. Liability' },
      { p: 'Neither side is liable to the other for indirect or consequential losses. Each side\'s total liability under this agreement is limited to the total fee, except for breach of confidentiality or fraud.' },
      { h: '9. General' },
      { p: `This is the whole agreement about this work; changes must be in writing and agreed by both. It is governed by ${law}, and disputes are decided in the courts of ${place}.` },
      { sign: [{ party: 'Client', name: f('founder'), title: `for ${f('business')}` }, { party: 'Contractor', name: f('contractor') }] },
    ],
  };
};

const nda = v => {
  const { f, law, date, place } = reader(v);
  return {
    subtitle: `Made on ${date}`,
    blocks: [
      { parties: [
        { label: 'Party one', lines: [f('business'), `represented by ${f('founder')}`, f('email')] },
        { label: 'Party two', lines: [f('party'), String(v.partyEmail ?? '').trim()] },
      ] },
      { p: `The parties want to share information ${f('purpose')} (the "Purpose"). Each may share and receive information, so this agreement protects both.` },
      { h: '1. Confidential information' },
      { p: '"Confidential information" is any non-public information one party (the "Discloser") gives the other (the "Recipient") for the Purpose, in any form: business plans, customers, prices, designs, code, finances, and anything marked or obviously confidential.' },
      { h: '2. What is not confidential' },
      { p: 'Information that the Recipient can show:' },
      { list: [
        'is or becomes public through no fault of the Recipient;',
        'the Recipient already knew, without a duty of confidentiality;',
        'the Recipient lawfully received from someone else, without a duty of confidentiality; or',
        'the Recipient developed on its own, without using the Discloser\'s information.',
      ] },
      { h: '3. What the Recipient promises' },
      { list: [
        'To use the confidential information only for the Purpose.',
        'To keep it secret, with at least the care it uses for its own confidential information (and never less than reasonable care).',
        'To share it only with its employees, contractors and advisers who need it for the Purpose and are bound by similar confidentiality duties. The Recipient is responsible for them.',
      ] },
      { h: '4. When the law requires disclosure' },
      { p: 'If a court or the law requires the Recipient to disclose confidential information, it may do so, but it will tell the Discloser first (if allowed) and disclose only what is required.' },
      { h: '5. Returning information' },
      { p: 'When asked, or when the Purpose ends, the Recipient returns or deletes the confidential information and its copies, except copies it must keep by law or in automatic backups, which stay confidential.' },
      { h: '6. No other rights' },
      { p: 'Sharing information gives no licence or ownership of it. Information is shared "as is". Neither party has to share anything, or to go ahead with any deal.' },
      { h: '7. How long' },
      { p: `This agreement covers information shared in the next ${f('ndaYears')} years from ${date}. The duty to keep it confidential lasts for ${f('ndaYears')} years after it was shared, and for trade secrets, as long as they remain trade secrets.` },
      { h: '8. Remedies' },
      { p: 'A breach could cause harm that money cannot fully repair, so the Discloser may ask a court for an order to stop it, as well as any other remedy.' },
      { h: '9. General' },
      { p: `This is the whole agreement on this subject; changes must be in writing and signed by both. It is governed by ${law}, and disputes are decided in the courts of ${place}. Signatures by electronic means count.` },
      { sign: [{ party: 'Party one', name: f('founder'), title: `for ${f('business')}` }, { party: 'Party two', name: f('party') }] },
    ],
  };
};

const founders = v => {
  const { f, law, date, place } = reader(v);
  return {
    subtitle: `Made on ${date}`,
    blocks: [
      { parties: [
        { label: 'Founder', lines: [f('founder'), f('email')] },
        { label: 'Co-founder', lines: [f('cofounder'), String(v.cofounderEmail ?? '').trim()] },
      ] },
      { p: `We are starting **${f('business')}** together. This agreement records what we agreed, before money or trouble makes it harder to talk about.` },
      { h: '1. Roles' },
      { list: [`**${f('founder')}:** ${f('founderRole')}.`, `**${f('cofounder')}:** ${f('cofounderRole')}.`] },
      { p: 'We will each give the business the time we promised each other, and tell the other early if that changes.' },
      { h: '2. Ownership' },
      { table: { head: ['Founder', 'Role', 'Share'], widths: [0.34, 0.46, 0.2], align: ['l', 'l', 'r'], rows: [
        [f('founder'), String(v.founderRole ?? '').split(':')[0] || '—', `${f('founderShare')}%`],
        [f('cofounder'), String(v.cofounderRole ?? '').split(':')[0] || '—', `${f('cofounderShare')}%`],
      ] } },
      { h: '3. Vesting' },
      { p: `Each of our shares is earned over **${f('vestYears')} years**, with a **${f('cliffMonths')}-month cliff**: nothing is earned before the cliff, then the share earned up to that day is earned at once, and the rest monthly. If one of us leaves, the business (or the other founder) may buy back the unearned part at the price paid for it, or at no cost if nothing was paid.` },
      { h: '4. Our work belongs to the business' },
      { p: `Everything either of us creates for ${f('business')} (the name, brand, code, designs, content, customer lists) belongs to the business. When the company is formed, we will each assign those rights to it.` },
      { h: '5. Decisions' },
      { p: 'Day-to-day decisions sit with whoever owns that area. We decide together, in writing, on:' },
      { list: [
        'bringing in a new owner, investor or co-founder;',
        'borrowing money or spending more than an amount we agree;',
        'selling the business or its main assets, or closing it;',
        'paying ourselves, or hiring someone.',
      ] },
      { p: 'If we cannot agree, we will talk it through within a week, then ask a mediator we both trust before anything else.' },
      { h: '6. Money' },
      { p: 'Money we put in is recorded in writing as an investment or a loan. Business money goes into a business account, not a personal one. Expenses are repaid only if both of us agreed to them.' },
      { h: '7. If one of us leaves' },
      { p: 'Whoever leaves gives 30 days\' notice, hands over all work, accounts and passwords, and keeps only the share they have earned. They will not use the business\'s confidential information or try to take its customers.' },
      { h: '8. Forming the company' },
      { p: `When we form a company (an LLC or a corporation), we will sign its formal documents, and they will follow this agreement. Until then, this agreement is governed by ${law}, with disputes decided in ${place}.` },
      { sign: [{ party: 'Founder', name: f('founder') }, { party: 'Co-founder', name: f('cofounder') }] },
    ],
  };
};

const llcName = v => { const n = String(v.business ?? '').trim(); return n ? (/\bL\.?L\.?C\.?$/i.test(n) ? n : `${n} LLC`) : `[${FIELDS.business.label}] LLC`; };
const llc = v => {
  const { f, date, us } = reader(v);
  const name = llcName(v);
  const state = String(v.state ?? '').trim() || `[${FIELDS.state.label}]`;
  return {
    title: `Operating Agreement of ${name}`,
    subtitle: `A single-member limited liability company · effective ${date}`,
    blocks: [
      { p: `This Operating Agreement is made by **${f('founder')}** (the "Member"), the sole member of **${name}** (the "Company"), a limited liability company formed under the laws of ${us ? `the State of ${state}` : state}.` },
      { h: '1. Formation' },
      { p: `The Company was formed by filing its Articles (or Certificate) of Organization with the ${us ? `Secretary of State of ${state}` : 'company registry'}. Its rights and duties are as set out in that filing, this Agreement and the law of that state.` },
      { h: '2. Name, office and registered agent' },
      { kv: [['Name', name], ['Principal office', f('address')], ['Registered agent', f('agent')]] },
      { h: '3. Purpose' },
      { p: 'The Company may carry on any lawful business. Its current business is the one run as ' + f('business') + (String(v.website ?? '').trim() ? `, at ${v.website.trim()}.` : '.') },
      { h: '4. The Member and capital' },
      { p: `The Member owns 100% of the Company. The Member's starting contribution is ${f('contribution')}. The Member is not required to contribute more. Contributions earn no interest, and no member may withdraw them except as a distribution.` },
      { h: '5. Management' },
      { p: 'The Company is managed by the Member, who has full authority to run it, sign contracts, open bank accounts and act for it. The Member may give officers titles and duties in writing.' },
      { h: '6. Distributions' },
      { p: 'The Member decides when the Company distributes money, but no distribution may be made if it would leave the Company unable to pay its debts as they fall due.' },
      { h: '7. Taxes' },
      { p: 'Unless the Member elects otherwise, the Company is a "disregarded entity" for US federal income tax: its income and losses are reported on the Member\'s own return. The Member may elect to have it taxed as a corporation (including an S corporation) if that becomes worthwhile.' },
      { h: '8. Keeping the Company separate' },
      { p: 'To protect the Member\'s limited liability, the Company will:' },
      { list: [
        'keep its own bank account and never mix its money with the Member\'s;',
        'sign contracts in its own name, with "LLC" after it;',
        'keep its own books and records, and file its annual report on time;',
        'record important decisions in writing.',
      ] },
      { h: '9. Liability and indemnification' },
      { p: 'The Member is not personally liable for the Company\'s debts or obligations only because they are a member or manager. The Company will indemnify the Member against losses from acting for the Company in good faith, except for fraud, wilful misconduct or a knowing breach of law.' },
      { h: '10. Transfers and new members' },
      { p: 'The Member may transfer all or part of their interest. A new member is admitted only with the Member\'s written consent, and this Agreement should then be replaced by a multi-member agreement.' },
      { h: '11. Death or incapacity' },
      { p: 'If the Member dies or becomes incapacitated, their interest passes to their heir, estate or legal representative, who may continue the Company as its member rather than dissolve it.' },
      { h: '12. Dissolution' },
      { p: 'The Company is dissolved when the Member decides, or as the law requires. Its assets then pay its debts first, and anything left goes to the Member.' },
      { h: '13. General' },
      { p: 'This Agreement is the whole agreement on these matters and can be changed only in writing signed by the Member. If any part is invalid, the rest stays in force.' },
      { sign: [{ party: 'Member', name: f('founder'), title: `Sole member of ${name}` }] },
    ],
  };
};

/** "Description | quantity | price each" a line; a line with one field is one unit at no price. */
export function parseItems(text) {
  return String(text ?? '').split('\n').map(l => l.trim()).filter(Boolean).map(l => {
    const [desc, a, b] = l.split('|').map(s => s.trim());
    const qty = b === undefined ? 1 : (number(a) || 1);
    const price = b === undefined ? number(a) : number(b);
    return { desc, qty, price, total: qty * price };
  });
}
const invoice = v => {
  const { f, date } = reader(v);
  const items = parseItems(v.items);
  const sub = items.reduce((a, i) => a + i.total, 0), rate = number(v.taxRate), tax = Math.round(sub * rate) / 100;
  return {
    title: `Invoice ${f('invoiceNumber')}`,
    subtitle: `Issued ${date} · due ${addDays(v.date || today(), v.dueDays) || f('dueDays')}`,
    blocks: [
      { parties: [
        { label: 'From', lines: [f('business'), f('founder'), f('email'), ...String(v.address ?? '').split('\n')] },
        { label: 'Bill to', lines: [f('client'), String(v.clientEmail ?? '').trim(), ...String(v.clientAddress ?? '').split('\n')] },
      ] },
      { kv: [['Invoice number', f('invoiceNumber')], ['Issued', date], ['Due', `${addDays(v.date || today(), v.dueDays)} (${f('dueDays')} days)`]] },
      { table: {
        head: ['Description', 'Qty', 'Price', 'Amount'], widths: [0.52, 0.12, 0.18, 0.18], align: ['l', 'r', 'r', 'r'],
        rows: items.length ? items.map(i => [i.desc || '—', String(i.qty), usd(i.price), usd(i.total)]) : [['[Items: one a line, description | quantity | price]', '', '', '']],
        totals: [['Subtotal', usd(sub)], ...(rate ? [[`Sales tax (${rate}%)`, usd(tax)]] : []), ['Total due', usd(sub + tax), true]],
      } },
      { h3: 'How to pay' },
      { p: f('payment') },
      { p: `Thank you for your business. Questions about this invoice: ${f('email')}.`, muted: true },
    ],
  };
};

const formation = v => {
  const { date } = reader(v);
  const state = String(v.state ?? '').trim();
  const where = state || 'your state';
  return {
    title: 'Formation checklist',
    subtitle: `For ${String(v.business ?? '').trim() || 'your business'} in ${state || 'the United States'} · ${date}`,
    blocks: [
      { p: `What making ${String(v.business ?? '').trim() || 'the business'} official involves in the US, in order. Most founders start as a sole proprietor and form an LLC once the business has real customers: VibeStartup's co-founder proposes it at about three real sales or $100 of revenue.` },
      { h: 'Choose a structure' },
      { table: { head: ['', 'Sole proprietorship', 'LLC'], widths: [0.24, 0.38, 0.38], rows: [
        ['Set-up', 'Nothing to file: you are in business when you start selling.', `File Articles of Organization with ${where}'s Secretary of State.`],
        ['Cost', 'Free, plus a DBA filing (about $10 to $100) to use a business name.', 'A state filing fee (about $35 to $500) and, in most states, a yearly fee or report.'],
        ['Your liability', 'You personally owe the business\'s debts.', 'Business debts stay with the LLC, if you keep it separate.'],
        ['Taxes', 'Profit goes on your own return (Schedule C).', 'The same by default; an S-corp election can save tax at higher profit.'],
        ['Best for', 'Testing an idea, first sales.', 'A business with customers, contracts or risk.'],
      ] } },
      { h: 'Before you file' },
      { checks: [
        `Check the name is free: search ${where}'s business-entity database, and the USPTO trademark search (tmsearch.uspto.gov).`,
        'Get the domain and the social handles that match the name.',
        `Choose a registered agent: a person or company with a street address in ${where}, available in business hours, to receive legal papers. You can be your own.`,
        'Decide your business address (it becomes public). A virtual address keeps your home private.',
      ] },
      { h: state ? `Form the LLC in ${state}` : 'Form the LLC' },
      { checks: [
        `File the Articles (or Certificate) of Organization with ${where}'s Secretary of State, online in most states, and pay the fee.`,
        'Sign an operating agreement, even as the only member: it shows the LLC is separate from you. (Use the Operating Agreement in this library.)',
        'Get an EIN from the IRS: free, online, in about 10 minutes at irs.gov. Never pay a site to get one.',
        'Open a business bank account with the filed articles, the EIN and your ID. Keep every business dollar in it.',
        'Check the beneficial ownership (BOI) rule: since March 2025, companies formed in the US do not file a BOI report with FinCEN. Check fincen.gov in case it changes.',
      ] },
      { h: 'Or stay a sole proprietor for now' },
      { checks: [
        'Register a DBA ("doing business as") if you sell under a name other than your own; in some states this is done by the county.',
        'Get an EIN anyway (free) so you do not hand out your Social Security number.',
        'Open a separate bank account for the business.',
      ] },
      { h: 'After either' },
      { checks: [
        `Register for sales tax with ${where} if you sell taxable goods there, and collect it at checkout.`,
        'Check city and county licences or permits for what you sell.',
        'Put the Terms of Service, Privacy Policy and Refund Policy on your storefront.',
        'Keep books from day one: every sale and expense, with receipts.',
        'Set aside about 25 to 30% of profit for tax, and pay quarterly estimated tax (IRS Form 1040-ES) once you expect to owe $1,000 or more.',
        'Put the yearly report and fee in your calendar, so the LLC stays in good standing.',
        'Look at business insurance (general or product liability) once you ship physical goods.',
      ] },
      { note: 'Fees and rules differ by state and change. Your Secretary of State\'s website is the source for the forms and the current fee.' },
    ],
  };
};

const COMMON = ['business', 'founder', 'email', 'state', 'country', 'date'];
export const TEMPLATES = [
  { id: 'terms', title: 'Terms of Service', about: 'The rules of buying from your storefront.', fields: ['refundDays', ...COMMON, 'website'], storefront: 'terms.html', build: terms },
  { id: 'privacy', title: 'Privacy Policy', about: 'What you collect from customers and why.', fields: [...COMMON, 'website'], storefront: 'privacy.html', build: privacy },
  { id: 'refunds', title: 'Refund & Returns Policy', about: 'How customers return things and get their money back.', fields: ['business', 'email', 'date', 'website', 'refundDays', 'returnShipping'], storefront: 'refunds.html', build: refunds },
  { id: 'contractor', title: 'Freelancer Agreement', about: 'Hire a freelancer: the work, the fee, who owns the result.', fields: ['contractor', 'contractorEmail', 'services', 'fee', 'paymentDays', 'endDate', ...COMMON], build: contractor },
  { id: 'nda', title: 'Mutual NDA', about: 'Share secrets with a partner, both ways.', fields: ['party', 'partyEmail', 'purpose', 'ndaYears', ...COMMON], build: nda },
  { id: 'founders', title: 'Co-founder Agreement', about: 'Roles, shares and vesting, agreed before it gets hard.', fields: ['cofounder', 'cofounderEmail', 'founderRole', 'cofounderRole', 'founderShare', 'cofounderShare', 'vestYears', 'cliffMonths', ...COMMON], build: founders },
  { id: 'llc', title: 'LLC Operating Agreement', about: 'For a single-member LLC: how it is run and kept separate.', fields: ['address', 'agent', 'contribution', ...COMMON, 'website'], build: llc },
  { id: 'invoice', title: 'Invoice', about: 'Bill a client: items, total, how to pay.', fields: ['client', 'clientEmail', 'clientAddress', 'items', 'invoiceNumber', 'taxRate', 'dueDays', 'payment', 'business', 'founder', 'email', 'address', 'date'], build: invoice },
  { id: 'formation', title: 'Formation checklist', about: 'What forming an LLC or a sole proprietorship involves.', fields: ['state', 'business', 'date'], build: formation },
];

/** A template filled: { id, title, subtitle, blocks, file (the PDF's name), storefront }. */
export function fill(template, values) {
  const out = template.build(values);
  return { id: template.id, title: out.title ?? template.title, subtitle: out.subtitle, blocks: out.blocks, file: `${template.id === 'terms' ? 'terms-of-service' : template.id === 'privacy' ? 'privacy-policy' : template.id === 'refunds' ? 'refund-policy' : template.id}.pdf`, storefront: template.storefront ?? null };
}
/** The fields a template uses that are still empty. */
export const missing = (template, values) => template.fields.filter(k => !FIELDS[k].optional && !String(values[k] ?? '').trim());

// ---------- as HTML ----------

const inline = s => escHtml(s).split('**').map((t, i) => i % 2 ? `<strong>${t}</strong>` : t).join('');
export function blocksToHtml(blocks) {
  return blocks.map(b => {
    if ('h' in b) return `<h2>${inline(b.h)}</h2>`;
    if ('h3' in b) return `<h3>${inline(b.h3)}</h3>`;
    if ('p' in b) return `<p${b.muted ? ' class="muted"' : ''}>${inline(b.p)}</p>`;
    if ('list' in b) return `<${b.ordered ? 'ol' : 'ul'}>${b.list.map(i => `<li>${inline(i)}</li>`).join('')}</${b.ordered ? 'ol' : 'ul'}>`;
    if ('checks' in b) return `<ul class="checks">${b.checks.map(i => `<li>${inline(i)}</li>`).join('')}</ul>`;
    if ('note' in b) return `<p class="doc-note">${inline(b.note)}</p>`;
    if ('kv' in b) return `<dl class="kv">${b.kv.map(([k, v]) => `<dt>${escHtml(k)}</dt><dd>${inline(v)}</dd>`).join('')}</dl>`;
    if ('parties' in b) return `<div class="parties">${b.parties.map(p => `<div><small>${escHtml(p.label)}</small>${p.lines.filter(Boolean).map(l => `<div>${escHtml(l)}</div>`).join('')}</div>`).join('')}</div>`;
    if ('table' in b) {
      const t = b.table, al = i => t.align?.[i] === 'r' ? ' class="r"' : '';
      return `<div class="doc-table"><table><thead><tr>${t.head.map((h, i) => `<th${al(i)}>${escHtml(h)}</th>`).join('')}</tr></thead><tbody>${t.rows.map(r => `<tr>${r.map((c, i) => `<td${al(i)}>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody>${t.totals?.length ? `<tfoot>${t.totals.map(([k, v, strong]) => `<tr${strong ? ' class="strong"' : ''}><td colspan="${t.head.length - 1}" class="r">${escHtml(k)}</td><td class="r">${escHtml(v)}</td></tr>`).join('')}</tfoot>` : ''}</table></div>`;
    }
    if ('sign' in b) return `<div class="signs">${b.sign.map(s => `<div><small>${escHtml(s.party)}</small><p>Signature <i></i></p><p>Name <i>${escHtml(s.name ?? '')}</i></p>${s.title !== undefined ? `<p>Title <i>${escHtml(s.title)}</i></p>` : ''}<p>Date <i></i></p></div>`).join('')}</div>`;
    if ('space' in b || 'rule' in b) return '<hr>';
    return '';
  }).join('');
}

/** A storefront page of a filled document, in the storefront's own stylesheet and header (lib/business.js). */
export function storefrontPage(doc, businessName) {
  const css = '.doc{max-width:72ch;padding-bottom:48px}.doc h2{font-size:19px;margin:28px 0 6px;letter-spacing:-.01em}.doc h3{font-size:16px;margin:20px 0 4px}.doc p,.doc li{line-height:1.6}.doc ul,.doc ol{padding-left:22px}.doc .muted{opacity:.7}.doc table{border-collapse:collapse;width:100%;font-size:15px}.doc th,.doc td{text-align:left;padding:8px;border-bottom:1px solid var(--line,#ddd);vertical-align:top}.doc .r{text-align:right}.doc-note{padding:12px 16px;border-left:3px solid var(--p,#333)}';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escHtml(doc.title)} · ${escHtml(businessName)}</title><link rel="stylesheet" href="style.css"><style>${css}</style></head><body><header class="bar"><a class="brand" href="./"><img src="logo.svg" alt="">${escHtml(businessName)}</a></header><main class="wrap"><section class="hero"><h1>${escHtml(doc.title)}</h1><p>${escHtml(doc.subtitle ?? '')}</p></section><article class="doc">${blocksToHtml(doc.blocks)}</article></main></body></html>\n`;
}
