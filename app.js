/* Push-Up Tracker: local-first state and presentation logic. */
const STORAGE_KEY = 'push-up-tracker.v1';
const defaultState = () => ({ version: 1, activeDate: dateKey(new Date()), count: 0, goal: 50, history: {}, reminders: { morning: '09:00', evening: '18:00' } });
let state = loadState();

const el = (id) => document.getElementById(id);
const datesEqual = (a, b) => dateKey(a) === dateKey(b);
function dateKey(date) { const y = date.getFullYear(); const m = String(date.getMonth() + 1).padStart(2, '0'); const d = String(date.getDate()).padStart(2, '0'); return `${y}-${m}-${d}`; }
function parseDate(key) { const [y,m,d] = key.split('-').map(Number); return new Date(y, m - 1, d); }
function addDays(date, days) { const copy = new Date(date); copy.setDate(copy.getDate() + days); return copy; }
function loadState() { try { return { ...defaultState(), ...JSON.parse(localStorage.getItem(STORAGE_KEY)), history: JSON.parse(localStorage.getItem(STORAGE_KEY)).history || {}, reminders: { ...defaultState().reminders, ...(JSON.parse(localStorage.getItem(STORAGE_KEY)).reminders || {}) } }; } catch { return defaultState(); } }
function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

// Archive the prior active day and every skipped calendar day exactly once.
function reconcileDate() {
  const today = dateKey(new Date());
  if (state.activeDate === today) return;
  let cursor = parseDate(state.activeDate);
  const todayDate = parseDate(today);
  while (cursor < todayDate) {
    const key = dateKey(cursor);
    if (!(key in state.history)) state.history[key] = key === state.activeDate ? state.count >= state.goal : false;
    cursor = addDays(cursor, 1);
  }
  state.activeDate = today; state.count = 0; saveState();
}
function calculateStreak() {
  // Today's completion is not archived until tomorrow, so seed it separately.
  let cursor = new Date();
  let streak = 0;
  if (state.count >= state.goal) { streak = 1; cursor = addDays(cursor, -1); }
  else cursor = addDays(cursor, -1);
  while (state.history[dateKey(cursor)] === true) { streak++; cursor = addDays(cursor, -1); }
  return streak;
}
function addPushUps(amount) { reconcileDate(); state.count += amount; saveState(); render(); }
function currentStatus(key, day) { const today = new Date(); if (key === state.activeDate) return state.count >= state.goal ? '✅' : '⬜'; if (day > today || datesEqual(day, today)) return '⬜'; return state.history[key] ? '✅' : '❌'; }
function renderWeek() { const today = new Date(); const mondayOffset = (today.getDay() + 6) % 7; const monday = addDays(today, -mondayOffset); const names = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']; el('week-grid').innerHTML = names.map((name, i) => { const day = addDays(monday, i); const key = dateKey(day); return `<div class="day ${datesEqual(day,today) ? 'today' : ''}"><span>${name}</span><span class="day-mark" aria-label="${name}: ${currentStatus(key, day)}">${currentStatus(key, day)}</span></div>`; }).join(''); }
function render() {
  reconcileDate(); const complete = state.count >= state.goal; const percent = Math.min(100, Math.round((state.count / state.goal) * 100));
  el('today-label').textContent = new Intl.DateTimeFormat(undefined, { weekday:'long', month:'long', day:'numeric' }).format(new Date()).toUpperCase();
  el('current-count').textContent = state.count; el('goal-count').textContent = state.goal; el('completed-stat').textContent = state.count; el('remaining-stat').textContent = Math.max(0, state.goal - state.count); el('percent').textContent = `${percent}%`; el('goal-input').value = state.goal;
  const fill = el('progress-fill'); fill.style.width = `${percent}%`; fill.classList.toggle('complete', complete); const bar = document.querySelector('[role="progressbar"]'); bar.setAttribute('aria-valuemax', state.goal); bar.setAttribute('aria-valuenow', state.count); el('completion-message').hidden = !complete; el('streak-count').textContent = calculateStreak(); renderWeek();
}
function validatePositive(value, maximum = 100000) { const n = Number(value); return Number.isInteger(n) && n > 0 && n <= maximum ? n : null; }

document.querySelectorAll('[data-add]').forEach((button) => button.addEventListener('click', () => addPushUps(Number(button.dataset.add))));
el('custom-form').addEventListener('submit', (event) => { event.preventDefault(); const amount = validatePositive(el('custom-amount').value, 10000); if (!amount) { el('custom-error').textContent = 'Enter a whole number between 1 and 10,000.'; return; } el('custom-error').textContent = ''; el('custom-amount').value = ''; addPushUps(amount); });
el('goal-input').addEventListener('change', (event) => { const goal = validatePositive(event.target.value); if (!goal) { event.target.value = state.goal; return; } state.goal = goal; saveState(); render(); });
el('morning-reminder').addEventListener('change', (event) => { state.reminders.morning = event.target.value; saveState(); }); el('evening-reminder').addEventListener('change', (event) => { state.reminders.evening = event.target.value; saveState(); });
document.querySelectorAll('.tab').forEach((tab) => tab.addEventListener('click', () => { const target = tab.dataset.view; document.querySelectorAll('.view').forEach((view) => { const active = view.id === target; view.hidden = !active; view.classList.toggle('active', active); }); document.querySelectorAll('.tab').forEach((item) => { const active = item === tab; item.classList.toggle('active', active); item.toggleAttribute('aria-current', active); }); }));
document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); }); window.addEventListener('focus', render);
// Reconcile an app left open through midnight as well as apps reopened later.
function scheduleMidnightRefresh() { const now = new Date(); const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1); setTimeout(() => { render(); scheduleMidnightRefresh(); }, midnight - now + 250); }
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('service-worker.js'));
el('morning-reminder').value = state.reminders.morning; el('evening-reminder').value = state.reminders.evening; render();
scheduleMidnightRefresh();
