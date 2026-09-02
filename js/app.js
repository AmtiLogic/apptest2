// app.js
// Wires the engine, the bots, the coach and the interface together, and
// keeps progress in localStorage.

import { makeRng } from './cards.js';
import {
  createTable, startHand, legalActions, applyAction, positionName
} from './engine.js';
import { buildSeats, botAction, personalityFor } from './bots.js';
import { gradeAction, holdingReadout, handTermSlug, LEAKS } from './coach.js';
import { searchTerms } from './glossary.js';
import * as ui from './ui.js';

const STORAGE_KEY = 'holdem-coach-v1';
const HERO_SEAT = 0;
const BOT_DELAY = 620;
const REVEAL_UNLOCK = 20;

const DEFAULT_SETTINGS = { tableSize: 6, coach: true, bigBlind: 2 };

const DEFAULT_STATS = {
  handsPlayed: 0,
  decisions: 0,
  good: 0,
  fine: 0,
  mistake: 0,
  leaks: {},
  botHands: {}
};

const state = {
  settings: Object.assign({}, DEFAULT_SETTINGS),
  stats: Object.assign({}, DEFAULT_STATS),
  table: null,
  timer: null,
  sizerOpen: false
};

// ---------------------------------------------------------------- storage

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (saved && saved.settings) Object.assign(state.settings, saved.settings);
    if (saved && saved.stats) {
      Object.assign(state.stats, DEFAULT_STATS, saved.stats);
      state.stats.leaks = Object.assign({}, saved.stats.leaks || {});
      state.stats.botHands = Object.assign({}, saved.stats.botHands || {});
    }
  } catch (err) {
    // A broken or blocked store just means a fresh start.
  }
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      settings: state.settings,
      stats: state.stats
    }));
  } catch (err) {
    // Private browsing can refuse writes. The game still works.
  }
}

// ------------------------------------------------------------------ table

function buildTable() {
  const size = state.settings.tableSize;
  const bigBlind = state.settings.bigBlind;
  const seats = buildSeats(size, 'You');
  state.table = createTable({
    seats,
    startingStack: bigBlind * 100,
    smallBlind: Math.max(1, Math.round(bigBlind / 2)),
    bigBlind,
    rng: makeRng((Date.now() ^ 0x5f3759df) >>> 0)
  });
  ui.resetBoardAnimation();
}

function hero() {
  return state.table.players[HERO_SEAT];
}

function clearTimer() {
  if (state.timer) {
    clearTimeout(state.timer);
    state.timer = null;
  }
}

// ------------------------------------------------------------- hand cycle

function dealNewHand() {
  clearTimer();
  ui.hideBanner();
  ui.resetBoardAnimation();
  startHand(state.table);
  state.stats.handsPlayed += 1;
  for (const p of state.table.players) {
    if (p.isHuman) continue;
    const key = p.personality;
    state.stats.botHands[key] = (state.stats.botHands[key] || 0) + 1;
  }
  save();
  render();
  step();
}

function step() {
  const t = state.table;
  if (t.handOver) {
    finishHand();
    return;
  }
  if (t.toAct === HERO_SEAT) {
    showHeroActions();
    return;
  }
  const actor = t.players[t.toAct];
  ui.renderWaiting(actor.name + ' is thinking');
  clearTimer();
  state.timer = setTimeout(botTurn, BOT_DELAY);
}

function botTurn() {
  state.timer = null;
  const t = state.table;
  if (t.handOver || t.toAct === HERO_SEAT || t.toAct < 0) {
    step();
    return;
  }
  const seat = t.toAct;
  const action = botAction(t, seat, t.rng);
  const before = t.street;
  applyAction(t, action);
  render();
  if (t.street !== before && !t.handOver) {
    // Give the new community cards a moment to land before the next action.
    clearTimer();
    state.timer = setTimeout(step, 420);
    return;
  }
  step();
}

function heroActs(action) {
  const t = state.table;
  if (t.handOver || t.toAct !== HERO_SEAT) return;
  state.sizerOpen = false;

  if (state.settings.coach) {
    const verdict = gradeAction(t, HERO_SEAT, action);
    if (verdict) {
      recordVerdict(verdict);
      ui.showBanner(verdict);
    }
  }

  const before = t.street;
  applyAction(t, action);
  render();
  if (t.street !== before && !t.handOver) {
    clearTimer();
    state.timer = setTimeout(step, 420);
    return;
  }
  step();
}

function recordVerdict(verdict) {
  state.stats.decisions += 1;
  state.stats[verdict.verdict] = (state.stats[verdict.verdict] || 0) + 1;
  if (verdict.verdict === 'mistake' && verdict.leak) {
    state.stats.leaks[verdict.leak] = (state.stats.leaks[verdict.leak] || 0) + 1;
  }
  save();
}

