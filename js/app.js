// app.js
// Wires the engine, the bots, the coach and the interface together, and
// keeps progress in localStorage.

import { makeRng } from './cards.js';
import {
  createTable, startHand, legalActions, applyAction, positionName
} from './engine.js';
import { buildSeats, botAction, personalityFor } from './bots.js';
import { gradeAction, holdingReadout, handTermSlug, LEAKS } from './coach.js';
import { searchTerms, allTerms, plainText } from './glossary.js';
import { liveNote } from './live.js';
import { diagramData, oddsData } from './diagrams.js';
import * as ui from './ui.js';

const STORAGE_KEY = 'holdem-coach-v1';
const GAME_KEY = 'holdem-coach-game-v1';
const HERO_SEAT = 0;
const BOT_DELAY = 620;
const REVEAL_UNLOCK = 20;

const DEFAULT_SETTINGS = { tableSize: 6, coach: true, bigBlind: 2 };

// Points reward playing well, never winning chips. A bad call that wins the
// pot is still a bad call, and a good fold that would have won is still a
// good fold, so luck must not move this number.
const XP_FOR = { good: 10, fine: 4, mistake: 0 };
const XP_PER_LEVEL = 120;
// Runs worth stopping on. Close enough together at the start to be reachable,
// far enough apart later that they stay worth something.
const STREAK_MARKS = [5, 10, 20, 35, 50, 75, 100];

const DEFAULT_PROGRESS = {
  xp: 0,
  streak: 0,
  bestStreak: 0,
  swipeFolds: 0,
  termsSeen: {}
};

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
  progress: JSON.parse(JSON.stringify(DEFAULT_PROGRESS)),
  table: null,
  timer: null,
  pending: null,
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
    if (saved && saved.progress) {
      Object.assign(state.progress, DEFAULT_PROGRESS, saved.progress);
      state.progress.termsSeen = Object.assign({}, saved.progress.termsSeen || {});
    }
  } catch (err) {
    // A broken or blocked store just means a fresh start.
  }
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      settings: state.settings,
      stats: state.stats,
      progress: state.progress
    }));
  } catch (err) {
    // Private browsing can refuse writes. The game still works.
  }
}

// The hand in progress, so closing the app and coming back lands you in the
// same seat with the same cards. Everything on the table is plain data apart
// from the random number generator, which is rebuilt on load.
const TABLE_FIELDS = [
  'buttonIndex', 'handNumber', 'deck', 'board', 'pot', 'currentBet',
  'lastRaiseSize', 'toAct', 'lastAggressor', 'preflopAggressor', 'street',
  'log', 'results', 'handOver', 'blindSeats', 'streetFirstActor'
];

const PLAYER_FIELDS = [
  'stack', 'hole', 'folded', 'allIn', 'committed', 'totalCommitted',
  'acted', 'hasCards', 'lastAction', 'wonLast'
];

function saveGame() {
  const t = state.table;
  if (!t) return;
  try {
    const snapshot = { version: 1, tableSize: t.players.length, bigBlind: t.bigBlind, players: [] };
    for (const field of TABLE_FIELDS) snapshot[field] = t[field];
    for (const p of t.players) {
      const row = {};
      for (const field of PLAYER_FIELDS) row[field] = p[field];
      snapshot.players.push(row);
    }
    localStorage.setItem(GAME_KEY, JSON.stringify(snapshot));
  } catch (err) {
    // Storage can be full or blocked. The game still plays, it just will not
    // survive a reload.
  }
}

function clearGame() {
  try {
    localStorage.removeItem(GAME_KEY);
  } catch (err) {
    // Nothing to do.
  }
}

