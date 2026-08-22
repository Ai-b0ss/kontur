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

const coloringCatalog = [
  ['plain', 'Обычный', 'common', { body: '#edd9b6', belly: '#faeed6', wing: '#d3ae74', tail: '#c09a68', crest: '#c8a26c', beak: '#ef8a52' }],
  ['soot', 'Копчёный', 'common', { body: '#8d8794', belly: '#c4bfc9', wing: '#6f6a77', tail: '#5d5865', crest: '#6f6a77', beak: '#e0a05a' }],
  ['clay', 'Глиняный', 'common', { body: '#c98f6a', belly: '#e8c3a4', wing: '#a9704f', tail: '#95613f', crest: '#a9704f', beak: '#e8b04a' }],
  ['moss', 'Мшистый', 'common', { body: '#9aae86', belly: '#cfdcbd', wing: '#778a63', tail: '#657653', crest: '#778a63', beak: '#e6a24f' }],
  ['ember', 'Уголёк', 'rare', { body: '#e07a4f', belly: '#ffc79a', wing: '#bd5a35', tail: '#9d4526', crest: '#ff9d5c', beak: '#ffd07a' }],
  ['frost', 'Иней', 'rare', { body: '#b9d7e8', belly: '#eaf6ff', wing: '#8fb8d0', tail: '#7aa3bd', crest: '#d6ecfa', beak: '#f0a05a' }],
  ['plum', 'Сливовый', 'rare', { body: '#9a7bb8', belly: '#d9c6ea', wing: '#7c5d9b', tail: '#654a80', crest: '#b193cd', beak: '#f0a05a' }],
  ['aurora', 'Полярный', 'legendary', { body: '#7fe3c0', belly: '#d6fff2', wing: '#4fb8f5', tail: '#7a6bf0', crest: '#a8f0d8', beak: '#ffd07a' }],
  ['gilded', 'Золочёный', 'legendary', { body: '#e8c65a', belly: '#fff2c0', wing: '#c99f2e', tail: '#a8811d', crest: '#ffe08a', beak: '#fff0b0' }],
  ['void', 'Беззвёздный', 'legendary', { body: '#2b2740', belly: '#453f63', wing: '#1d1a2e', tail: '#15121f', crest: '#6a5fa0', beak: '#c5b8ff' }],
].map(([code, title, rarity, palette]) => ({ code, title, rarity, palette }));
const plain = coloringCatalog[0].palette;
const rewardColoring = coloringCatalog[7];
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

function fresh(slot, options = {}) {
  const allOwned = options.allOwned === true;
  const selected = options.coloring || 'plain';
  const available = allOwned ? coloringCatalog : [coloringCatalog[0], rewardColoring];
  return {
    slot,
    hatched: options.hatched === true,
    role: options.role ?? null,
    coloring: selected,
    wallet: options.wallet ?? 5,
    colorings: available.map((item, index) => ({
      ...item,
      owned: allOwned || index === 0,
      equipped: item.code === selected,
    })),
  };
}