function finishHand() {
  const t = state.table;
  const results = t.results;
  render();
  if (results) {
    ui.setMessage(resultText(t, results));
  }
  ui.renderNextHand(dealNewHand, 'Next hand');
  save();
}

function resultText(t, results) {
  const parts = [];
  for (const pot of results.pots) {
    const names = pot.winners.map((i) => (i === HERO_SEAT ? 'You' : t.players[i].name));
    const who = names.join(' and ');
    const verb = names.length > 1 ? 'split' : (names[0] === 'You' ? 'win' : 'wins');
    let line = who + ' ' + verb + ' ' + pot.amount;
    if (results.showdown) {
      const hand = results.hands.find((h) => h.seat === pot.winners[0]);
      if (hand) {
        line += ' with [[' + handTermSlug(hand.category) + '|' +
          hand.description.toLowerCase() + ']]';
      }
    }
    parts.push(line);
  }
  if (!results.showdown) parts.push('everyone else folded');
  return parts.join(', ') + '.';
}

// ----------------------------------------------------------- hero actions

function quickRaiseAmount(t, legal) {
  const bb = t.bigBlind;
  let target;
  if (t.street === 'preflop') {
    if (t.currentBet <= bb) {
      target = bb * 3 + bb * countLimpers(t);
    } else {
      target = t.currentBet * 3;
    }
  } else if (legal.isBet) {
    target = Math.round(t.pot * 0.6);
  } else {
    target = Math.round(t.currentBet * 2 + t.pot * 0.4);
  }
  return Math.max(legal.minRaiseTo, Math.min(legal.maxRaiseTo, Math.round(target)));
}

function countLimpers(t) {
  let count = 0;
  for (const entry of t.log) {
    if (entry.type === 'action' && entry.action === 'call') count += 1;
    if (entry.type === 'action' && entry.action === 'raise') count = 0;
  }
  return count;
}

function showHeroActions() {
  const t = state.table;
  const legal = legalActions(t);
  if (!legal) return;
  if (state.sizerOpen) {
    showSizer(legal);
    return;
  }
  ui.renderActionRow({
    legal,
    quickRaiseTo: quickRaiseAmount(t, legal),
    onFold: () => heroActs({ type: 'fold' }),
    onCheckCall: () => heroActs(legal.canCheck ? { type: 'check' } : { type: 'call' }),
    onRaise: (amount) => heroActs({ type: legal.isBet ? 'bet' : 'raise', amount }),
    onOpenSizer: () => {
      state.sizerOpen = true;
      showSizer(legal);
    }
  });
}

function showSizer(legal) {
  const t = state.table;
  ui.renderBetSizer({
    legal,
    pot: t.pot,
    bigBlind: t.bigBlind,
    committed: hero().committed,
    start: quickRaiseAmount(t, legal),
    onConfirm: (amount) => heroActs({ type: legal.isBet ? 'bet' : 'raise', amount }),
    onCancel: () => {
      state.sizerOpen = false;
      showHeroActions();
    }
  });
}

// ------------------------------------------------------------------ render

function render() {
  const t = state.table;
  const heroPlayer = hero();
  const reveal = [];
  const winners = t.handOver && t.results ? t.results.winners : [];
  if (t.handOver && t.results && t.results.showdown) {
    for (const p of t.players) if (p.hasCards && !p.folded) reveal.push(p.index);
  }

  ui.setHandNumber(t.handNumber);
  ui.setCoachState(state.settings.coach);
  ui.renderSeats(t, { reveal, winners });
  ui.renderBoard(t.board);
  ui.setPot(t.pot);

  const readout = heroPlayer.hasCards && !heroPlayer.folded
    ? holdingReadout(heroPlayer.hole, t.board)
    : { markup: heroPlayer.folded ? 'Folded, sitting this one out' : '' };
  ui.renderHero(t, heroPlayer, readout);

  if (!t.handOver) {
    ui.setMessage(streetMessage(t));
  }
}

function streetMessage(t) {
  const pos = positionName(HERO_SEAT, t.buttonIndex, t.players.length);
  const heroPlayer = hero();
  if (heroPlayer.folded) return 'You folded. Watching the rest of the hand.';
  const streetWord = t.street === 'preflop' ? '[[preflop|Before the flop]]' : capitalize(t.street);
  return streetWord + '. You are in [[position|' + longPosition(pos) + ']].';
}

