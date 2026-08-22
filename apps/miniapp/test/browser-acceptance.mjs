import { chromium } from '@playwright/test';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const miniapp = fileURLToPath(new URL('..', import.meta.url));
const repo = fileURLToPath(new URL('../../..', import.meta.url));
const dist = join(miniapp, 'dist');
const evidence = process.env.KONTUR_BROWSER_EVIDENCE_DIR || join(repo, '.evidence', 'kontur-browser');
const videos = join(evidence, '.video-tmp');
await mkdir(videos, { recursive: true });

const plain = { body: '#edd9b6', belly: '#faeed6', wing: '#d3ae74', tail: '#c09a68', crest: '#c8a26c', beak: '#ef8a52' };
const mint = { body: '#b8ead7', belly: '#effbf5', wing: '#5ec4ae', tail: '#3a9f91', crest: '#8be0ca', beak: '#f19163' };
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

function ok(value, message) {
  if (!value) throw new Error(message);
}

function fresh(slot) {
  return {
    slot, hatched: false, role: null, coloring: 'plain', wallet: 5,
    colorings: [
      { code: 'plain', title: 'Обычный', rarity: 'common', palette: plain, owned: true, equipped: true },
      { code: 'mint', title: 'Мятный сигнал', rarity: 'rare', palette: mint, owned: false, equipped: false },
    ],
  };
}

function state(session) {
  const palette = session.coloring === 'mint' ? mint : plain;
  return {
    serverTime: new Date().toISOString(), gameDay: 21, isDoubleDay: false, hatched: session.hatched,
    features: { eggs: true, community: false, passive: false },
    player: {
      userId: 980000 + session.slot, username: `qa_${session.slot}`, role: session.role,
      roleTitle: session.role ? 'Дизайнер' : null, roleTagline: session.role ? 'Делает сложное понятным' : null,
      birdName: null, coloring: session.coloring, coloringTitle: session.coloring === 'mint' ? 'Мятный сигнал' : 'Обычный',
      palette, hatchedAt: session.hatched ? '2026-08-22T00:00:00.000Z' : null,
      wallet: session.wallet, reputation: 0, signalCount: 0,
    },
    give: { budget: 3, left: 3, valueWithReason: 2, valuePlain: 1 },
    egg: session.hatched ? { cost: 5, affordable: session.wallet >= 5, owned: session.colorings.filter((item) => item.owned).length, total: session.colorings.length } : null,
    passive: null,
  };
}

function colorings(session) {
  return session.colorings.map((item) => ({ ...item, equipped: item.code === session.coloring }));
}

function mime(path) {
  return ({ '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.png': 'image/png' })[extname(path)] || 'application/octet-stream';
}

function startServer() {
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url || '/', 'http://127.0.0.1');
      const relative = url.pathname === '/' ? 'index.html' : normalize(decodeURIComponent(url.pathname)).replace(/^\/+/, '');
      if (relative.includes('..')) throw new Error('bad path');
      const path = join(dist, relative);
      const info = await stat(path);
      if (!info.isFile()) throw new Error('not a file');
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

function mockApi(page, session) {
  return page.route('**/api/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    let value; let status = 200;
    if (path === '/api/v1/auth/telegram') value = { token: `qa-${session.slot}`, state: state(session) };
    else if (path === '/api/v4/local/state') value = { state: state(session), colorings: session.hatched ? colorings(session) : [] };
    else if (path === '/api/v4/local/questions') value = { questions };
    else if (path === '/api/v4/local/colorings') value = { colorings: colorings(session) };
    else if (path === '/api/v4/local/hatch') {
      session.hatched = true; session.role = 'designer';
      value = { role: 'designer', roleTitle: 'Дизайнер', roleTagline: 'Делает сложное понятным', coloring: 'plain', coloringTitle: 'Обычный', palette: plain, shareText: 'Я в «Контуре»: Дизайнер.', state: state(session) };
    } else if (path === '/api/v4/local/egg/open') {
      session.wallet = 0; session.colorings[1] = { ...session.colorings[1], owned: true };
      value = { coloring: 'mint', coloringTitle: 'Мятный сигнал', rarity: 'rare', palette: mint, duplicate: false, refund: 0, shareText: null, state: state(session) };
    } else if (path === '/api/v4/local/coloring/equip') {
      const body = request.postDataJSON();
      if (body.code === 'mint' && session.colorings[1].owned) session.coloring = 'mint';
      value = { state: state(session) };
    } else { status = 404; value = { error: { code: 'NOT_FOUND', message: 'QA route missing' } }; }
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(value) });
  });
}

