// The book's own script: the first-page sketch, the running head's chapter, and films that play only while seen.
// The sketch is a script in this browser: it reads what the visitor typed and sends nothing (the page's CSP has no
// other origin, and this file makes no request).
const $ = s => document.querySelector(s);
const still = matchMedia('(prefers-reduced-motion: reduce)');
const lang = document.documentElement.lang.slice(0, 2);
const cap1 = t => t.charAt(0).toUpperCase() + t.slice(1);

// Words per locale; the sketch's logic is the same in every language.
const W = {
  en: {
    stop: /^(a|an|the|that|which|who|lets|let|for|of|to|and|or|with|your|my|our|you|we|i|it|its|in|on|at|by|from|is|are|be|can|will|into|so|their|this|people|helps|help|makes|make|sells|sell|small|new|online|app|service|business|company|startup)$/i,
    cut: /\s(that|which|who|for|to|with|so|where|when|in|near|around|at|on|sold|made|built|delivered|shipped|baked|grown)\s/i,
    generic: /^(subscription|service|course|box|kit|shop|store|club|plan)$/i,
    head: words => words.slice(-2),
    names: [n => `${n}wise`, n => `${n} & Co.`, n => `Little ${n}`, n => `${n} House`],
    tag: idea => cap1(idea).replace(/\.?$/, '.'),
    product: noun => `The ${noun}`,
    tasks: ['Name it, and draw its mark', 'A storefront on its own address', 'One product, checkout in test mode', 'Write to ten people you know'],
    notes: {
      first: 'Who buys the first one? Name three people.',
      goods: 'Who makes it? Sourcing stays with you, or sell it as a pre-order.',
      digital: 'Digital is fast to ship. What makes it worth paying for on day one?',
      service: 'Sell your hours first. Package them later.',
      sub: 'A subscription needs a reason to come back every month. What is it?',
      one: 'One product first. A catalogue can wait.',
      short: 'Say it in one sentence, and I’ll sketch the page.',
    },
  },
  es: {
    stop: /^(un|una|unos|unas|el|la|los|las|que|para|de|del|a|al|y|o|con|tu|tus|mi|mis|su|sus|en|por|es|son|se|lo|le|les|personas|ayuda|vende|hace|pequeño|nuevo|online|app|servicio|negocio|empresa|startup)$/i,
    cut: /\s(que|para|con|sin|donde|cuando|vendid[oa]s?|hech[oa]s?)\s/i,
    generic: /^(suscripción|servicio|curso|caja|kit|tienda|club|plan)$/i,
    head: words => words.slice(0, 2),
    names: [n => `Taller ${n}`, n => `Casa ${n}`, n => `${n} & Cía.`, n => `La ${n}`],
    tag: idea => cap1(idea).replace(/\.?$/, '.'),
    product: noun => noun,
    tasks: ['Ponerle nombre y dibujar su marca', 'Una tienda en su propia dirección', 'Un producto, cobro en modo de prueba', 'Escribir a diez personas que conoces'],
    notes: {
      first: '¿Quién compra el primero? Di tres nombres.',
      goods: '¿Quién lo fabrica? El suministro es tuyo, o véndelo en preventa.',
      digital: 'Lo digital sale rápido. ¿Qué hace que valga la pena pagarlo el primer día?',
      service: 'Vende tus horas primero. Empaquétalas después.',
      sub: 'Una suscripción necesita un motivo para volver cada mes. ¿Cuál es?',
      one: 'Primero un producto. El catálogo puede esperar.',
      short: 'Dilo en una frase y esbozo la página.',
    },
  },
  zh: {
    stop: null,
    tag: idea => idea.replace(/[。.]?$/, '。'),
    product: noun => noun,
    tasks: ['起名，画出它的标志', '一个有自己网址的店面', '一个产品，测试模式的结账', '写信给你认识的十个人'],
    notes: {
      first: '第一件谁会买？说出三个人。',
      goods: '谁来生产？货源由你负责，或者先做预售。',
      digital: '数字产品上线快。第一天凭什么值得付钱？',
      service: '先卖你的时间，以后再打包成产品。',
      sub: '订阅需要每个月回来的理由。是什么？',
      one: '先做一个产品。目录可以等。',
      short: '用一句话说出来，我来画第一页。',
    },
  },
}[lang] ?? null;

const cap = w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();