function longPosition(pos) {
  const names = {
    BTN: 'the button', SB: 'the small blind', BB: 'the big blind',
    UTG: 'under the gun', 'UTG+1': 'under the gun plus one',
    'UTG+2': 'under the gun plus two', LJ: 'the lojack',
    HJ: 'the hijack', CO: 'the cutoff'
  };
  return names[pos] || pos;
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ----------------------------------------------------------------- screens

function openGlossary() {
  ui.openScreen('Poker terms', (body) => {
    const input = document.createElement('input');
    input.type = 'search';
    input.className = 'search-input';
    input.placeholder = 'Search terms';
    input.setAttribute('aria-label', 'Search terms');
    body.appendChild(input);

    const list = ui.el('div', 'term-list');
    body.appendChild(list);

    function draw(query) {
      while (list.firstChild) list.removeChild(list.firstChild);
      const found = searchTerms(query);
      if (!found.length) {
        list.appendChild(ui.el('p', 'empty-note', 'No term matches that.'));
        return;
      }
      for (const term of found) {
        const row = ui.el('button', 'term-row');
        row.type = 'button';
        row.appendChild(ui.el('div', 'term-row-title', term.title));
        const plain = term.senses[0].text.replace(/\[\[([^\]|]+)\|?([^\]]*)\]\]/g, (m, a, b) => b || a);
        row.appendChild(ui.el('div', 'term-row-text', plain));
        row.addEventListener('click', () => ui.openTermSheet(term.slug));
        list.appendChild(row);
      }
    }

    input.addEventListener('input', () => draw(input.value));
    draw('');
  });
}

function openStats() {
  ui.openScreen('Your progress', (body) => {
    const stats = state.stats;
    const graded = stats.decisions || 0;
    const pct = graded ? Math.round((stats.good / graded) * 100) : 0;

    const grid = ui.el('div', 'stat-grid');
    grid.appendChild(statCard(stats.handsPlayed, 'Hands played'));
    grid.appendChild(statCard(graded, 'Decisions graded'));
    grid.appendChild(statCard(pct + '%', 'Rated good'));
    body.appendChild(grid);

    body.appendChild(ui.el('div', 'section-title', 'Breakdown'));
    const breakdown = ui.el('div');
    breakdown.appendChild(leakRow('Good decisions', stats.good || 0, 'var(--good)'));
    breakdown.appendChild(leakRow('Fine, playable either way', stats.fine || 0, 'var(--fine)'));
    breakdown.appendChild(leakRow('Mistakes', stats.mistake || 0, 'var(--mistake)'));
    body.appendChild(breakdown);

    body.appendChild(ui.el('div', 'section-title', 'Your leaks, worst first'));
    const leaks = Object.keys(stats.leaks || {})
      .map((key) => ({ key, count: stats.leaks[key], label: LEAKS[key] || key }))
      .filter((row) => row.count > 0)
      .sort((a, b) => b.count - a.count);
    if (!leaks.length) {
      body.appendChild(ui.el('p', 'empty-note',
        graded ? 'No repeated mistakes yet. Keep playing and they will show up here.'
               : 'Play some hands and your repeated mistakes will be listed here, worst first.'));
    } else {
      for (const row of leaks) {
        body.appendChild(leakRow(row.label, row.count + (row.count === 1 ? ' time' : ' times')));
      }
    }

    body.appendChild(ui.el('div', 'section-title', 'Reads on the table'));
    for (const player of state.table.players) {
      if (player.isHuman) continue;
      body.appendChild(botRow(player));
    }
  });
}

function statCard(value, label) {
  const card = ui.el('div', 'stat-card');
  card.appendChild(ui.el('div', 'stat-value', value));
  card.appendChild(ui.el('div', 'stat-label', label));
  return card;
}

function leakRow(name, count, colour) {
  const row = ui.el('div', 'leak-row');
  row.appendChild(ui.el('div', 'leak-name', name));
  const value = ui.el('div', 'leak-count', count);
  if (colour) value.style.color = colour;
  row.appendChild(value);
  return row;
}

function botRow(player) {
  const persona = personalityFor(player);
  const played = state.stats.botHands[player.personality] || 0;
  const row = ui.el('div', 'bot-row');
  row.appendChild(ui.el('div', 'bot-avatar', player.avatar));
  const info = ui.el('div', 'bot-info');
  info.appendChild(ui.el('div', 'bot-name', player.name));
  if (played >= REVEAL_UNLOCK && persona) {
    info.appendChild(ui.el('div', 'bot-read', persona.read));
  } else {
    info.appendChild(ui.el('div', 'bot-read bot-locked',
      'Read unlocks after ' + REVEAL_UNLOCK + ' hands. ' + played + ' of ' + REVEAL_UNLOCK + ' played.'));
  }
  row.appendChild(info);
  return row;
}

