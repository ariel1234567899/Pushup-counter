/* Push-Up Tracker: local-first state, history, and presentation logic. */
const STORAGE_KEY = 'push-up-tracker.v1';
const defaultState = () => ({ version: 3, activeDate: dateKey(new Date()), count: 0, goal: 50, history: {}, reminders: { morning: '09:00', evening: '18:00' }, notifications: { enabled: false, serviceUrl: window.PUSH_SERVICE_URL || '' } });
let state = loadState();
let selectedHistoryDate = dateKey(new Date());
let historyMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
let pushConfig = null;

const el = (id) => document.getElementById(id);
function dateKey(date) { const y = date.getFullYear(); const m = String(date.getMonth() + 1).padStart(2, '0'); const d = String(date.getDate()).padStart(2, '0'); return `${y}-${m}-${d}`; }
function parseDate(key) { const [y, m, d] = key.split('-').map(Number); return new Date(y, m - 1, d); }
function addDays(date, days) { const copy = new Date(date); copy.setDate(copy.getDate() + days); return copy; }
function datesEqual(a, b) { return dateKey(a) === dateKey(b); }
function isBeforeToday(date) { const day = new Date(date.getFullYear(), date.getMonth(), date.getDate()); const today = new Date(); today.setHours(0, 0, 0, 0); return day < today; }
function normaliseHistory(history) {
  return Object.fromEntries(Object.entries(history || {}).map(([key, record]) => {
    // v1 stored completion booleans. Preserve them even though their exact count is unavailable.
    if (typeof record === 'boolean') return [key, { count: record ? null : 0, goal: null, completed: record }];
    return [key, { count: Number.isInteger(record.count) ? record.count : 0, goal: record.goal || null, completed: Boolean(record.completed) }];
  }));
}
function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return { ...defaultState(), ...saved, version: 3, history: normaliseHistory(saved.history), reminders: { ...defaultState().reminders, ...(saved.reminders || {}) }, notifications: { ...defaultState().notifications, ...(saved.notifications || {}) } };
  } catch { return defaultState(); }
}
function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function archiveRecord(count, goal) { return { count, goal, completed: count >= goal }; }
function recordFor(key) { return key === state.activeDate ? archiveRecord(state.count, state.goal) : state.history[key]; }

