import { filterDestinations, generatePlan, drawDestination } from './core/planEngine.js';
import { renderCityCards, renderPlan, renderResult } from './ui/render.js';

const state = {
  destinations: [],
  current: null,
  selectedDistanceLevel: null,
  selectedDate: null,
  selectedTime: '10:00',
  stayType: 'daytrip',
  departure: '東京',
  region: '全国',
  budget: '',
  mode: 'manual',
};

function getDateStr(offsetDays) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function resolveDate() {
  return state.selectedDate || getDateStr(0);
}

async function init() {
  try {
    const res = await fetch('./data/destinations.json');
    if (!res.ok) throw new Error('データの読み込みに失敗しました');
    state.destinations = await res.json();
    bindEvents();
  } catch (err) {
    document.getElementById('city-cards').innerHTML =
      `<p class="error-state">${err.message}</p>`;
  }
}

function bindEvents() {
  // 距離ボタン
  document.querySelectorAll('.distance-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.distance-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      state.selectedDistanceLevel = parseInt(btn.dataset.value, 10);
      state.current = null;
      state.mode = 'manual';
      renderPlan(null);
      renderCityCards(
        filterDestinations(state.destinations, state.departure, state.selectedDistanceLevel, state.region, state.budget),
        onCitySelect
      );
      document.getElementById('city-cards').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  });

  // 地方フィルタ
  document.querySelectorAll('.region-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.region-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      state.region = btn.dataset.value;
    });
  });

  // 予算フィルタ
  document.querySelectorAll('.budget-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.budget-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      state.budget = btn.dataset.value;
    });
  });

  // 抽選ボタン（自動生成フロー）
  document.getElementById('generatePlanBtn').addEventListener('click', () => {
    if (state.selectedDistanceLevel === null) {
      const cardsEl = document.getElementById('city-cards');
      cardsEl.innerHTML = '<p class="empty-state">まず「どのくらい遠い街へ？」を選んでください。</p>';
      cardsEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      return;
    }

    if (!state.selectedDate) state.selectedDate = getDateStr(0);

    const matches = filterDestinations(
      state.destinations,
      state.departure,
      state.selectedDistanceLevel,
      state.region,
      state.budget
    );

    if (matches.length === 0) {
      const cardsEl = document.getElementById('city-cards');
      cardsEl.innerHTML = '<p class="empty-state">この条件に合う街は現在準備中です。<br>条件を変えて再度お試しください。</p>';
      cardsEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      return;
    }

    const picked = drawDestination(matches);
    if (!picked) {
      document.getElementById('city-cards').innerHTML =
        '<p class="empty-state">この距離の街は現在準備中です。</p>';
      return;
    }

    state.current = picked;
    state.mode = 'auto';
    document.getElementById('city-cards').innerHTML = '';

    const plan = generatePlan(picked, {
      date: resolveDate(),
      time: state.selectedTime,
      stayType: state.stayType,
      departure: state.departure,
    });

    renderResult(plan);
    document.getElementById('plan').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  // 出発地
  document.getElementById('departure-select').addEventListener('change', (e) => {
    state.departure = e.target.value;
  });

  // 日付モード
  document.querySelectorAll('.date-mode-btn').forEach((lbl) => {
    lbl.addEventListener('click', () => {
      document.querySelectorAll('.date-mode-btn').forEach((b) => b.classList.remove('active'));
      lbl.classList.add('active');
      const mode = lbl.dataset.mode;
      document.getElementById('date-custom-wrap').hidden = mode !== 'custom';
      if (mode === 'today')    state.selectedDate = getDateStr(0);
      if (mode === 'tomorrow') state.selectedDate = getDateStr(1);
    });
  });

  document.getElementById('date-input').addEventListener('change', (e) => {
    if (e.target.value) state.selectedDate = e.target.value;
  });

  state.selectedDate = getDateStr(0);

  document.getElementById('time-select').addEventListener('change', (e) => {
    state.selectedTime = e.target.value;
  });

  document.getElementById('stay-select').addEventListener('change', (e) => {
    state.stayType = e.target.value;
  });
}

function onCitySelect(destination) {
  state.current = destination;
  state.mode = 'manual';
  refresh();
  document.getElementById('plan').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function refresh() {
  if (!state.current) return;

  const plan = generatePlan(state.current, {
    date: resolveDate(),
    time: state.selectedTime,
    stayType: state.stayType,
    departure: state.departure,
  });

  if (state.mode === 'auto') {
    renderResult(plan);
  } else {
    renderPlan(plan);
  }
}

init();