function openSettings() {
  ui.openScreen('Setup', (body) => {
    body.appendChild(choiceSetting(
      'Table size',
      'Six handed is the standard practice game. Heads up puts you in every hand.',
      [
        { label: '6 seats', value: 6 },
        { label: '9 seats', value: 9 },
        { label: 'Heads up', value: 2 }
      ],
      state.settings.tableSize,
      (value) => {
        state.settings.tableSize = value;
        save();
        buildTable();
        dealNewHand();
        openSettings();
      }
    ));

    body.appendChild(choiceSetting(
      'Coach',
      'When the coach is on, every decision you make is graded straight away.',
      [{ label: 'On', value: true }, { label: 'Off', value: false }],
      state.settings.coach,
      (value) => {
        state.settings.coach = value;
        save();
        ui.setCoachState(value);
        if (!value) ui.hideBanner();
        openSettings();
      }
    ));

    body.appendChild(choiceSetting(
      'Blinds',
      'Your stack is always one hundred big blinds, so the game plays the same at every level.',
      [
        { label: '1 and 2', value: 2 },
        { label: '2 and 5', value: 5 },
        { label: '5 and 10', value: 10 }
      ],
      state.settings.bigBlind,
      (value) => {
        state.settings.bigBlind = value;
        save();
        buildTable();
        dealNewHand();
        openSettings();
      }
    ));

    body.appendChild(ui.el('div', 'section-title', 'Start over'));
    const reset = ui.el('button', 'danger-btn', 'Reset all stats and progress');
    reset.type = 'button';
    reset.addEventListener('click', () => {
      state.stats = JSON.parse(JSON.stringify(DEFAULT_STATS));
      save();
      buildTable();
      dealNewHand();
      openSettings();
    });
    body.appendChild(reset);
  });
}

function choiceSetting(label, note, options, current, onPick) {
  const row = ui.el('div', 'setting-row');
  row.appendChild(ui.el('div', 'setting-label', label));
  row.appendChild(ui.el('div', 'setting-note', note));
  const choices = ui.el('div', 'choice-row');
  for (const option of options) {
    const btn = ui.el('button', 'choice-btn' + (option.value === current ? ' on' : ''), option.label);
    btn.type = 'button';
    btn.addEventListener('click', () => onPick(option.value));
    choices.appendChild(btn);
  }
  row.appendChild(choices);
  return row;
}

// ------------------------------------------------------------------ events

function wireEvents() {
  document.addEventListener('click', (event) => {
    const term = event.target.closest('[data-term]');
    if (term) {
      ui.openTermSheet(term.dataset.term);
      return;
    }
    if (event.target.closest('[data-close-sheet]')) {
      ui.closeSheet();
      return;
    }
    if (event.target.closest('[data-close-screen]')) {
      ui.closeScreen();
      return;
    }
    const nav = event.target.closest('[data-screen]');
    if (nav) {
      const which = nav.dataset.screen;
      if (which === 'glossary') openGlossary();
      else if (which === 'stats') openStats();
      else openSettings();
      return;
    }
    const seat = event.target.closest('.seat');
    if (seat) showBotRead(Number(seat.dataset.seat));
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const term = event.target.closest && event.target.closest('[data-term]');
    if (term) {
      event.preventDefault();
      ui.openTermSheet(term.dataset.term);
    }
  });
}

function showBotRead(seatIndex) {
  const player = state.table.players[seatIndex];
  if (!player || player.isHuman) return;
  const persona = personalityFor(player);
  const played = state.stats.botHands[player.personality] || 0;
  if (!persona) return;
  if (played >= REVEAL_UNLOCK) {
    ui.openInfoSheet(player.avatar + ' ' + player.name, persona.read,
      'Style: ' + persona.style + '. You have played ' + played + ' hands against this player.');
  } else {
    ui.openInfoSheet(player.avatar + ' ' + player.name,
      'You have not watched this player long enough to have a read yet. Play ' +
      (REVEAL_UNLOCK - played) + ' more hands and their style will be described here.',
      'Reads unlock after ' + REVEAL_UNLOCK + ' hands at the table.');
  }
}

// -------------------------------------------------------------------- boot

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  if (location.protocol !== 'https:' && location.hostname !== 'localhost') return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {
      // Offline support is a bonus, never a requirement.
    });
  });
}

function boot() {
  ui.cacheDom();
  load();
  wireEvents();
  buildTable();
  registerServiceWorker();
  dealNewHand();
}

boot();