// Archive the prior active day and every skipped calendar day exactly once.
function reconcileDate() {
  const today = dateKey(new Date());
  if (state.activeDate === today) return;
  let cursor = parseDate(state.activeDate);
  const todayDate = parseDate(today);
  while (cursor < todayDate) {
    const key = dateKey(cursor);
    if (!(key in state.history)) state.history[key] = key === state.activeDate ? archiveRecord(state.count, state.goal) : archiveRecord(0, state.goal);
    cursor = addDays(cursor, 1);
  }
  state.activeDate = today; state.count = 0; saveState();
}
function calculateStreak() {
  let cursor = new Date(); let streak = 0;
  if (state.count >= state.goal) { streak = 1; cursor = addDays(cursor, -1); } else cursor = addDays(cursor, -1);
  while (recordFor(dateKey(cursor))?.completed) { streak++; cursor = addDays(cursor, -1); }
  return streak;
}
function changeCount(amount) { reconcileDate(); state.count = Math.max(0, state.count + amount); saveState(); render(); }
function statusFor(key, day) { if (!isBeforeToday(day) && key !== state.activeDate) return '⬜'; return recordFor(key)?.completed ? '✅' : key === state.activeDate ? '⬜' : '❌'; }
function renderWeek() {
  const today = new Date(); const sunday = addDays(today, -today.getDay()); const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  el('week-grid').innerHTML = names.map((name, index) => { const day = addDays(sunday, index); const key = dateKey(day); const status = statusFor(key, day); return `<div class="day ${datesEqual(day, today) ? 'today' : ''}"><span>${name}</span><span class="day-mark" aria-label="${name}: ${status}">${status}</span></div>`; }).join('');
}
function renderHistory() {
  const monthLabel = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(historyMonth);
  el('calendar-month').textContent = monthLabel;
  const firstDay = new Date(historyMonth.getFullYear(), historyMonth.getMonth(), 1);
  const daysInMonth = new Date(historyMonth.getFullYear(), historyMonth.getMonth() + 1, 0).getDate();
  const cells = Array.from({ length: firstDay.getDay() }, () => '<span class="calendar-day empty"></span>');
  for (let dayNumber = 1; dayNumber <= daysInMonth; dayNumber++) {
    const day = new Date(historyMonth.getFullYear(), historyMonth.getMonth(), dayNumber); const key = dateKey(day); const record = recordFor(key); const future = !isBeforeToday(day) && key !== state.activeDate; const stateClass = record?.completed ? 'complete' : isBeforeToday(day) ? 'incomplete' : 'future';
    cells.push(`<button class="calendar-day ${stateClass} ${key === selectedHistoryDate ? 'selected' : ''}" data-history-date="${key}" type="button"${future ? ' disabled' : ''} aria-label="${dayNumber}, ${record?.completed ? 'goal completed' : future ? 'future date' : 'goal not completed'}">${dayNumber}</button>`);
  }
  el('calendar-grid').innerHTML = cells.join('');
  const selected = parseDate(selectedHistoryDate); const record = recordFor(selectedHistoryDate); const isFuture = !isBeforeToday(selected) && selectedHistoryDate !== state.activeDate;
  const dateText = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(selected);
  let content = `<p class="detail-date">${dateText}</p>`;
  if (isFuture) content += '<p class="detail-count">No data yet</p><p class="detail-status">This date is still ahead.</p>';
  else if (!record) content += '<p class="detail-count">No record</p><p class="detail-status">No activity was recorded for this date.</p>';
  else if (record.count === null) content += `<p class="detail-count">${record.completed ? 'Goal met' : 'Not met'}</p><p class="detail-status">The exact count was recorded before history totals were added.</p>`;
  else content += `<p class="detail-count">${record.count} push-up${record.count === 1 ? '' : 's'}</p><p class="detail-status ${record.completed ? 'complete-text' : ''}">${record.completed ? `Goal completed — ${record.goal} goal` : `Goal not completed — ${record.goal} goal`}</p>`;
  el('history-detail').innerHTML = content;
}
function render() {
  reconcileDate(); const complete = state.count >= state.goal; const percent = Math.min(100, Math.round((state.count / state.goal) * 100));
  el('today-label').textContent = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date()).toUpperCase();
  el('current-count').textContent = state.count; el('goal-count').textContent = state.goal; el('completed-stat').textContent = state.count; el('remaining-stat').textContent = Math.max(0, state.goal - state.count); el('percent').textContent = `${percent}%`; el('goal-input').value = state.goal;
  const fill = el('progress-fill'); fill.style.width = `${percent}%`; fill.classList.toggle('complete', complete); const bar = document.querySelector('[role="progressbar"]'); bar.setAttribute('aria-valuemax', state.goal); bar.setAttribute('aria-valuenow', state.count); el('completion-message').hidden = !complete; el('streak-count').textContent = calculateStreak(); renderWeek(); renderHistory();
}
function validatePositive(value, maximum = 100000) { const number = Number(value); return Number.isInteger(number) && number > 0 && number <= maximum ? number : null; }