const errors = [];
function watch(page, profile) {
  page.on('console', (entry) => { if (entry.type() === 'error') errors.push(`${profile} console: ${entry.text()}`); });
  page.on('pageerror', (error) => errors.push(`${profile} pageerror: ${error.message}`));
  page.on('requestfailed', (request) => errors.push(`${profile} requestfailed: ${request.url()} ${request.failure()?.errorText || ''}`));
}

async function phone(browser, origin, { width, height, slot, reduced = false, record = false }) {
  const context = await browser.newContext({
    viewport: { width, height }, screen: { width, height }, hasTouch: true, isMobile: true,
    deviceScaleFactor: 1, locale: 'ru-RU', reducedMotion: reduced ? 'reduce' : 'no-preference',
    ...(record ? { recordVideo: { dir: videos, size: { width, height } } } : {}),
  });
  const page = await context.newPage();
  watch(page, `${width}x${height}${reduced ? '-reduced' : ''}-slot${slot}`);
  await page.addInitScript((id) => {
    window.Telegram = { WebApp: { initData: `dev:${id}`, ready() {}, expand() {}, close() {}, setHeaderColor() {}, setBackgroundColor() {}, HapticFeedback: { impactOccurred() {}, notificationOccurred() {} } } };
  }, 980000 + slot);
  const session = fresh(slot);
  await mockApi(page, session);
  await page.goto(`${origin}/?qa=${slot}${reduced ? '&motion=reduced' : ''}`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'начать' }).waitFor();
  return { context, page, session };
}

