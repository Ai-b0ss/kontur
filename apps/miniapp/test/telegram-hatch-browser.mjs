import { chromium } from '@playwright/test';
import { createReadStream } from 'node:fs';
import { mkdir, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const miniapp = fileURLToPath(new URL('..', import.meta.url));
const dist = join(miniapp, 'dist');
const evidence = process.env.KONTUR_TELEGRAM_EVIDENCE_DIR || join(dist, 'telegram-hatch-evidence');
await mkdir(evidence, { recursive: true });

const questions = [
  ['тебе кинули идею. что первым делом?', ['пойму, в чем вообще суть', 'попробую сразу собрать', 'накидаю еще вариантов', 'позову кого-нибудь обсудить']],
  ['что бесит сильнее?', ['когда ничего не понятно', 'когда что-то не работает', 'когда всё скучно', 'когда все тупят на месте']],
  ['освободился вечер. что скорее сделаешь?', ['допилю старую штуку', 'начну что-то новое', 'разберусь с накопившимся', 'пойду к людям']],
  ['в чате уже полчаса спорят. ты где?', ['пытаюсь понять, кто о чем', 'кидаю конкретный пример', 'приношу еще одну версию', 'пытаюсь всех собрать']],
  ['какой момент самый кайфовый?', ['когда стало понятно', 'когда заработало', 'когда получилось необычно', 'когда все наконец совпали']],
  ['штука уже работает, но кривовато', ['еще посижу над ней', 'норм, можно двигаться', 'покажу кому-нибудь', 'вернусь потом свежим']],
  ['что тебе обычно проще?', ['разобраться', 'собрать', 'придумать', 'договориться']],
  ['завтра дедлайн. готова половина', ['оставлю только главное', 'дожму сколько успею', 'придумаю обходной путь', 'соберу всех и разрулим']],
].map(([text, options]) => ({ text, options }));

const palette = { body: '#edd9b6', belly: '#faeed6', wing: '#d3ae74', tail: '#c09a68', crest: '#c8a26c', beak: '#ef8a52' };
function state(hatched = false) {
  return {
    serverTime: new Date().toISOString(), gameDay: 1, isDoubleDay: false, hatched,
    features: { eggs: true, community: false, passive: false },
    player: {
      userId: 991760, username: 'telegram_qa', role: hatched ? 'manager' : null,
      roleTitle: hatched ? 'Менеджер' : null, roleTagline: hatched ? 'Собирает людей и следующий шаг' : null,
      birdName: null, coloring: 'plain', coloringTitle: 'Обычный', palette,
      hatchedAt: hatched ? new Date().toISOString() : null, wallet: 0, reputation: 0, signalCount: 0,
    },
    give: { budget: 3, left: 3, valueWithReason: 2, valuePlain: 1 },
    egg: hatched ? { cost: 5, affordable: false, owned: 1, total: 10 } : null,
    passive: null,
  };
}

function mime(path) {
  return ({ '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.png': 'image/png' })[extname(path)] || 'application/octet-stream';
}

function startServer() {
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url || '/', 'http://127.0.0.1');
      if (url.pathname === '/favicon.ico') {
        response.writeHead(204, { 'cache-control': 'no-store' }).end();
        return;
      }
      const relative = url.pathname === '/' ? 'index.html' : normalize(decodeURIComponent(url.pathname)).replace(/^\/+/, '');
      if (relative.includes('..')) throw new Error('bad path');
      const path = join(dist, relative);
      const info = await stat(path);
      if (!info.isFile()) throw new Error('not file');
      response.writeHead(200, { 'content-type': mime(path), 'cache-control': 'no-store' });
      createReadStream(path).pipe(response);
    } catch {
      response.writeHead(404).end('not found');
    }
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve({ server, origin: `http://127.0.0.1:${server.address().port}` }));
  });
}

function ok(value, message) { if (!value) throw new Error(message); }

async function mockApi(page, hatchDelay) {
  let hatched = false;
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    let value; let status = 200;
    if (path === '/api/v1/auth/telegram') value = { token: 'telegram-qa', state: state(hatched) };
    else if (path === '/api/v4/local/state') value = { state: state(hatched), colorings: [] };
    else if (path === '/api/v4/local/questions') value = { questions };
    else if (path === '/api/v4/local/colorings') value = { colorings: [] };
    else if (path === '/api/v4/local/hatch') {
      await new Promise((resolve) => setTimeout(resolve, hatchDelay));
      hatched = true;
      value = {
        role: 'manager', roleTitle: 'Менеджер', roleTagline: 'Собирает людей и следующий шаг',
        coloring: 'plain', coloringTitle: 'Обычный', palette,
        shareText: 'Я в «Контуре»: Менеджер.', state: state(true),
      };
    } else { status = 404; value = { error: { code: 'NOT_FOUND', message: path } }; }
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(value) });
  });
}