function isPushSupported() { return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window; }
function isStandalone() { return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true; }
function isIosBrowser() { return /iPad|iPhone|iPod/.test(navigator.userAgent); }
function pushUrl() { return state.notifications.serviceUrl.replace(/\/$/, ''); }
function setPushStatus(message) { el('push-status').textContent = message; }
function toUint8Array(base64) { const padded = `${base64}${'='.repeat((4 - base64.length % 4) % 4)}`.replace(/-/g, '+').replace(/_/g, '/'); return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0)); }
function clientId() { let id = localStorage.getItem('push-up-tracker.client-id'); if (!id) { id = crypto.randomUUID(); localStorage.setItem('push-up-tracker.client-id', id); } return id; }
async function loadPushConfig() {
  if (!pushUrl()) return null;
  const response = await fetch(`${pushUrl()}/v1/config`);
  if (!response.ok) throw new Error('Could not reach the notification service.');
  pushConfig = await response.json(); return pushConfig;
}
async function syncSubscription(registration) {
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;
  const response = await fetch(`${pushUrl()}/v1/subscriptions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clientId: clientId(), subscription: subscription.toJSON(), schedule: { morning: state.reminders.morning, evening: state.reminders.evening, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone } }) });
  if (!response.ok) throw new Error('Could not save the reminder subscription.');
}
async function enablePush() {
  if (!isPushSupported()) throw new Error('Push notifications are not supported in this browser.');
  if (isIosBrowser() && !isStandalone()) throw new Error('On iPhone, add Push-Up Tracker to the Home Screen first, then enable reminders from the installed app.');
  if (!pushUrl()) throw new Error('Paste your notification service URL first.');
  const config = pushConfig || await loadPushConfig();
  if (!config?.publicKey) throw new Error('The notification service is missing its public key.');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Notifications were not allowed. You can enable them later in your device settings.');
  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toUint8Array(config.publicKey) });
  await syncSubscription(registration); state.notifications.enabled = true; saveState(); setPushStatus('Push reminders are on.');
}
async function disablePush() {
  const registration = await navigator.serviceWorker.ready; const subscription = await registration.pushManager.getSubscription();
  if (subscription && pushUrl()) await fetch(`${pushUrl()}/v1/subscriptions/${encodeURIComponent(clientId())}`, { method: 'DELETE' }).catch(() => {});
  if (subscription) await subscription.unsubscribe(); state.notifications.enabled = false; saveState(); setPushStatus('Push reminders are off.');
}
async function updatePushSettings() {
  el('push-enabled').checked = state.notifications.enabled;
  el('push-service-url').value = state.notifications.serviceUrl;
  if (!pushUrl()) { setPushStatus('Set up the notification service to enable reminders.'); return; }
  try { await loadPushConfig(); setPushStatus(state.notifications.enabled ? 'Push reminders are on.' : 'Ready to enable push reminders.'); } catch { setPushStatus('Notification service could not be reached. Check its URL.'); }
}

document.querySelectorAll('[data-add]').forEach((button) => button.addEventListener('click', () => changeCount(Number(button.dataset.add))));
document.querySelectorAll('[data-adjust]').forEach((button) => button.addEventListener('click', () => changeCount(Number(button.dataset.adjust))));
el('custom-form').addEventListener('submit', (event) => { event.preventDefault(); const amount = validatePositive(el('custom-amount').value, 10000); if (!amount) { el('custom-error').textContent = 'Enter a whole number between 1 and 10,000.'; return; } el('custom-error').textContent = ''; el('custom-amount').value = ''; changeCount(amount); });
el('goal-input').addEventListener('change', (event) => { const goal = validatePositive(event.target.value); if (!goal) { event.target.value = state.goal; return; } state.goal = goal; saveState(); render(); });
el('morning-reminder').addEventListener('change', async (event) => { state.reminders.morning = event.target.value; saveState(); if (state.notifications.enabled) { try { await syncSubscription(await navigator.serviceWorker.ready); } catch { setPushStatus('Reminder time saved locally, but cloud sync failed.'); } } }); el('evening-reminder').addEventListener('change', async (event) => { state.reminders.evening = event.target.value; saveState(); if (state.notifications.enabled) { try { await syncSubscription(await navigator.serviceWorker.ready); } catch { setPushStatus('Reminder time saved locally, but cloud sync failed.'); } } });
el('push-service-url').addEventListener('change', async (event) => { if (state.notifications.enabled) await disablePush(); state.notifications.serviceUrl = event.target.value.trim().replace(/\/$/, ''); state.notifications.enabled = false; pushConfig = null; saveState(); el('push-enabled').checked = false; await updatePushSettings(); });
el('push-enabled').addEventListener('change', async (event) => { try { if (event.target.checked) await enablePush(); else await disablePush(); } catch (error) { event.target.checked = false; state.notifications.enabled = false; saveState(); setPushStatus(error.message); } });
el('previous-month').addEventListener('click', () => { historyMonth = new Date(historyMonth.getFullYear(), historyMonth.getMonth() - 1, 1); renderHistory(); }); el('next-month').addEventListener('click', () => { historyMonth = new Date(historyMonth.getFullYear(), historyMonth.getMonth() + 1, 1); renderHistory(); });
el('calendar-grid').addEventListener('click', (event) => { const button = event.target.closest('[data-history-date]'); if (!button) return; selectedHistoryDate = button.dataset.historyDate; renderHistory(); });
document.querySelectorAll('.tab').forEach((tab) => tab.addEventListener('click', () => { const target = tab.dataset.view; document.querySelectorAll('.view').forEach((view) => { const active = view.id === target; view.hidden = !active; view.classList.toggle('active', active); }); document.querySelectorAll('.tab').forEach((item) => { const active = item === tab; item.classList.toggle('active', active); item.toggleAttribute('aria-current', active); }); }));
document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); }); window.addEventListener('focus', render);
function scheduleMidnightRefresh() { const now = new Date(); const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1); setTimeout(() => { render(); scheduleMidnightRefresh(); }, midnight - now + 250); }
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('service-worker.js'));
el('morning-reminder').value = state.reminders.morning; el('evening-reminder').value = state.reminders.evening; render(); updatePushSettings(); scheduleMidnightRefresh();
