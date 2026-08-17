const prototype = document.querySelector('.prototype');
const panel = document.querySelector('#panel');
const motionToggle = document.querySelector('#motion-toggle');
const pathSteps = Array.from(document.querySelectorAll('.path__step'));
const stateNumber = document.querySelector('#bird-state-number');
const stateName = document.querySelector('#bird-state-name');

const screens = ['start', 'compose', 'preview', 'reply', 'finish'];
const birdStates = [0, 1, 1, 2, 3];
const birdLabels = [
  ['01', 'Осматривается'],
  ['02', 'Нашла нить'],
  ['03', 'Устроила гнездо'],
  ['04', 'Связала шаги'],
];

let screenIndex = 0;
let startedAt = performance.now();
let question = {
  goal: 'Как подтвердить грант в моей ситуации?',
  checked: 'Прочитал закреплённое сообщение и страницу конкурса.',
  needed: 'Нужны актуальная редакция правил и следующий срок.',
};

function buildQuestion() {
  return `${question.goal} ${question.checked} ${question.needed}`.replace(/\s+/g, ' ').trim();
}

function render(index) {
  screenIndex = Math.max(0, Math.min(index, screens.length - 1));
  const template = document.querySelector(`#screen-${screens[screenIndex]}`);
  panel.replaceChildren(template.content.cloneNode(true));

  const birdState = birdStates[screenIndex];
  prototype.dataset.birdState = String(birdState);
  stateNumber.textContent = birdLabels[birdState][0];
  stateName.textContent = birdLabels[birdState][1];

  pathSteps.forEach((step, stepIndex) => {
    step.classList.toggle('is-done', stepIndex < birdState);
    step.classList.toggle('is-active', stepIndex === birdState);
  });

  if (screenIndex === 1) {
    const form = panel.querySelector('#question-form');
    form.elements.goal.value = question.goal;
    form.elements.checked.value = question.checked;
    form.elements.needed.value = question.needed;
  }
  if (screenIndex === 2) {
    panel.querySelector('#question-preview').textContent = buildQuestion();
  }
  if (screenIndex === 3) {
    panel.querySelector('#reply-question').textContent = buildQuestion();
  }
  if (screenIndex === 4) {
    const seconds = Math.max(1, Math.round((performance.now() - startedAt) / 1000));
    panel.querySelector('#result-time').textContent = `Путь до сохранённого результата: ${seconds} сек.`;
  }

  panel.querySelector('button, textarea')?.focus({ preventScroll: true });
}

panel.addEventListener('click', (event) => {
  const action = event.target.closest('[data-action]')?.dataset.action;
  if (!action) return;

  if (action === 'prepare') render(1);
  if (action === 'back-start') render(0);
  if (action === 'published') render(3);
  if (action === 'back-compose') render(1);
  if (action === 'helped') render(4);
  if (action === 'clarify') {
    question.needed = 'Нужно уточнить, какой документ подходит именно для моего случая.';
    render(1);
  }
  if (action === 'reset') reset();
});

panel.addEventListener('submit', (event) => {
  if (event.target.id !== 'question-form') return;
  event.preventDefault();
  const data = new FormData(event.target);
  question = {
    goal: String(data.get('goal') || '').trim(),
    checked: String(data.get('checked') || '').trim(),
    needed: String(data.get('needed') || '').trim(),
  };
  render(2);
});

function reset() {
  startedAt = performance.now();
  question = {
    goal: 'Как подтвердить грант в моей ситуации?',
    checked: 'Прочитал закреплённое сообщение и страницу конкурса.',
    needed: 'Нужны актуальная редакция правил и следующий срок.',
  };
  render(0);
}

document.querySelectorAll('[data-reset]').forEach((element) => {
  element.addEventListener('click', (event) => {
    event.preventDefault();
    reset();
  });
});

motionToggle.addEventListener('change', () => {
  prototype.dataset.motion = motionToggle.checked ? 'on' : 'off';
});

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
motionToggle.checked = !prefersReducedMotion;
prototype.dataset.motion = motionToggle.checked ? 'on' : 'off';
render(0);