async function layout(page, label, width, height) {
  const actual = await page.evaluate(() => {
    const css = [...document.styleSheets].flatMap((sheet) => { try { return [...sheet.cssRules].map((rule) => rule.cssText); } catch { return []; } }).join('\n');
    const visible = (element) => { const rect = element.getBoundingClientRect(); const style = getComputedStyle(element); return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden'; };
    const overflow = [...document.querySelectorAll('button,a,input,select,textarea')].filter(visible).map((element) => { const rect = element.getBoundingClientRect(); return { name: (element.getAttribute('aria-label') || element.textContent || '').trim().slice(0, 60), left: rect.left, right: rect.right }; }).filter((item) => item.left < -1 || item.right > innerWidth + 1);
    const unnamedButtons = [...document.querySelectorAll('button')].filter(visible).filter((button) => !(button.getAttribute('aria-label') || button.textContent || '').trim()).length;
    return { width: innerWidth, height: innerHeight, scrollWidth: document.documentElement.scrollWidth, bodyScrollWidth: document.body.scrollWidth, overflow, unnamedButtons, safeTop: css.includes('safe-area-inset-top'), safeBottom: css.includes('safe-area-inset-bottom'), reducedClass: Boolean(document.querySelector('.lk-reduced-motion')) };
  });
  ok(actual.width === width && actual.height === height, `${label}: viewport ${actual.width}x${actual.height}`);
  ok(actual.scrollWidth <= width && actual.bodyScrollWidth <= width, `${label}: horizontal overflow ${actual.scrollWidth}/${actual.bodyScrollWidth}`);
  ok(actual.overflow.length === 0, `${label}: interactive overflow ${JSON.stringify(actual.overflow)}`);
  ok(actual.unnamedButtons === 0, `${label}: unnamed buttons`);
  ok(actual.safeTop && actual.safeBottom, `${label}: safe-area CSS missing`);
  return actual;
}

async function answer(page) {
  await page.locator('.lk-options button').first().click();
  await page.waitForTimeout(330);
}

async function toQuestion(page, target) {
  await page.getByRole('button', { name: 'начать' }).click(); await page.waitForTimeout(330);
  for (let index = 1; index < target; index += 1) await answer(page);
  await page.locator('.lk-question-number').filter({ hasText: String(target).padStart(2, '0') }).waitFor();
}

async function hash(path) { return createHash('sha256').update(await readFile(path)).digest('hex'); }
const artifacts = [];
async function screenshot(page, name) {
  const path = join(evidence, name); await page.screenshot({ path }); artifacts.push({ name, sha256: await hash(path) });
}
async function saveVideo(context, page, name) {
  const video = page.video(); await context.close(); const path = join(evidence, name); await video.saveAs(path); artifacts.push({ name, sha256: await hash(path) });
}

const { server, origin } = await startServer();
const browser = await chromium.launch({ headless: true });
const viewports = {}; const continuity = {};
try {
  const small = await phone(browser, origin, { width: 320, height: 568, slot: 1 });
  const page = small.page;
  viewports.smallHook = await layout(page, '320 hook', 320, 568); await screenshot(page, '01-hook.png');
  await page.getByRole('button', { name: 'начать' }).click(); await page.waitForTimeout(35); await screenshot(page, '02-hook-start-before.png'); await page.waitForTimeout(300);
  ok(await page.locator('.lk-quiz-egg').getAttribute('data-stage') === '1', 'q1 is not egg stage 1'); await screenshot(page, '03-quiz-q1.png');
  for (let q = 1; q < 4; q += 1) await answer(page);
  ok(await page.locator('.lk-quiz-egg').getAttribute('data-stage') === '4', 'q4 is not egg stage 4'); await screenshot(page, '04-quiz-q4.png');
  const back = page.getByRole('button', { name: '← назад' }); ok(await back.isVisible(), 'back absent before q4 answer'); await page.locator('.lk-options button').first().click(); ok(await back.count() === 0, 'back active during locked answer transition'); await page.waitForTimeout(330);
  for (let q = 5; q < 8; q += 1) await answer(page);
  ok(await page.locator('.lk-quiz-egg').getAttribute('data-stage') === '8', 'q8 is not egg stage 8'); await screenshot(page, '05-quiz-q8.png');
  await page.locator('.lk-options button').first().click(); ok(await page.locator('main.is-egg-responding').count() === 1, 'q8 response gesture absent'); ok(await page.locator('main.lk-first-time--hatching').count() === 0, 'hatching started before gesture end'); ok(await page.getByRole('button', { name: '← назад' }).count() === 0, 'back active during q8 transition');
  await page.waitForTimeout(170); ok(await page.locator('main.lk-first-time--hatching').count() === 0, 'hatching started inside response gesture'); await page.waitForTimeout(180); ok(await page.locator('main.lk-first-time--hatching').count() === 1, 'hatching did not begin after response');
  continuity.hatchBird = await page.locator('.lk-quiz-hatch [data-bird-result]').getAttribute('data-bird-result'); continuity.hatchTint = await page.locator('.lk-quiz-hatch .lk-canonical-bird__tint').getAttribute('style'); ok(continuity.hatchBird === 'magpie', 'unexpected hatch identity');
  await page.getByRole('button', { name: 'что дальше' }).waitFor({ timeout: 4000 }); continuity.revealBird = await page.locator('.lk-quiz-hatch [data-bird-result]').getAttribute('data-bird-result'); continuity.revealTint = await page.locator('.lk-quiz-hatch .lk-canonical-bird__tint').getAttribute('style'); ok(continuity.revealBird === continuity.hatchBird && continuity.revealTint === continuity.hatchTint, 'hatch/reveal continuity failed'); await screenshot(page, '06-bird-reveal.png');
  await page.getByRole('button', { name: 'что дальше' }).click(); await screenshot(page, '07-worm-loop.png'); await page.getByRole('button', { name: 'к моей птице' }).click();
  continuity.homeBird = await page.locator('.lk-bird-stage--home [data-bird-result]').getAttribute('data-bird-result'); continuity.homeTint = await page.locator('.lk-bird-stage--home .lk-canonical-bird__tint').getAttribute('style'); ok(continuity.homeBird === continuity.revealBird && continuity.homeTint === continuity.revealTint, 'reveal/Home continuity failed'); viewports.smallHome = await layout(page, '320 home', 320, 568); await screenshot(page, '08-home.png');
  await page.getByRole('button', { name: 'открыть яйцо' }).click(); await page.getByRole('button', { name: 'надеть окрас' }).waitFor({ timeout: 2000 }); continuity.dropBird = await page.locator('.lk-drop [data-bird-result]').getAttribute('data-bird-result'); ok(continuity.dropBird === continuity.homeBird, 'drop changed identity'); await screenshot(page, '09-new-coloring-drop.png'); await page.getByRole('button', { name: 'надеть окрас' }).click(); await page.waitForTimeout(100);
  continuity.equippedBird = await page.locator('.lk-bird-stage--home [data-bird-result]').getAttribute('data-bird-result'); continuity.equippedTint = await page.locator('.lk-bird-stage--home .lk-canonical-bird__tint').getAttribute('style'); ok(continuity.equippedBird === continuity.homeBird && continuity.equippedTint !== continuity.homeTint, 'equip identity/cosmetic contract failed'); await page.reload({ waitUntil: 'networkidle' }); await page.getByRole('button', { name: 'посмотреть тест заново' }).waitFor(); continuity.reloadBird = await page.locator('.lk-bird-stage--home [data-bird-result]').getAttribute('data-bird-result'); continuity.reloadTint = await page.locator('.lk-bird-stage--home .lk-canonical-bird__tint').getAttribute('style'); ok(continuity.reloadBird === continuity.equippedBird && continuity.reloadTint === continuity.equippedTint, 'reload persistence failed'); await screenshot(page, '10-reload-persistence.png');
  await page.getByRole('button', { name: 'посмотреть тест заново' }).click(); await toQuestion(page, 8); await page.locator('.lk-options button').first().click(); await page.waitForTimeout(350); continuity.replayBird = await page.locator('.lk-quiz-hatch [data-bird-result]').getAttribute('data-bird-result'); continuity.replayTint = await page.locator('.lk-quiz-hatch .lk-canonical-bird__tint').getAttribute('style'); ok(continuity.replayBird === continuity.reloadBird && continuity.replayTint === continuity.reloadTint, 'replay changed identity/palette'); await screenshot(page, '11-replay-same-bird.png'); await small.context.close();

  const large = await phone(browser, origin, { width: 430, height: 1000, slot: 2 }); viewports.largeHook = await layout(large.page, '430 hook', 430, 1000); await screenshot(large.page, '12-large-hook.png'); await toQuestion(large.page, 8); await large.page.locator('.lk-options button').first().click(); await large.page.getByRole('button', { name: 'что дальше' }).waitFor({ timeout: 4000 }); await large.page.getByRole('button', { name: 'что дальше' }).click(); await large.page.getByRole('button', { name: 'к моей птице' }).click(); viewports.largeHome = await layout(large.page, '430 home', 430, 1000); await screenshot(large.page, '13-large-home.png'); await large.context.close();
  const reduced = await phone(browser, origin, { width: 320, height: 568, slot: 3, reduced: true }); viewports.reducedHook = await layout(reduced.page, '320 reduced hook', 320, 568); ok(viewports.reducedHook.reducedClass, 'reduced-motion class absent'); await toQuestion(reduced.page, 8); await reduced.page.locator('.lk-options button').first().click(); await reduced.page.getByRole('button', { name: 'что дальше' }).waitFor({ timeout: 1000 }); ok(await reduced.page.locator('.lk-quiz-hatch [data-bird-result]').getAttribute('data-bird-result') === 'magpie', 'reduced-motion identity changed'); await screenshot(reduced.page, '14-reduced-motion-reveal.png'); await reduced.context.close();

  const video1 = await phone(browser, origin, { width: 320, height: 568, slot: 4, record: true }); await video1.page.waitForTimeout(250); await video1.page.getByRole('button', { name: 'начать' }).click(); await video1.page.waitForTimeout(700); await saveVideo(video1.context, video1.page, 'motion-1-hook-to-q1.webm');
  const video2 = await phone(browser, origin, { width: 320, height: 568, slot: 5, record: true }); await toQuestion(video2.page, 8); await video2.page.waitForTimeout(400); await saveVideo(video2.context, video2.page, 'motion-2-q1-q4-q8-cracks.webm');
  const video3 = await phone(browser, origin, { width: 320, height: 568, slot: 6, record: true }); await toQuestion(video3.page, 8); await video3.page.locator('.lk-options button').first().click(); await video3.page.getByRole('button', { name: 'что дальше' }).waitFor({ timeout: 4000 }); await video3.page.waitForTimeout(300); await saveVideo(video3.context, video3.page, 'motion-3-q8-to-reveal.webm');

  ok(errors.length === 0, `browser console/runtime errors: ${errors.join(' | ')}`);
  const head = (await exec('git', ['rev-parse', 'HEAD'], { cwd: repo })).stdout.trim();
  const distFiles = (await stat(join(dist, 'index.html'))).isFile(); ok(distFiles, 'production dist missing');
  const manifest = { result: 'PASS', exactHead: head, engine: `Chromium / Playwright ${process.env.npm_package_devDependencies__playwright_test || '1.55.0'}`, classification: { browser: 'real Chromium', backend: 'contract-faithful isolated mock; remote staging is a separate gate' }, viewports, continuity, consoleErrors: errors, artifacts, productionBuild: { indexSha256: await hash(join(dist, 'index.html')) } };
  await writeFile(join(evidence, 'browser-acceptance.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  console.log(`KONTUR_BROWSER_ACCEPTANCE_PASS head=${head} artifacts=${artifacts.length}`);
} finally {
  await browser.close(); server.close();
}