// Rebuild the table from storage. Returns false when there is nothing usable
// saved, in which case the caller deals a fresh hand.
function restoreGame() {
  let snapshot;
  try {
    const raw = localStorage.getItem(GAME_KEY);
    if (!raw) return false;
    snapshot = JSON.parse(raw);
  } catch (err) {
    return false;
  }
  if (!snapshot || snapshot.version !== 1) return false;
  if (snapshot.tableSize !== state.settings.tableSize) return false;
  if (snapshot.bigBlind !== state.settings.bigBlind) return false;
  if (!Array.isArray(snapshot.players) || snapshot.players.length !== state.settings.tableSize) {
    return false;
  }
  if (!Array.isArray(snapshot.board) || !Array.isArray(snapshot.deck)) return false;

  const t = state.table;
  for (const field of TABLE_FIELDS) {
    if (snapshot[field] !== undefined) t[field] = snapshot[field];
  }
  // Seat identities come from the current settings, never from storage, so a
  // tampered or stale save cannot invent players.
  for (let i = 0; i < t.players.length; i++) {
    const saved = snapshot.players[i];
    for (const field of PLAYER_FIELDS) {
      if (saved[field] !== undefined) t.players[i][field] = saved[field];
    }
  }
  if (typeof t.toAct !== 'number' || t.toAct >= t.players.length) t.toAct = -1;
  ui.primeBoard(t.board.length);
  return true;
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
  state.pending = null;
}

// ------------------------------------------------------------- hand cycle

function dealNewHand() {
  clearTimer();
  state.pending = null;
  ui.hideBanner();
  ui.hideResult();
  ui.resetBoardAnimation();
  startHand(state.table);
  state.stats.handsPlayed += 1;
  for (const p of state.table.players) {
    if (p.isHuman) continue;
    const key = p.personality;
    state.stats.botHands[key] = (state.stats.botHands[key] || 0) + 1;
  }
  save();
  saveGame();
  render();
  // Let the cards land before anybody acts on them.
  const dealing = ui.dealHandout(dealingOrder(state.table), HERO_SEAT);
  if (dealing > 0) {
    ui.renderWaiting('');
    clearTimer();
    state.timer = setTimeout(step, dealing);
    return;
  }
  step();
}

// Cards go out one at a time starting left of the button, twice round.
function dealingOrder(t) {
  const order = [];
  const n = t.players.length;
  for (let i = 1; i <= n; i++) {
    const seat = (t.buttonIndex + i) % n;
    if (t.players[seat].hasCards) order.push(seat);
  }
  return order;
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
  // The bot decides now and acts in a moment. Knowing the decision first is
  // what lets a fold go by in a blink while a raise gets room to land, so a
  // table of folds no longer costs you three seconds of watching nothing.
  const action = botAction(t, t.toAct, t.rng);
  state.pending = { seat: t.toAct, action };
  // Out of the hand means nothing left to decide, so offer a way past it.
  ui.renderWaiting(actor.name + ' is thinking', hero().folded ? skipToEnd : null);
  clearTimer();
  state.timer = setTimeout(botTurn, botDelay(action, hero().folded));
}

// How long a bot sits on its decision. Weight follows money: giving up is
// instant, putting chips in is worth a beat.
function botDelay(action, heroIsOut) {
  let ms = BOT_DELAY;
  if (action.type === 'fold') ms = 300;
  else if (action.type === 'check') ms = 460;
  else if (action.type === 'call') ms = 600;
  else ms = 820;
  // Nothing here is your decision any more, so stop making you wait on it.
  if (heroIsOut) ms = Math.round(ms * 0.45);
  return ms;
}