async function waitQuestion(page) {
  await page.waitForFunction(() => {
    const q = document.querySelector('main.lk-first-time--questions .lk-question--egg');
    if (!q) return false;
    const style = getComputedStyle(q);
    return style.visibility !== 'hidden' && Number(style.opacity) > .99 && q.querySelectorAll('.lk-options button').length === 4;
  });
}

async function goToQ8(page) {
  await page.getByRole('button', { name: 'начать' }).click();
  await waitQuestion(page);
  for (let i = 1; i < 8; i += 1) {
    await page.locator('.lk-options button').first().click();
    await page.waitForTimeout(320);
    await waitQuestion(page);
  }
  ok(await page.locator('.lk-question-number').textContent() === '08', 'q8 not reached');
}

async function startTrace(page) {
  await page.evaluate(() => {
    window.__telegramHatchTrace = [];
    const started = performance.now();
    const read = (selector) => {
      const el = document.querySelector(selector);
      const css = el ? getComputedStyle(el) : null;
      const box = el?.getBoundingClientRect();
      return {
        present: Boolean(el), opacity: Number(css?.opacity ?? 0), visibility: css?.visibility ?? null,
        box: box ? { top: box.top, bottom: box.bottom, left: box.left, right: box.right } : null,
      };
    };
    const sample = () => {
      window.__telegramHatchTrace.push({
        at: performance.now() - started,
        phase: document.querySelector('.lk-quiz-egg')?.getAttribute('data-hatch-phase') ?? null,
        base: read('.lk-quiz-egg__base'), halves: read('.lk-hatch-halves'), cracks: read('.lk-quiz-egg__cracks'),
        flash: read('.lk-quiz-hatch__flash'), frame: read('.lk-quiz-hatch__frame'), bird: read('.lk-quiz-hatch__bird'),
        question: read('.lk-question--egg'),
      });
      if (window.__telegramHatchTrace.length < 300) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
}

async function prove(reduced) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 760 }, screen: { width: 390, height: 760 },
    hasTouch: true, isMobile: true, deviceScaleFactor: 1, locale: 'ru-RU',
    reducedMotion: reduced ? 'reduce' : 'no-preference',
  });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (entry) => { if (entry.type() === 'error') errors.push(entry.text()); });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    window.Telegram = { WebApp: { initData: 'dev:991760', ready() {}, expand() {}, close() {}, setHeaderColor() {}, setBackgroundColor() {}, HapticFeedback: { impactOccurred() {}, notificationOccurred() {} } } };
  });
  await mockApi(page, reduced ? 300 : 900);
  await page.goto(`${origin}/?telegram-hatch-proof=1${reduced ? '&motion=reduced' : ''}`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'начать' }).waitFor();
  await goToQ8(page);
  await startTrace(page);
  await page.locator('.lk-options button').first().click();
  await page.getByRole('button', { name: 'что дальше' }).waitFor({ timeout: 5000 });
  await page.waitForTimeout(80);

  const trace = await page.evaluate(() => window.__telegramHatchTrace ?? []);
  const active = trace.filter((s) => ['pulse', 'cracks', 'flash', 'reveal', 'settled'].includes(s.phase));
  for (const phase of ['pulse', 'cracks', 'flash', 'reveal']) ok(active.some((s) => s.phase === phase), `${reduced ? 'reduced' : 'normal'}: missing ${phase}`);
  ok(active.some((s) => s.phase === 'cracks' && s.halves.opacity > .2), 'shell halves never became visible');
  for (const sample of active.filter((s) => ['pulse', 'cracks', 'flash'].includes(s.phase))) {
    ok(!sample.bird.present || sample.bird.opacity < .02 || sample.bird.visibility === 'hidden', `premature bird ${JSON.stringify(sample)}`);
    ok(!sample.frame.present || sample.frame.opacity < .02 || sample.frame.visibility === 'hidden', `premature frame ${JSON.stringify(sample)}`);
    ok(!sample.question.present || sample.question.opacity < .02 || sample.question.visibility === 'hidden', `stale q8 copy ${JSON.stringify(sample)}`);
    ok(Math.max(sample.base.opacity, sample.halves.opacity, sample.cracks.opacity, sample.flash.opacity) > .04, `empty hatch frame ${JSON.stringify(sample)}`);
  }
  ok(active.some((s) => s.phase === 'flash' && s.flash.opacity > .9), 'soft flash never reached cover peak');
  ok(active.filter((s) => s.phase === 'reveal').every((s) => !s.bird.present || s.flash.opacity > .02 || s.bird.opacity > .02), 'empty reveal handoff');

  const layout = await page.evaluate(() => {
    const rect = (selector) => {
      const box = document.querySelector(selector)?.getBoundingClientRect();
      return box ? { top: box.top, bottom: box.bottom, left: box.left, right: box.right, width: box.width, height: box.height } : null;
    };
    const flash = document.querySelector('.lk-quiz-hatch__flash');
    const leftHalf = document.querySelector('.lk-hatch-half--left');
    const rightHalf = document.querySelector('.lk-hatch-half--right');
    return {
      viewport: { width: innerWidth, height: innerHeight },
      ring: rect('.lk-quiz-egg__ring'), inner: rect('.lk-quiz-egg__inner'), frame: rect('.lk-quiz-hatch__frame'),
      birdImage: rect('.lk-quiz-hatch__bird > .lk-result-bird'),
      kicker: rect('.lk-reveal--inline > .lk-kicker'), name: rect('.lk-reveal--inline h1'), panel: rect('.lk-reveal--inline'),
      resultId: document.querySelector('.lk-quiz-hatch__bird')?.getAttribute('data-bird-result') ?? null,
      question: document.querySelector('.lk-question--egg')?.textContent?.trim() ?? null,
      flashBackground: flash ? getComputedStyle(flash).backgroundImage : '',
      flashColor: flash ? getComputedStyle(flash).backgroundColor : '',
      leftClip: leftHalf ? getComputedStyle(leftHalf).clipPath : '',
      rightClip: rightHalf ? getComputedStyle(rightHalf).clipPath : '',
    };
  });
  ok(layout.viewport.width === 390 && layout.viewport.height === 760, `wrong viewport ${JSON.stringify(layout.viewport)}`);
  ok(layout.ring && layout.inner && layout.frame && layout.birdImage && layout.kicker && layout.panel, `missing reveal geometry ${JSON.stringify(layout)}`);
  ok(layout.resultId === 'crane', `worst-case tall crane was not rendered: ${layout.resultId}`);
  ok(layout.kicker.top >= layout.ring.bottom + 12, `kicker overlaps ring: ${JSON.stringify(layout)}`);
  ok(layout.panel.bottom <= 761 && layout.panel.left >= -1 && layout.panel.right <= 391, `panel overflow: ${JSON.stringify(layout)}`);
  ok(layout.inner.top >= layout.ring.top + 5 && layout.inner.bottom <= layout.ring.bottom - 5, `inner mask does not match ring: ${JSON.stringify(layout)}`);
  ok(layout.frame.top >= layout.inner.top - 1 && layout.frame.bottom <= layout.inner.bottom + 1, `bird frame escaped master mask: ${JSON.stringify(layout)}`);
  ok(layout.birdImage.top >= layout.inner.top - 1 && layout.birdImage.bottom <= layout.inner.bottom + 1, `bird art escaped master mask: ${JSON.stringify(layout)}`);
  ok(layout.flashBackground.includes('radial-gradient'), `flash is not radial: ${layout.flashBackground}`);
  ok(layout.flashColor === 'rgba(0, 0, 0, 0)', `flash has opaque background color: ${layout.flashColor}`);
  ok(layout.leftClip === 'none' && layout.rightClip === 'none', `shell still uses clip-path: ${layout.leftClip} / ${layout.rightClip}`);
  ok(!layout.question, `q8 text still mounted: ${layout.question}`);
  ok(errors.length === 0, `browser errors before result: ${JSON.stringify(errors)}`);
  await page.screenshot({ path: join(evidence, reduced ? 'telegram-390x760-reduced.png' : 'telegram-390x760-normal.png'), fullPage: false });

  await page.getByRole('button', { name: 'что дальше' }).click();
  await page.getByRole('button', { name: 'к моей птице' }).waitFor({ timeout: 2000 });
  await page.getByRole('button', { name: 'к моей птице' }).click();
  await page.locator('main.lk-home').waitFor({ timeout: 2000 });

  const home = await page.evaluate(() => {
    const rect = (selector) => {
      const box = document.querySelector(selector)?.getBoundingClientRect();
      return box ? { top: box.top, bottom: box.bottom, left: box.left, right: box.right } : null;
    };
    const stage = document.querySelector('.lk-bird-stage--home');
    return {
      stage: rect('.lk-bird-stage--home'),
      identity: rect('.lk-identity'),
      resultId: document.querySelector('.lk-bird-stage--home .lk-canonical-bird')?.getAttribute('data-bird-result') ?? null,
      overflow: stage ? getComputedStyle(stage).overflow : null,
    };
  });
  ok(home.stage && home.identity, `missing Home crane geometry ${JSON.stringify(home)}`);
  ok(home.resultId === 'crane', `Home did not preserve crane: ${JSON.stringify(home)}`);
  ok(home.overflow === 'hidden', `Home bird stage is not clipped: ${JSON.stringify(home)}`);
  ok(home.identity.top >= home.stage.bottom + 8, `Home identity overlaps bird stage: ${JSON.stringify(home)}`);
  ok(errors.length === 0, `browser errors after Home: ${JSON.stringify(errors)}`);
  await page.screenshot({ path: join(evidence, reduced ? 'telegram-390x760-home-reduced.png' : 'telegram-390x760-home-normal.png'), fullPage: false });

  await context.close();
  return { reduced, traceSamples: trace.length, layout, home };
}

const { server, origin } = await startServer();
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined;
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
try {
  const normal = await prove(false);
  const reduced = await prove(true);
  console.log(`KONTUR_TELEGRAM_HATCH_BROWSER_PASS ${JSON.stringify({ normal, reduced })}`);
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