function state(session) {
  const current = session.colorings.find((item) => item.code === session.coloring) ?? session.colorings[0];
  const palette = current.palette;
  return {
    serverTime: new Date().toISOString(), gameDay: 21, isDoubleDay: false, hatched: session.hatched,
    features: { eggs: true, community: false, passive: false },
    player: {
      userId: 980000 + session.slot, username: `qa_${session.slot}`, role: session.role,
      roleTitle: session.role ? 'Дизайнер' : null, roleTagline: session.role ? 'Делает сложное понятным' : null,
      birdName: null, coloring: session.coloring, coloringTitle: current.title,
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
      value = { coloring: session.colorings[1].code, coloringTitle: session.colorings[1].title, rarity: session.colorings[1].rarity, palette: session.colorings[1].palette, duplicate: false, refund: 0, shareText: null, state: state(session) };
    } else if (path === '/api/v4/local/coloring/equip') {
      const body = request.postDataJSON();
      if (session.colorings.some((item) => item.code === body.code && item.owned)) session.coloring = body.code;
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

async function phone(browser, origin, { width, height, slot, reduced = false, record = false, sessionOptions = {}, vibeVariant = null }) {
  const context = await browser.newContext({
    viewport: { width, height }, screen: { width, height }, hasTouch: true, isMobile: true,
    deviceScaleFactor: 1, locale: 'ru-RU', reducedMotion: reduced ? 'reduce' : 'no-preference',
    ...(record ? { recordVideo: { dir: videos, size: { width, height } } } : {}),
  });
  const page = await context.newPage();
  watch(page, `${width}x${height}${reduced ? '-reduced' : ''}-slot${slot}`);
  await page.addInitScript(({ id, vibeVariant }) => {
    window.Telegram = { WebApp: { initData: `dev:${id}`, ready() {}, expand() {}, close() {}, setHeaderColor() {}, setBackgroundColor() {}, HapticFeedback: { impactOccurred() {}, notificationOccurred() {} } } };
    if (vibeVariant) window.localStorage.setItem(`kontur:bird-result:${id}`, vibeVariant);
  }, { id: 980000 + slot, vibeVariant });
  const session = fresh(slot, sessionOptions);
  await mockApi(page, session);
  await page.goto(`${origin}/?qa=${slot}${reduced ? '&motion=reduced' : ''}`, { waitUntil: 'networkidle' });
  if (session.hatched) await page.getByRole('button', { name: 'посмотреть тест заново' }).waitFor();
  else await page.getByRole('button', { name: 'начать' }).waitFor();
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

async function hookSeparation(page, label) {
  const actual = await page.evaluate(() => {
    const rect = (selector) => {
      const value = document.querySelector(selector)?.getBoundingClientRect();
      return value ? { top: value.top, bottom: value.bottom, height: value.height } : null;
    };
    return {
      copy: rect('.lk-hook-copy'),
      egg: rect('.lk-quiz-egg-stage'),
      action: rect('.lk-hook-action'),
    };
  });
  ok(actual.copy && actual.egg && actual.action, `${label}: hook surfaces are missing`);
  ok(actual.copy.bottom + 16 <= actual.egg.top, `${label}: copy touches egg ${JSON.stringify(actual)}`);
  ok(actual.egg.bottom + 16 <= actual.action.top, `${label}: egg touches action ${JSON.stringify(actual)}`);
  return actual;
}

async function questionSeparation(page, label) {
  const actual = await page.evaluate(() => {
    const rect = (selector) => {
      const value = document.querySelector(selector)?.getBoundingClientRect();
      return value ? { top: value.top, bottom: value.bottom, height: value.height } : null;
    };
    return {
      ring: rect('.lk-quiz-egg__ring'),
      number: rect('.lk-question-number'),
      kicker: rect('.lk-question--egg > .lk-kicker'),
      heading: rect('.lk-question--egg > h1'),
    };
  });
  ok(actual.ring && actual.number && actual.kicker && actual.heading, `${label}: question surfaces are missing`);
  const firstTextTop = Math.min(actual.number.top, actual.kicker.top, actual.heading.top);
  ok(actual.ring.bottom + 16 <= firstTextTop, `${label}: egg frame touches question copy ${JSON.stringify(actual)}`);
  return { ...actual, firstTextTop, gap: firstTextTop - actual.ring.bottom };
}

async function hatchPaint(page, label) {
  const actual = await page.evaluate(() => {
    const paint = (selector) => {
      const element = document.querySelector(selector);
      const style = element ? getComputedStyle(element) : null;
      return {
        present: Boolean(element),
        opacity: Number(style?.opacity ?? 0),
        transform: style?.transform ?? null,
      };
    };
    return {
      base: paint('.lk-quiz-egg__base'),
      shellLeft: paint('.lk-quiz-egg__shell--left'),
      shellRight: paint('.lk-quiz-egg__shell--right'),
      bird: paint('.lk-quiz-hatch__bird'),
    };
  });
  for (const [surface, state] of Object.entries(actual)) ok(state.present, `${label}: ${surface} is missing`);
  return actual;
}

async function renderedBirdDetail(page, bird, label) {
  const previousBackground = await bird.evaluate((element) => element.style.background);
  await bird.evaluate((element) => { element.style.background = '#111'; });
  let png;
  try {
    png = await bird.screenshot({ animations: 'disabled' });
  } finally {
    await bird.evaluate((element, background) => { element.style.background = background; }, previousBackground);
  }
  const metrics = await page.evaluate(async (bytes) => {
    const bitmap = await createImageBitmap(new Blob([new Uint8Array(bytes)], { type: 'image/png' }));
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(bitmap, 0, 0);
    bitmap.close();
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let samples = 0; let bright = 0; let maxLuma = 0;
    for (let pixel = 0; pixel < pixels.length; pixel += 16) {
      const luma = .2126 * pixels[pixel] + .7152 * pixels[pixel + 1] + .0722 * pixels[pixel + 2];
      samples += 1;
      if (luma > 145) bright += 1;
      if (luma > maxLuma) maxLuma = luma;
    }
    return { width: canvas.width, height: canvas.height, samples, bright, brightRatio: bright / samples, maxLuma };
  }, [...png]);
  ok(metrics.maxLuma > 180, `${label}: rendered bird has no bright master-art detail`);
  ok(metrics.bright >= 20 && metrics.brightRatio > .002, `${label}: rendered bird collapsed to a tint silhouette`);
  return metrics;
}

async function canonicalBird(page, root, label, _expectColoring = true, requireRenderedDetail = false) {
  const selector = `${root} [data-bird-result]`;
  const bird = page.locator(selector).first();
  await bird.waitFor();
  await page.waitForFunction(
    (candidate) => document.querySelector(candidate)?.getAttribute('data-image-ready') === 'true',
    selector,
  );
  const actual = await bird.evaluate((element) => {
    const image = element.querySelector('.lk-result-bird');
    const imageStyle = image ? getComputedStyle(image) : null;
    const imageRect = image?.getBoundingClientRect();
    return {
      resultId: element.getAttribute('data-bird-result'),
      plumageAsset: element.getAttribute('data-plumage-asset'),
      imageReady: element.getAttribute('data-image-ready'),
      imageComplete: image?.complete ?? false,
      naturalWidth: image?.naturalWidth ?? 0,
      naturalHeight: image?.naturalHeight ?? 0,
      imageWidth: imageRect?.width ?? 0,
      imageHeight: imageRect?.height ?? 0,
      imageDisplay: imageStyle?.display ?? null,
      imageVisibility: imageStyle?.visibility ?? null,
      imageOpacity: Number(imageStyle?.opacity ?? 0),
    };
  });
  ok(actual.imageReady === 'true' && actual.imageComplete, `${label}: canonical image is not ready`);
  ok(actual.naturalWidth > 0 && actual.naturalHeight > 0, `${label}: canonical image did not decode`);
  ok(actual.imageWidth > 0 && actual.imageHeight > 0, `${label}: canonical image has no painted box`);
  ok(actual.imageDisplay !== 'none' && actual.imageVisibility !== 'hidden' && actual.imageOpacity > .99, `${label}: master art is hidden`);
  ok(actual.plumageAsset && actual.plumageAsset === await bird.locator('.lk-result-bird').getAttribute('src'), `${label}: plumage asset binding is inconsistent`);
  if (requireRenderedDetail) actual.renderedDetail = await renderedBirdDetail(page, bird, label);
  return actual;
}

async function revealLayout(page, label) {
  await page.waitForFunction(() => {
    const panel = document.querySelector('.lk-reveal--inline');
    return panel && Number(getComputedStyle(panel).opacity) > .99;
  });
  const actual = await page.evaluate(() => {
    const rect = (element) => {
      const value = element?.getBoundingClientRect();
      return value ? { top: value.top, right: value.right, bottom: value.bottom, left: value.left, width: value.width, height: value.height } : null;
    };
    const paintState = (selector) => {
      const element = document.querySelector(selector);
      const style = element ? getComputedStyle(element) : null;
      return { present: Boolean(element), opacity: Number(style?.opacity ?? 0), visibility: style?.visibility ?? null, pointerEvents: style?.pointerEvents ?? null };
    };
    const panel = document.querySelector('.lk-reveal--inline');
    const bird = document.querySelector('.lk-quiz-hatch [data-bird-result]');
    const ring = document.querySelector('.lk-quiz-egg__ring');
    const panelRect = rect(panel);
    const birdRect = rect(bird);
    const ringRect = rect(ring);
    return {
      position: panel ? getComputedStyle(panel).position : null,
      opacity: panel ? Number(getComputedStyle(panel).opacity) : 0,
      panel: panelRect,
      bird: birdRect,
      ring: ringRect,
      hookCopy: paintState('.lk-hook-copy'),
      hookAction: paintState('.lk-hook-action'),
      question: paintState('.lk-question--egg'),
      viewport: { width: innerWidth, height: innerHeight },
      separated: Boolean(panelRect && birdRect && panelRect.top >= birdRect.bottom - 1),
      frameSeparated: Boolean(panelRect && ringRect && panelRect.top >= ringRect.bottom + 6),
    };
  });
  for (const [surface, state] of Object.entries({ hookCopy: actual.hookCopy, hookAction: actual.hookAction, question: actual.question })) {
    ok(!state.present || (state.opacity === 0 && state.visibility === 'hidden' && state.pointerEvents === 'none'), `${label}: stale ${surface} still paints or accepts input`);
  }
  ok(actual.position === 'absolute', `${label}: reveal panel lost absolute layout`);
  ok(actual.opacity > .99, `${label}: reveal panel did not finish its entrance`);
  ok(actual.panel && actual.panel.left >= -1 && actual.panel.right <= actual.viewport.width + 1, `${label}: reveal panel overflows horizontally`);
  ok(actual.panel && actual.panel.top >= -1 && actual.panel.bottom <= actual.viewport.height + 1, `${label}: reveal panel overflows vertically`);
  ok(actual.separated, `${label}: reveal copy overlaps the canonical bird`);
  ok(actual.frameSeparated, `${label}: reveal copy overlaps the outer egg/bird frame`);
  return actual;
}

async function dropLayout(page, label) {
  const actual = await page.evaluate(() => {
    const rect = (selector) => {
      const value = document.querySelector(selector)?.getBoundingClientRect();
      return value ? { top: value.top, right: value.right, bottom: value.bottom, left: value.left, width: value.width, height: value.height } : null;
    };
    return {
      image: rect('.lk-drop .lk-result-bird'),
      heading: rect('.lk-drop h2'),
      copy: rect('.lk-drop > p:not(.lk-kicker)'),
      button: rect('.lk-drop .lk-button'),
      viewport: { width: innerWidth, height: innerHeight },
    };
  });
  console.log(`KONTUR_DROP_LAYOUT ${label} ${JSON.stringify(actual)}`);
  for (const [surface, value] of Object.entries({ image: actual.image, heading: actual.heading, copy: actual.copy, button: actual.button })) {
    ok(value && value.left >= -1 && value.right <= actual.viewport.width + 1, `${label}: ${surface} overflows horizontally`);
  }
  ok(actual.image && actual.heading && actual.image.bottom <= actual.heading.top + 1, `${label}: canonical bird overlaps the coloring title`);
  ok(actual.heading && actual.copy && actual.heading.bottom <= actual.copy.top + 1, `${label}: coloring title overlaps its copy`);
  ok(actual.copy && actual.button && actual.copy.bottom <= actual.button.top + 1, `${label}: coloring copy overlaps the equip action`);
  return actual;
}

async function answer(page) {
  await page.locator('.lk-options button').first().click();
  await page.waitForTimeout(330);
  await waitForQuestionPaint(page);
}

async function waitForQuestionPaint(page) {
  await page.waitForFunction(() => {
    const question = document.querySelector('main.lk-first-time--questions .lk-question--egg');
    if (!question) return false;
    const style = getComputedStyle(question);
    const options = [...question.querySelectorAll('.lk-options button')];
    return Number(style.opacity) > .99
      && style.visibility !== 'hidden'
      && options.length === 4
      && options.every((option) => Number(getComputedStyle(option).opacity) > .99 && !option.disabled);
  });
  return page.locator('main.lk-first-time--questions .lk-question--egg').evaluate((question) => ({
    opacity: Number(getComputedStyle(question).opacity),
    visibility: getComputedStyle(question).visibility,
    number: question.querySelector('.lk-question-number')?.textContent?.trim() ?? null,
  }));
}

async function toQuestion(page, target) {
  await page.getByRole('button', { name: 'начать' }).click(); await page.waitForTimeout(330); await waitForQuestionPaint(page);
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

async function coloringGallery(browser, origin, { slot, role, resultId, vibeVariant = null }) {
  const capture = await phone(browser, origin, {
    width: 430,
    height: 1000,
    slot,
    sessionOptions: { allOwned: true, hatched: true, role, coloring: 'plain', wallet: 0 },
    vibeVariant,
  });
  const { page } = capture;
  const birds = page.locator('.lk-color [data-bird-result]');
  ok(await birds.count() === coloringCatalog.length, `${resultId}: expected ten visible colorings`);
  await page.waitForFunction((expected) => {
    const values = [...document.querySelectorAll('.lk-color [data-bird-result]')];
    return values.length === expected && values.every((item) => item.getAttribute('data-image-ready') === 'true');
  }, coloringCatalog.length);
  const paint = await birds.evaluateAll((items) => items.map((item) => {
    return {
      resultId: item.getAttribute('data-bird-result'),
      plumageAsset: item.getAttribute('data-plumage-asset'),
      imageSrc: item.querySelector('.lk-result-bird')?.getAttribute('src') ?? null,
      tintPresent: Boolean(item.querySelector('.lk-canonical-bird__tint')),
    };
  }));
  ok(paint.every((item) => item.resultId === resultId), `${resultId}: gallery changed bird identity`);
  ok(paint.every((item) => item.plumageAsset === item.imageSrc), `${resultId}: asset binding mismatch`);
  ok(paint.every((item) => !item.tintPresent), `${resultId}: obsolete color-film layer is still present`);
  const renderedHashes = [];
  for (let index = 0; index < coloringCatalog.length; index += 1) {
    renderedHashes.push(createHash('sha256').update(await birds.nth(index).screenshot({ animations: 'disabled' })).digest('hex'));
  }
  const uniqueAssets = new Set(paint.map((item) => item.plumageAsset));
  if (resultId === 'magpie') {
    ok(uniqueAssets.has('/results/magpie.webp'), 'magpie: base plumage is missing');
    ok(uniqueAssets.has('/results/magpie-amber.webp'), 'magpie: amber plumage is missing');
    ok(uniqueAssets.has('/results/magpie-northern.webp'), 'magpie: northern plumage is missing');
    ok(new Set(renderedHashes).size >= 3, 'magpie: real plumage variants do not render differently');
    const proofPath = join(evidence, 'gallery-magpie-real-plumage.png');
    await page.locator('.lk-collection-section').screenshot({ path: proofPath, animations: 'disabled' });
    artifacts.push({ name: 'gallery-magpie-real-plumage.png', sha256: await hash(proofPath) });
  }
  const name = `gallery-${resultId}-10-colorings.png`;
  const path = join(evidence, name);
  await page.locator('.lk-collection-section').screenshot({ path, animations: 'disabled' });
  artifacts.push({ name, sha256: await hash(path) });
  await capture.context.close();
  return {
    resultId,
    count: paint.length,
    uniqueAssets: uniqueAssets.size,
    uniqueRendered: new Set(renderedHashes).size,
  };
}

const { server, origin } = await startServer();
const browser = await chromium.launch({ headless: true });
const viewports = {}; const continuity = {}; const visual = {};
try {
  const small = await phone(browser, origin, { width: 320, height: 568, slot: 1 });
  const page = small.page;
  viewports.smallHook = await layout(page, '320 hook', 320, 568); visual.smallHookSeparation = await hookSeparation(page, '320 hook'); await screenshot(page, '01-hook.png');
  await page.getByRole('button', { name: 'начать' }).click(); await page.waitForTimeout(35); await screenshot(page, '02-hook-start-before.png'); await page.waitForTimeout(295); visual.q1Question = await waitForQuestionPaint(page);
  ok(await page.locator('.lk-quiz-egg').getAttribute('data-stage') === '1', 'q1 is not egg stage 1'); visual.q1Separation = await questionSeparation(page, '320 q1'); await screenshot(page, '03-quiz-q1.png');
  for (let q = 1; q < 4; q += 1) await answer(page);
  visual.q4Question = await waitForQuestionPaint(page); ok(await page.locator('.lk-quiz-egg').getAttribute('data-stage') === '4', 'q4 is not egg stage 4'); visual.q4Separation = await questionSeparation(page, '320 q4'); await screenshot(page, '04-quiz-q4.png');
  const back = page.getByRole('button', { name: '← назад' }); ok(await back.isVisible(), 'back absent before q4 answer'); await page.locator('.lk-options button').first().click(); ok(await back.count() === 0, 'back active during locked answer transition'); await page.waitForTimeout(330); await waitForQuestionPaint(page);
  for (let q = 5; q < 8; q += 1) await answer(page);
  visual.q8Question = await waitForQuestionPaint(page); ok(await page.locator('.lk-quiz-egg').getAttribute('data-stage') === '8', 'q8 is not egg stage 8'); visual.q8Separation = await questionSeparation(page, '320 q8'); await screenshot(page, '05-quiz-q8.png');
  await page.locator('.lk-options button').first().click(); ok(await page.locator('main.lk-first-time--hatching').count() === 0, 'hatching started before gesture end'); ok(await page.getByRole('button', { name: '← назад' }).count() === 0, 'back active during q8 transition');
  await page.waitForTimeout(170); ok(await page.locator('main.lk-first-time--hatching').count() === 0, 'hatching started inside response gesture'); await page.waitForTimeout(180); ok(await page.locator('main.lk-first-time--hatching').count() === 1, 'hatching did not begin after response');
  const hatchBird = page.locator('.lk-quiz-hatch [data-bird-result]');
  continuity.hatchBird = await hatchBird.getAttribute('data-bird-result');
  continuity.hatchAsset = await hatchBird.getAttribute('data-plumage-asset');
  ok(continuity.hatchBird === 'magpie' && Boolean(continuity.hatchAsset), 'unexpected hatch identity');
  visual.hatchIntact = await hatchPaint(page, '320 intact hatch');
  ok(visual.hatchIntact.base.opacity > .98, 'intact hatch lost the whole egg');
  ok(visual.hatchIntact.shellLeft.opacity < .02 && visual.hatchIntact.shellRight.opacity < .02, 'shell fragments appear before the crack opens');
  ok(visual.hatchIntact.bird.opacity < .02, 'bird appears before the shell opens');
  await screenshot(page, '15-hatch-intact.png');
  await page.waitForFunction(() => {
    const shell = document.querySelector('.lk-quiz-egg__shell--left');
    const style = shell ? getComputedStyle(shell) : null;
    return Number(style?.opacity ?? 0) > .35 && style?.transform !== 'none';
  }, null, { timeout: 2500 });
  visual.hatchOpening = await hatchPaint(page, '320 opening hatch');
  ok(visual.hatchOpening.shellLeft.opacity > .35 && visual.hatchOpening.shellRight.opacity > .35, 'opened shell fragments are missing');
  ok(visual.hatchOpening.base.opacity < .98, 'whole egg did not yield to the opening shell');
  ok(visual.hatchOpening.bird.opacity < .1, 'bird became visible before shell opening was established');
  await screenshot(page, '16-hatch-opening.png');
  await page.getByRole('button', { name: 'что дальше' }).waitFor({ timeout: 4000 }); visual.reveal = await canonicalBird(page, '.lk-quiz-hatch', '320 reveal', true, true); continuity.revealBird = visual.reveal.resultId; continuity.revealAsset = visual.reveal.plumageAsset; ok(continuity.revealBird === continuity.hatchBird && continuity.revealAsset === continuity.hatchAsset, 'hatch/reveal continuity failed'); visual.smallRevealLayout = await revealLayout(page, '320 reveal'); await screenshot(page, '06-bird-reveal.png');
  await page.getByRole('button', { name: 'что дальше' }).click(); await screenshot(page, '07-worm-loop.png'); await page.getByRole('button', { name: 'к моей птице' }).click();
  visual.home = await canonicalBird(page, '.lk-bird-stage--home', '320 Home', true, true); continuity.homeBird = visual.home.resultId; continuity.homeAsset = visual.home.plumageAsset; ok(continuity.homeBird === continuity.revealBird && continuity.homeAsset === continuity.revealAsset, 'reveal/Home continuity failed'); viewports.smallHome = await layout(page, '320 home', 320, 568); await screenshot(page, '08-home.png');
  await page.getByRole('button', { name: 'открыть яйцо' }).click(); await page.getByRole('button', { name: 'надеть окрас' }).waitFor({ timeout: 2000 }); visual.drop = await canonicalBird(page, '.lk-drop', '320 coloring drop', true, true); visual.dropLayout = await dropLayout(page, '320 coloring drop'); continuity.dropBird = visual.drop.resultId; ok(continuity.dropBird === continuity.homeBird, 'drop changed identity'); await page.locator('.lk-drop').screenshot({ path: join(evidence, '09-new-coloring-drop.png') }); artifacts.push({ name: '09-new-coloring-drop.png', sha256: await hash(join(evidence, '09-new-coloring-drop.png')) }); await page.getByRole('button', { name: 'надеть окрас' }).click(); await page.waitForTimeout(100);
  visual.equipped = await canonicalBird(page, '.lk-bird-stage--home', '320 equipped Home', true, true); continuity.equippedBird = visual.equipped.resultId; continuity.equippedAsset = visual.equipped.plumageAsset; ok(continuity.equippedBird === continuity.homeBird && continuity.equippedAsset !== continuity.homeAsset, 'equip identity/cosmetic contract failed'); await page.reload({ waitUntil: 'networkidle' }); await page.getByRole('button', { name: 'посмотреть тест заново' }).waitFor(); await page.evaluate(() => window.scrollTo(0, 0)); visual.reload = await canonicalBird(page, '.lk-bird-stage--home', '320 reload Home', true, true); continuity.reloadBird = visual.reload.resultId; continuity.reloadAsset = visual.reload.plumageAsset; ok(continuity.reloadBird === continuity.equippedBird && continuity.reloadAsset === continuity.equippedAsset, 'reload persistence failed'); await page.evaluate(() => window.scrollTo(0, 0)); ok(await page.evaluate(() => window.scrollY === 0), 'reload evidence is not anchored at the top of Home'); await screenshot(page, '10-reload-persistence.png');
  await page.getByRole('button', { name: 'посмотреть тест заново' }).click(); await toQuestion(page, 8); await page.locator('.lk-options button').first().click(); await page.waitForTimeout(350); visual.replayHatch = await canonicalBird(page, '.lk-quiz-hatch', '320 replay hatch'); continuity.replayBird = visual.replayHatch.resultId; continuity.replayAsset = visual.replayHatch.plumageAsset; ok(continuity.replayBird === continuity.reloadBird && continuity.replayAsset === continuity.reloadAsset, 'replay changed identity/plumage'); await page.getByRole('button', { name: 'что дальше' }).waitFor({ timeout: 4000 }); visual.replayReveal = await canonicalBird(page, '.lk-quiz-hatch', '320 replay reveal', true, true); ok(visual.replayReveal.resultId === continuity.reloadBird && visual.replayReveal.plumageAsset === continuity.reloadAsset, 'replay reveal changed identity/plumage'); visual.replayRevealLayout = await revealLayout(page, '320 replay reveal'); await screenshot(page, '11-replay-same-bird.png'); await small.context.close();

  const large = await phone(browser, origin, { width: 430, height: 1000, slot: 2 }); viewports.largeHook = await layout(large.page, '430 hook', 430, 1000); visual.largeHookSeparation = await hookSeparation(large.page, '430 hook'); await screenshot(large.page, '12-large-hook.png'); await toQuestion(large.page, 8); visual.largeQ8Separation = await questionSeparation(large.page, '430 q8'); await large.page.locator('.lk-options button').first().click(); await large.page.getByRole('button', { name: 'что дальше' }).waitFor({ timeout: 4000 }); visual.largeReveal = await canonicalBird(large.page, '.lk-quiz-hatch', '430 reveal', true, true); visual.largeRevealLayout = await revealLayout(large.page, '430 reveal'); await large.page.getByRole('button', { name: 'что дальше' }).click(); await large.page.getByRole('button', { name: 'к моей птице' }).click(); visual.largeHome = await canonicalBird(large.page, '.lk-bird-stage--home', '430 Home', true, true); viewports.largeHome = await layout(large.page, '430 home', 430, 1000); await screenshot(large.page, '13-large-home.png'); await large.context.close();
  const medium = await phone(browser, origin, { width: 390, height: 844, slot: 7 }); viewports.mediumHook = await layout(medium.page, '390 hook', 390, 844); visual.mediumHookSeparation = await hookSeparation(medium.page, '390 hook'); await screenshot(medium.page, '17-hook-390x844.png'); await medium.context.close();
  const reduced = await phone(browser, origin, { width: 320, height: 568, slot: 3, reduced: true }); viewports.reducedHook = await layout(reduced.page, '320 reduced hook', 320, 568); ok(viewports.reducedHook.reducedClass, 'reduced-motion class absent'); await toQuestion(reduced.page, 8); await reduced.page.locator('.lk-options button').first().click(); await reduced.page.getByRole('button', { name: 'что дальше' }).waitFor({ timeout: 1000 }); visual.reducedReveal = await canonicalBird(reduced.page, '.lk-quiz-hatch', '320 reduced reveal', true, true); ok(visual.reducedReveal.resultId === 'magpie', 'reduced-motion identity changed'); visual.reducedRevealLayout = await revealLayout(reduced.page, '320 reduced reveal'); await screenshot(reduced.page, '14-reduced-motion-reveal.png'); await reduced.context.close();

  const video1 = await phone(browser, origin, { width: 320, height: 568, slot: 4, record: true }); await video1.page.waitForTimeout(250); await video1.page.getByRole('button', { name: 'начать' }).click(); await video1.page.waitForTimeout(700); await saveVideo(video1.context, video1.page, 'motion-1-hook-to-q1.webm');
  const video2 = await phone(browser, origin, { width: 320, height: 568, slot: 5, record: true }); await toQuestion(video2.page, 8); await video2.page.waitForTimeout(400); await saveVideo(video2.context, video2.page, 'motion-2-q1-q4-q8-cracks.webm');
  const video3 = await phone(browser, origin, { width: 320, height: 568, slot: 6, record: true }); await toQuestion(video3.page, 8); await video3.page.locator('.lk-options button').first().click(); await video3.page.getByRole('button', { name: 'что дальше' }).waitFor({ timeout: 4000 }); await video3.page.waitForTimeout(300); await saveVideo(video3.context, video3.page, 'motion-3-q8-to-reveal.webm');

  visual.coloringGalleries = [];
  visual.coloringGalleries.push(await coloringGallery(browser, origin, { slot: 8, role: 'designer', resultId: 'magpie' }));
  visual.coloringGalleries.push(await coloringGallery(browser, origin, { slot: 9, role: 'coder', resultId: 'woodpecker' }));
  visual.coloringGalleries.push(await coloringGallery(browser, origin, { slot: 10, role: 'creative', resultId: 'jay' }));
  visual.coloringGalleries.push(await coloringGallery(browser, origin, { slot: 11, role: 'manager', resultId: 'crane' }));
  visual.coloringGalleries.push(await coloringGallery(browser, origin, { slot: 12, role: 'vibe', resultId: 'owl', vibeVariant: 'owl' }));
  visual.coloringGalleries.push(await coloringGallery(browser, origin, { slot: 13, role: 'vibe', resultId: 'kotosov', vibeVariant: 'kotosov' }));

  const walkthrough = await phone(browser, origin, { width: 320, height: 568, slot: 14, record: true });
  await walkthrough.page.waitForTimeout(650);
  await walkthrough.page.getByRole('button', { name: 'начать' }).click();
  await walkthrough.page.waitForTimeout(650);
  for (let index = 0; index < questions.length; index += 1) {
    await walkthrough.page.locator('.lk-options button').first().click();
    await walkthrough.page.waitForTimeout(index === questions.length - 1 ? 2800 : 650);
  }
  await walkthrough.page.getByRole('button', { name: 'что дальше' }).waitFor({ timeout: 4000 });
  await walkthrough.page.waitForTimeout(700);
  await walkthrough.page.getByRole('button', { name: 'что дальше' }).click();
  await walkthrough.page.waitForTimeout(900);
  await walkthrough.page.getByRole('button', { name: 'к моей птице' }).click();
  await walkthrough.page.waitForTimeout(900);
  await walkthrough.page.locator('.lk-collection-section').scrollIntoViewIfNeeded();
  await walkthrough.page.waitForTimeout(900);
  await saveVideo(walkthrough.context, walkthrough.page, 'KONTUR_VISUAL_FIX_WALKTHROUGH.webm');

  ok(errors.length === 0, `browser console/runtime errors: ${errors.join(' | ')}`);
  const head = (await exec('git', ['rev-parse', 'HEAD'], { cwd: repo })).stdout.trim();
  const distFiles = (await stat(join(dist, 'index.html'))).isFile(); ok(distFiles, 'production dist missing');
  const manifest = { result: 'PASS', exactHead: head, engine: `Chromium / Playwright ${process.env.npm_package_devDependencies__playwright_test || '1.55.0'}`, classification: { browser: 'real Chromium', backend: 'contract-faithful isolated mock; remote staging is a separate gate' }, viewports, continuity, visual, consoleErrors: errors, artifacts, productionBuild: { indexSha256: await hash(join(dist, 'index.html')) } };
  await writeFile(join(evidence, 'browser-acceptance.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  console.log(`KONTUR_BROWSER_ACCEPTANCE_PASS head=${head} artifacts=${artifacts.length}`);
} finally {
  await browser.close(); server.close();
}