function botTurn() {
  state.timer = null;
  const t = state.table;
  if (t.handOver || t.toAct === HERO_SEAT || t.toAct < 0) {
    state.pending = null;
    step();
    return;
  }
  const seat = t.toAct;
  // Use the decision made when the wait started. Rolling the dice a second
  // time here would throw the first draw away and change the deal.
  const action = state.pending && state.pending.seat === seat
    ? state.pending.action
    : botAction(t, seat, t.rng);
  state.pending = null;
  const before = t.street;
  const chips = ui.captureBets();
  applyAction(t, action);
  saveGame();
  render();
  if (t.street !== before) {
    ui.flyChipsToPot(chips);
    if (!t.handOver) {
      // Give the new community cards a moment to land before the next action.
      dealPause(t);
      return;
    }
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
      // When the decision turned on a price, draw the price.
      if (/[[]pot-odds/.test(verdict.text) || /[[]outs/.test(verdict.text)) {
        verdict.diagram = oddsData(t, HERO_SEAT);
      }
      recordVerdict(verdict);
      ui.showBanner(verdict);
      ui.flashReward(verdict.reward);
    }
  }

  const before = t.street;
  const chips = ui.captureBets();
  applyAction(t, action);
  saveGame();
  render();
  if (t.street !== before) {
    ui.flyChipsToPot(chips);
    if (!t.handOver) {
      dealPause(t);
      return;
    }
  }
  step();
}

// Hold the action area on the new street for a beat, so the buttons for the
// street that just ended are never left sitting there.
function dealPause(t) {
  clearTimer();
  ui.renderWaiting('Dealing the ' + t.street);
  state.timer = setTimeout(step, 560);
}

function recordVerdict(verdict) {
  state.stats.decisions += 1;
  state.stats[verdict.verdict] = (state.stats[verdict.verdict] || 0) + 1;
  if (verdict.verdict === 'mistake' && verdict.leak) {
    state.stats.leaks[verdict.leak] = (state.stats.leaks[verdict.leak] || 0) + 1;
  }

  const before = levelOf(state.progress.xp);
  const gained = XP_FOR[verdict.verdict] || 0;
  state.progress.xp += gained;

  if (verdict.verdict === 'mistake') {
    state.progress.streak = 0;
  } else {
    state.progress.streak += 1;
    if (state.progress.streak > state.progress.bestStreak) {
      state.progress.bestStreak = state.progress.streak;
    }
  }

  const after = levelOf(state.progress.xp);
  verdict.reward = {
    xp: gained,
    streak: state.progress.streak,
    levelUp: after > before ? after : 0,
    milestone: STREAK_MARKS.includes(state.progress.streak) ? state.progress.streak : 0
  };
  save();
  renderProgress();
}

function levelOf(xp) {
  return 1 + Math.floor(xp / XP_PER_LEVEL);
}

function renderProgress() {
  const xp = state.progress.xp;
  ui.setProgress({
    level: levelOf(xp),
    intoLevel: xp % XP_PER_LEVEL,
    perLevel: XP_PER_LEVEL,
    streak: state.progress.streak
  });
}

function finishHand() {
  const t = state.table;
  render();
  if (t.results) {
    ui.setMessage('');
    ui.showResult(buildResult(t, t.results));
  }
  // The next hand comes on its own. A showdown has cards to read, so it gets
  // longer than a pot nobody contested.
  const showdown = !!(t.results && t.results.showdown);
  ui.renderNextHand(dealNewHand, { delay: showdown ? 3400 : 2200 });
  save();
  saveGame();
}

// Who won, how much, and what the hand did to your stack.
function buildResult(t, results) {
  const net = results.net[HERO_SEAT];
  const collected = results.winnings || t.players.map(() => 0);
  const best = Math.max.apply(null, collected);
  // Everyone who collected the most. With a side pot this is the real winner
  // of the hand, not just whoever took the first pile.
  const top = [];
  for (let i = 0; i < collected.length; i++) if (collected[i] === best) top.push(i);
  const heroWon = top.includes(HERO_SEAT);
  const names = top.map((i) => (i === HERO_SEAT ? 'You' : t.players[i].name));

  let headline;
  if (top.length > 1) {
    headline = names.join(' and ') + ' split ' + best;
  } else if (heroWon) {
    headline = 'You win ' + best;
  } else {
    headline = (names[0] || 'Nobody') + ' wins ' + best;
  }
  if (results.pots.length > 1) headline += ' (side pot)';

  const detail = [];
  if (results.showdown) {
    const winning = results.hands.find((h) => h.seat === top[0]);
    if (winning) detail.push('with ' + linkedHand(winning));
    const yours = results.hands.find((h) => h.seat === HERO_SEAT);
    if (yours && !heroWon) detail.push('you had ' + describeFor(yours));
  } else if (heroWon) {
    detail.push('everyone else folded');
  } else {
    detail.push(hero().folded ? 'you folded' : 'no showdown');
  }

  return { headline, net, detail: detail.join(', ') + '.' };
}

// "a pair of twos", but "two pair, nines and fives".
const NEEDS_ARTICLE = [1, 4, 5, 6, 8];

function describeFor(hand) {
  const words = hand.description.toLowerCase();
  return (NEEDS_ARTICLE.includes(hand.category) ? 'a ' : '') + words;
}

function linkedHand(hand) {
  const words = hand.description.toLowerCase();
  const article = NEEDS_ARTICLE.includes(hand.category) ? 'a ' : '';
  return article + '[[' + handTermSlug(hand.category) + '|' + words + ']]';
}

/**
 * Play the rest of the hand out at once. Only offered once the player has
 * folded, so it can never skip a decision of theirs.
 */
function skipToEnd() {
  const t = state.table;
  if (!hero().folded || t.handOver) return;
  clearTimer();
  let guard = 0;
  while (!t.handOver && t.toAct >= 0 && guard < 500) {
    guard += 1;
    // Honour a decision already made and waiting on its timer, so skipping
    // ahead shows the same hand it was about to show.
    const ready = state.pending && state.pending.seat === t.toAct
      ? state.pending.action
      : botAction(t, t.toAct, t.rng);
    state.pending = null;
    applyAction(t, ready);
  }
  saveGame();
  render();
  step();
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
    // Say it loudly until the gesture has been used a few times, then get out
    // of the way.
    teachFold: (state.progress.swipeFolds || 0) < 4,
    onFold: () => {
      state.progress.swipeFolds = (state.progress.swipeFolds || 0) + 1;
      save();
      heroActs({ type: 'fold' });
    },
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
  const heroPlayer = t.players[HERO_SEAT];
  const reveal = [];
  const winners = t.handOver && t.results ? t.results.winners : [];
  const nets = t.handOver && t.results ? t.results.net : null;
  if (t.handOver && t.results && t.results.showdown) {
    for (const p of t.players) if (p.hasCards && !p.folded) reveal.push(p.index);
  }

  ui.setHandNumber(t.handNumber);
  ui.setCoachState(state.settings.coach);
  ui.renderSeats(t, { reveal, winners, nets });
  ui.renderBoard(t.board);
  ui.setPot(t.pot);

  const readout = heroPlayer.hasCards && !heroPlayer.folded
    ? holdingReadout(heroPlayer.hole, t.board)
    : { markup: heroPlayer.folded ? 'Folded, sitting this one out' : '' };
  ui.renderHero(t, heroPlayer, readout, nets ? nets[HERO_SEAT] : null);

  if (!t.handOver) {
    ui.setMessage(streetMessage(t));
  }
}

function streetMessage(t) {
  const pos = positionName(HERO_SEAT, t.buttonIndex, t.players.length);
  const heroPlayer = hero();
  if (heroPlayer.folded) return 'You folded. Watching the rest of the hand.';
  const streetWord = t.street === 'preflop' ? '[[preflop|Before the flop]]' : capitalize(t.street);
  const first = t.streetFirstActor;
  const opener = first === HERO_SEAT
    ? 'you act first'
    : (first >= 0 ? t.players[first].name + ' acts first' : null);
  const rest = opener
    ? capitalize(opener) + ', you are ' + positionClause(pos)
    : 'You are ' + positionClause(pos);
  return streetWord + '. ' + rest + '.';
}

// "on the button", "in the cutoff", "under the gun".
function positionClause(pos) {
  const long = longPosition(pos);
  const linked = '[[position|' + long + ']]';
  if (pos === 'BTN') return 'on ' + linked;
  if (long.indexOf('the ') === 0) return 'in ' + linked;
  return linked;
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
        const title = ui.el('div', 'term-row-title', term.title);
        if (!state.progress.termsSeen[term.slug]) {
          title.appendChild(ui.el('span', 'term-new', 'new'));
        }
        row.appendChild(title);
        row.appendChild(ui.el('div', 'term-row-text', plainText(term.senses[0].text)));
        row.addEventListener('click', () => {
        markTermSeen(term.slug);
        ui.openTermSheet(term.slug);
        draw(input.value);
      });
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

    const level = levelOf(state.progress.xp);
    const grid = ui.el('div', 'stat-grid');
    grid.appendChild(statCard(level, 'Level'));
    grid.appendChild(statCard(pct + '%', 'Rated good'));
    grid.appendChild(statCard(state.progress.bestStreak, 'Best clean run'));
    body.appendChild(grid);

    const toNext = 120 - (state.progress.xp % 120);
    const bar = ui.el('div', 'level-wide');
    const fill = ui.el('div', 'level-wide-fill');
    fill.style.width = Math.round(((120 - toNext) / 120) * 100) + '%';
    bar.appendChild(fill);
    body.appendChild(bar);
    body.appendChild(ui.el('p', 'empty-note',
      state.progress.xp + ' points. ' + toNext + ' more to level ' + (level + 1) +
      '. Points come from decisions, not from winning pots.'));

    const grid2 = ui.el('div', 'stat-grid');
    grid2.appendChild(statCard(stats.handsPlayed, 'Hands played'));
    grid2.appendChild(statCard(graded, 'Decisions graded'));
    grid2.appendChild(statCard(termsSeenCount() + '/' + allTerms().length, 'Terms met'));
    body.appendChild(grid2);

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

function termsSeenCount() {
  return Object.keys(state.progress.termsSeen).length;
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
        clearGame();
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
        clearGame();
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
      state.progress = JSON.parse(JSON.stringify(DEFAULT_PROGRESS));
      save();
      renderProgress();
      clearGame();
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
      markTermSeen(term.dataset.term);
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

function markTermSeen(slug) {
  if (!slug) return;
  const seen = state.progress.termsSeen;
  seen[slug] = (seen[slug] || 0) + 1;
  save();
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

  // True when a worker is already running the show, which means any change of
  // control from here is a new version taking over rather than the first
  // install.
  const hadController = !!navigator.serviceWorker.controller;
  let reloading = false;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return;
    reloading = true;
    // The hand in progress is saved on every action, so picking up the new
    // version costs nothing: the reload lands back in the same seat.
    saveGame();
    location.reload();
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' })
      .then((registration) => {
        // A Home Screen app is usually resumed rather than launched, so check
        // for a new version whenever it comes back to the foreground.
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') {
            registration.update().catch(() => {});
          }
        });
        registration.addEventListener('updatefound', () => {
          const incoming = registration.installing;
          if (!incoming) return;
          incoming.addEventListener('statechange', () => {
            if (incoming.state === 'installed' && navigator.serviceWorker.controller) {
              incoming.postMessage('skip-waiting');
            }
          });
        });
      })
      .catch(() => {
        // Offline support is a bonus, never a requirement.
      });
  });
}

function boot() {
  ui.cacheDom();
  load();
  ui.setLiveNoteProvider((slug) => liveNote(slug, state.table, HERO_SEAT));
  ui.setDiagramProvider((slug) => diagramData(slug, state.table, HERO_SEAT));
  wireEvents();
  buildTable();
  renderProgress();
  registerServiceWorker();
  if (restoreGame()) {
    render();
    step();
  } else {
    dealNewHand();
  }
}

boot();