/** A first page from one sentence: a name, a line, a product, four tasks, three margin notes. Deterministic. */
export function sketch(idea, w = W) {
  const text = idea.trim().replace(/\s+/g, ' ');
  const kind = /subscri|monthly|suscrip|mensual|订阅|每月/i.test(text) ? 'sub'
    : /\b(course|template|app|software|e-?book|guide|digital|plantilla|curso)s?\b|软件|课程|模板|数字/i.test(text) ? 'digital'
    : /\b(coach|consult|clean|tutor|repair|walk|design|servicio|clases)|咨询|服务|辅导/i.test(text) ? 'service'
    : 'goods';
  let name, product;
  if (lang === 'zh') {
    const core = text.replace(/[。.！!？?]$/, '');
    // Chinese puts the head noun last: the name takes its last two characters, the product the whole phrase.
    const head = core.split('的').at(-1).replace(/^(一个|一款|一家|一种|给|为|带)/, '').slice(-6) || '小店';
    let h = 0; for (const c of text) h = (h * 31 + c.codePointAt(0)) >>> 0;
    name = head.slice(-2) + ['工坊', '小铺', '之家', '研究所'][h % 4];
    product = head;
  } else {
    const head = text.split(w.cut)[0];
    const words = head.split(/[^\p{L}\p{N}-]+/u).filter(x => x.length > 2 && !w.stop.test(x));
    const pick = w.head(words.length ? words : ['first', 'offer']);
    const key = lang === 'es' ? pick[0] : (w.generic.test(pick.at(-1)) && pick.length > 1 ? pick[0] : pick.at(-1));
    let h = 0; for (const c of text) h = (h * 31 + c.codePointAt(0)) >>> 0;
    name = w.names[h % w.names.length](cap(key));
    product = w.product(pick.map(cap).join(' '), head);
  }
  const notes = text.length < 12 ? [w.notes.short, w.notes.first, w.notes.one] : [w.notes.first, w.notes[kind], w.notes.one];
  return { name, tag: w.tag(text), product, tasks: w.tasks, notes };
}

function render(page, animate) {
  const facing = $('#facing'), margin = $('.margin');
  const set = (k, v) => { const el = document.querySelector(`[data-f="${k}"]`); if (el) el.textContent = v; };
  set('name', page.name); set('tag', page.tag); set('product', page.product);
  page.tasks.forEach((t, i) => { set(`t${i + 1}`, t); document.querySelector(`[data-f="t${i + 1}"]`)?.style.setProperty('--i', i); });
  page.notes.forEach((n, i) => set(`n${i + 1}`, n));
  if (!animate) return;
  for (const el of [facing, margin]) { el.classList.remove('writing'); void el.offsetWidth; el.classList.add('writing'); }
}

const form = $('#sketch');
if (form && W) {
  const area = form.querySelector('textarea');
  form.addEventListener('submit', e => { e.preventDefault(); render(sketch(area.value), !still.matches); });
  area.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); } });
  // The cover types its own first line once, then sketches; a person typing stops it.
  const line = area.value;
  render(sketch(line), false);
  if (!still.matches) {
    let i = 0, stopped = false;
    area.addEventListener('focus', () => { stopped = true; area.value = area.value || line; }, { once: true });
    area.value = '';
    const tick = () => {
      if (stopped) return;
      area.value = line.slice(0, ++i);
      if (i < line.length) setTimeout(tick, 28 + Math.random() * 40);
      else render(sketch(line), true);
    };
    setTimeout(tick, 500);
  }
}

// The running head names the chapter being read.
const chapter = document.querySelector('[data-chapter]');
const titled = [...document.querySelectorAll('[data-title]')];
if (chapter && 'IntersectionObserver' in window) {
  const seen = new IntersectionObserver(entries => {
    for (const e of entries) if (e.isIntersecting) chapter.textContent = e.target.dataset.title;
  }, { rootMargin: '-45% 0px -50% 0px' });
  titled.forEach(t => seen.observe(t));
}

// Films play only while on screen, and never under reduced motion (the poster still stands instead).
const films = [...document.querySelectorAll('.film video')];
if ('IntersectionObserver' in window) {
  const watch = new IntersectionObserver(entries => {
    for (const e of entries) {
      const v = e.target;
      if (e.isIntersecting && !still.matches) { if (v.preload === 'none') v.preload = 'auto'; v.play().catch(() => {}); }
      else v.pause();
    }
  }, { rootMargin: '200px 0px' });
  films.forEach(v => watch.observe(v));
}
still.addEventListener?.('change', () => { if (still.matches) films.forEach(v => v.pause()); });

// Contents: a chosen chapter closes the popover.
$('#contents')?.addEventListener('click', e => { if (e.target.closest('a')) e.currentTarget.hidePopover?.(); });
