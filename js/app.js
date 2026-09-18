// app.js
// Wires the engine, the bots, the coach and the interface together, and
// keeps progress in localStorage.

import { makeRng, handWords } from './cards.js';
import {
  createTable, startHand, legalActions, applyAction, positionName
} from './engine.js';
import { buildSeats, buildRunSeats, botAction, personalityFor } from './bots.js';
import { gradeAction, holdingReadout, handTermSlug, LEAKS } from './coach.js';
import { searchTerms, allTerms, plainText } from './glossary.js';
import { liveNote } from './live.js';
import { diagramData, oddsData } from './diagrams.js';
import {
  SECTORS, HANDS_PER_SECTOR, CONCEPTS, STARTING_STACK, newRun, sectorOf,
  handsLeftInSector, tableChoices, recordDecision, advanceSector, bustRun,
  runRecord, addRunRecord, historySummary, onLesson, focusTally
} from './run.js';
import { startTilt, stopTilt, tiltAvailable, tiltIsRunning, tiltStatus, recentreTilt } from './tilt.js';
import {
  handSummary, emptyPlay, addHand, styleOf, styleRead, trend, dayKey, addToDay,
  daySeries, conceptTotals, conceptSeries, stepSeries
} from './stats.js';
import * as ui from './ui.js';

const STORAGE_KEY = 'holdem-coach-v1';
const GAME_KEY = 'holdem-coach-game-v1';
// Every run ever finished. Nothing in here is ever rewritten, only added to.
const RUNS_KEY = 'holdem-coach-runs-v1';
const HERO_SEAT = 0;
const BOT_DELAY = 620;
const REVEAL_UNLOCK = 20;

const DEFAULT_SETTINGS = { tableSize: 6, coach: true, bigBlind: 2, mode: 'run', tilt: true, peek: true };

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
  // Ideas you have shown you can play, kept across every run you ever make.
  learned: {},
  termsSeen: {}
};

const DEFAULT_STATS = {
  handsPlayed: 0,
  decisions: 0,
  good: 0,
  fine: 0,
  mistake: 0,
  leaks: {},
  botHands: {},
  // How the hands went, as opposed to how the decisions were graded.
  play: null,
  // One bucket a day, so "over time" has something to draw even on the
  // endless table, where there is no run to hang a number on.
  days: {}
};

const state = {
  settings: Object.assign({}, DEFAULT_SETTINGS),
  stats: Object.assign({}, DEFAULT_STATS, { play: emptyPlay(), days: {} }),
  progress: JSON.parse(JSON.stringify(DEFAULT_PROGRESS)),
  table: null,
  timer: null,
  pending: null,
  sizerOpen: false,
  run: null,
  history: []
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
      state.stats.play = Object.assign(emptyPlay(), saved.stats.play || {});
      state.stats.days = Object.assign({}, saved.stats.days || {});
    }
    if (saved && saved.progress) {
      Object.assign(state.progress, DEFAULT_PROGRESS, saved.progress);
      state.progress.termsSeen = Object.assign({}, saved.progress.termsSeen || {});
      state.progress.learned = Object.assign({}, saved.progress.learned || {});
    }
  } catch (err) {
    // A broken or blocked store just means a fresh start.
  }
  loadHistory();
}

// Finished runs live in their own key. Kept separate from everything else so
// that a change to the shape of the settings or the stats can never cost you
// the record of what you have played.
function loadHistory() {
  try {
    const raw = localStorage.getItem(RUNS_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    state.history = Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    state.history = [];
  }
}

function saveHistory() {
  try {
    localStorage.setItem(RUNS_KEY, JSON.stringify(state.history));
  } catch (err) {
    // Out of room or blocked. The run still plays, it just is not recorded.
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
    const snapshot = {
      version: 2,
      tableSize: t.players.length,
      bigBlind: t.bigBlind,
      smallBlind: t.smallBlind,
      startingStack: t.startingStack,
      run: state.run ? JSON.parse(JSON.stringify(state.run)) : null,
      players: []
    };
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
  if (!snapshot || (snapshot.version !== 1 && snapshot.version !== 2)) return false;
  if (!Array.isArray(snapshot.board) || !Array.isArray(snapshot.deck)) return false;

  // A run carries its own table shape, so rebuild the table the run was on
  // before checking anything against it. Without this a reload mid climb
  // would land you back at the practice table.
  const savedRun = snapshot.run;
  if (state.settings.mode === 'run') {
    if (!savedRun || savedRun.over) return false;
    if (!Array.isArray(SECTORS) || savedRun.sector >= SECTORS.length) return false;
    state.run = Object.assign(newRun(0), savedRun);
    state.run.leaks = Object.assign({}, savedRun.leaks || {});
    state.run.sectorScores = (savedRun.sectorScores || []).slice();
    if (!state.run.table) return false;
    buildRunTable();
    if (snapshot.tableSize !== state.table.players.length) return false;
  } else {
    if (savedRun) return false;
    if (snapshot.tableSize !== state.settings.tableSize) return false;
    if (snapshot.bigBlind !== state.settings.bigBlind) return false;
  }
  if (!Array.isArray(snapshot.players) || snapshot.players.length !== state.table.players.length) {
    return false;
  }

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
  if (state.settings.mode === 'run' && state.run && state.run.table) {
    buildRunTable();
    return;
  }
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

/**
 * The table for the step the run is on. The opponents come from the step, the
 * blinds come from the step, and your stack is whatever you walked in with.
 * You do not get topped back up: that is what makes it a run.
 */
function buildRunTable() {
  const run = state.run;
  const sector = sectorOf(run);
  const choice = run.table;
  const bigBlind = sector.bigBlind;
  const seats = buildRunSeats(choice.seats, choice.pool || sector.pool, 'You');
  state.table = createTable({
    seats,
    startingStack: bigBlind * 100,
    smallBlind: Math.max(1, Math.round(bigBlind / 2)),
    bigBlind,
    rng: makeRng((Date.now() ^ 0x5f3759df) >>> 0)
  });
  state.table.players[HERO_SEAT].stack = Math.max(0, Math.round(run.stack));
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
  ui.renderWaiting(actor.name + ' is thinking', heroIsDoneActing() ? skipToEnd : null);
  clearTimer();
  state.timer = setTimeout(botTurn, botDelay(action, heroIsDoneActing()));
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
      verdict.onLesson = onLesson(state.run, verdict) && inRun();
      recordVerdict(verdict);
      ui.showBanner(verdict);
      ui.flashReward(verdict.reward);
      // The count on the lesson chip moves the moment the decision is graded,
      // so you watch it build rather than meet it at the debrief.
      if (verdict.onLesson) renderRunHud();
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
  // Keep offering the skip through the pause. Folding often ends the betting
  // round, so this is the first thing drawn after a fold, and dropping the
  // button here took it away at the exact moment it became useful.
  ui.renderWaiting('Dealing the ' + t.street, heroIsDoneActing() ? skipToEnd : null);
  state.timer = setTimeout(step, 560);
}

function recordVerdict(verdict) {
  // The run scores the step against its own focus; the lifetime stats count
  // everything, the same as they always have.
  if (inRun()) recordDecision(state.run, verdict);
  state.stats.decisions += 1;
  state.stats[verdict.verdict] = (state.stats[verdict.verdict] || 0) + 1;
  addToDay(state.stats.days, dayKey(Date.now()), {
    decisions: 1,
    good: verdict.verdict === 'good' ? 1 : 0,
    mistake: verdict.verdict === 'mistake' ? 1 : 0
  });
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

/**
 * Settle the hand. With `straightOn` the next one is dealt immediately instead
 * of stopping on the result, which is what skipping wants: you folded, so
 * there is nothing here you were waiting to read.
 *
 * The bookkeeping is the same either way. Nothing about the run, the stats or
 * the saved game depends on the result being looked at.
 */
function finishHand(straightOn) {
  const t = state.table;
  recordHandStats(t);
  render();
  if (t.results && !straightOn) {
    ui.setMessage('');
    ui.showResult(buildResult(t, t.results));
  }
  let advance = dealNewHand;
  if (state.run && !state.run.over) {
    const run = state.run;
    run.stack = hero().stack;
    if (run.stack > run.peakStack) run.peakStack = run.stack;
    run.handsThisSector += 1;
    run.handsPlayed += 1;
    renderRunHud();
    advance = nextInRun;
  }
  save();
  saveGame();
  // Straight on still goes through the same door, so the end of a step and
  // the end of a run still stop and show themselves. Only the result of an
  // ordinary hand is what gets skipped past.
  if (straightOn) advance();
  else ui.renderNextHand(advance);
}

/**
 * What the hand said about how you play. Read from the log the engine kept,
 * so a hand you skipped past counts exactly like one you watched.
 */
function recordHandStats(t) {
  if (!t || !t.results) return;
  const hand = handSummary(t, HERO_SEAT);
  if (!state.stats.play) state.stats.play = emptyPlay();
  addHand(state.stats.play, hand);
  addToDay(state.stats.days, dayKey(Date.now()), { hands: 1, won: hand.won ? 1 : 0, net: hand.net });
  if (inRun()) {
    if (!state.run.play) state.run.play = emptyPlay();
    addHand(state.run.play, hand);
  }
}

// ------------------------------------------------------------------- runs

function inRun() {
  return state.settings.mode === 'run' && state.run && !state.run.over;
}

function renderRunHud() {
  if (!inRun()) {
    ui.setRunHud(null);
    return;
  }
  const run = state.run;
  const sector = sectorOf(run);
  ui.setRunHud({
    step: run.sector + 1,
    steps: SECTORS.length,
    name: sector.name,
    focus: sector.focusName,
    handsLeft: handsLeftInSector(run),
    handsPerSector: HANDS_PER_SECTOR,
    bigBlind: sector.bigBlind,
    stack: Math.round(run.stack),
    blindsLeft: Math.floor(run.stack / sector.bigBlind),
    tally: focusTally(run)
  });
}

/** Start a fresh climb. The record of every previous one is untouched. */
function startRun() {
  clearTimer();
  state.run = newRun(state.stats.handsPlayed);
  clearGame();
  ui.hideBanner();
  ui.hideResult();
  showTableChoice();
}

/**
 * What happens after a hand in a run: bust out, move on to the next step, or
 * deal again. Checked here rather than at the deal so the scoreboard for the
 * hand that finished you is still on screen behind it.
 */
function nextInRun() {
  const run = state.run;
  if (!run || run.over) { dealNewHand(); return; }
  // One chip is still a run. You post what you have, you are all in, and you
  // either double through or you are done. Ending it early for being short
  // would take away the only comeback the game has.
  if (run.stack <= 0) {
    endRun('ran out of chips');
    return;
  }
  if (handsLeftInSector(run) <= 0) {
    const step = advanceSector(run);
    save();
    if (step.finished) {
      finishRunRecord();
      ui.showRunOver(runSummary(), startRun);
      return;
    }
    markLearned(step.score);
    showStepDebrief(step.score);
    return;
  }
  dealNewHand();
}

function markLearned(score) {
  if (!score || !score.mastered) return;
  if (state.progress.learned[score.focus]) return;
  state.progress.learned[score.focus] = { at: Date.now(), sector: score.sector };
  save();
}

function endRun(reason) {
  clearTimer();
  bustRun(state.run, reason);
  finishRunRecord();
  ui.showRunOver(runSummary(), startRun);
}

function finishRunRecord() {
  const record = runRecord(state.run);
  state.history = addRunRecord(state.history, record);
  saveHistory();
  clearGame();
  renderRunHud();
}

function runSummary() {
  const run = state.run;
  const leaks = Object.keys(run.leaks)
    .map((key) => ({ label: LEAKS[key] || key, count: run.leaks[key] }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);
  return {
    won: !!run.won,
    endedBy: run.endedBy,
    step: Math.min(run.sector + 1, SECTORS.length),
    steps: SECTORS.length,
    stepName: sectorOf(run).name,
    hands: run.handsPlayed,
    stack: Math.max(0, Math.round(run.stack)),
    peak: Math.round(run.peakStack),
    decisions: run.decisions,
    good: run.good,
    mistake: run.mistake,
    leaks,
    steps_detail: run.sectorScores.map((sc) => ({
      name: sc.name,
      focusName: sc.focusName,
      decisions: sc.decisions,
      mistakes: sc.mistakes,
      cleared: sc.cleared,
      mastered: sc.mastered
    })),
    history: historySummary(state.history)
  };
}

/** The pause between steps: how the last one went, then what is coming. */
function showStepDebrief(score) {
  ui.showStepDebrief({
    finishedName: score.name,
    focusName: score.focusName,
    decisions: score.decisions,
    mistakes: score.mistakes,
    cleared: score.cleared,
    mastered: score.mastered,
    alreadyLearned: !!state.progress.learned[score.focus],
    stack: Math.round(state.run.stack),
    next: nextStepBrief()
  }, showTableChoice);
}

function nextStepBrief() {
  const sector = sectorOf(state.run);
  return {
    step: state.run.sector + 1,
    steps: SECTORS.length,
    name: sector.name,
    focusName: sector.focusName,
    brief: sector.brief,
    lesson: sector.lesson,
    bigBlind: sector.bigBlind,
    blindsLeft: Math.floor(state.run.stack / sector.bigBlind)
  };
}

/** The fork in the road: which table you take into the next step. */
function showTableChoice() {
  const run = state.run;
  const sector = sectorOf(run);
  ui.showTableChoice({
    step: run.sector + 1,
    steps: SECTORS.length,
    name: sector.name,
    focusName: sector.focusName,
    brief: sector.brief,
    lesson: sector.lesson,
    bigBlind: sector.bigBlind,
    stack: Math.round(run.stack),
    blindsLeft: Math.floor(run.stack / sector.bigBlind),
    choices: tableChoices(run.sector)
  }, (choice) => {
    run.table = { key: choice.key, seats: choice.seats, pool: choice.pool.slice() };
    buildRunTable();
    renderRunHud();
    ui.closeScreen();
    dealNewHand();
  });
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
    // Without a showdown there is exactly one player still holding cards, so
    // this never has to pick between several.
    if (peeking()) {
      const still = t.players.find((p) => p.hasCards && !p.folded && !p.isHuman);
      if (still && still.hole.length === 2) {
        detail.push(still.name + ' had ' + handWords(still.hole));
      }
    }
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
 * True when the hand can no longer ask you anything: you folded, or you are
 * all in with nothing left to put in. Skipping is only ever offered here, so
 * it can never skip a decision of yours.
 */
function heroIsDoneActing() {
  const me = hero();
  return !!me && (me.folded || me.allIn || me.stack <= 0);
}

/**
 * Play the rest of the hand out at once, every street of it, and deal the next
 * one. Skipping is offered only when you have folded or are all in, so there
 * is no decision of yours in what it plays and no result you are waiting on.
 */
function skipToEnd() {
  const t = state.table;
  if (!heroIsDoneActing() || t.handOver) return;
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
  if (t.handOver) finishHand(true);
  else step();
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

/**
 * True when the app is showing you a hand nobody had to show: you folded, the
 * pot was taken without a showdown, and the setting allows it.
 */
function peeking() {
  const t = state.table;
  if (!t || !t.handOver || !t.results || t.results.showdown) return false;
  if (state.settings.peek === false) return false;
  return !!t.players[HERO_SEAT].folded;
}

// ------------------------------------------------------------------ render

function render() {
  const t = state.table;
  const heroPlayer = t.players[HERO_SEAT];
  const reveal = [];
  const winners = t.handOver && t.results ? t.results.winners : [];
  const nets = t.handOver && t.results ? t.results.net : null;
  if (t.handOver && t.results) {
    // At a showdown they turned their cards over and everyone sees them.
    // After you fold, the hand plays on without you and whoever takes it
    // never has to show, so you never find out what you folded to. That is
    // correct poker and useless practice, so the app shows you anyway.
    if (t.results.showdown || peeking()) {
      for (const p of t.players) if (p.hasCards && !p.folded) reveal.push(p.index);
    }
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
    const play = stats.play || emptyPlay();
    const style = styleOf(play);

    const grid = ui.el('div', 'stat-grid');
    grid.appendChild(statCard(level, 'Level'));
    grid.appendChild(statCard(pct + '%', 'Rated good'));
    grid.appendChild(statCard(stats.handsPlayed, 'Hands'));
    body.appendChild(grid);

    // ---- Over time. The thing asked for most, so it comes first.
    body.appendChild(ui.el('div', 'section-title', 'Over time'));
    body.appendChild(overTimeCard());
    body.appendChild(stackCard());

    // ---- The climb.
    body.appendChild(ui.el('div', 'section-title', 'The climb'));
    body.appendChild(stepsCard());

    // ---- Winning.
    body.appendChild(ui.el('div', 'section-title', 'Winning'));
    const win = ui.el('div', 'stat-grid');
    win.appendChild(statCard(play.hands ? Math.round(style.winRate * 100) + '%' : '–', 'Hands won'));
    win.appendChild(statCard(play.showdowns ? Math.round(style.showdownRate * 100) + '%' : '–', 'Showdowns won'));
    win.appendChild(statCard(play.hands ? signed(style.perHand.toFixed(1)) : '–', 'Chips a hand'));
    body.appendChild(win);
    body.appendChild(ui.el('p', 'stat-hint',
      'Hands won counts every pot you took, including the ones nobody fought for. ' +
      'Showdowns won is only the pots that went all the way to cards being turned over. ' +
      'Chips a hand is what an average hand is worth to you, over ' + play.hands + (play.hands === 1 ? ' hand.' : ' hands.')));

    // ---- Style.
    body.appendChild(ui.el('div', 'section-title', 'How you play'));
    const sty = ui.el('div', 'chart-card');
    const tiles = ui.el('div', 'stat-grid');
    tiles.appendChild(statCard(play.hands ? Math.round(style.vpip * 100) + '%' : '–', 'Pots entered'));
    tiles.appendChild(statCard(play.hands ? Math.round(style.pfr * 100) + '%' : '–', 'Raised first'));
    tiles.appendChild(statCard(play.hands ? style.aggression.toFixed(1) : '–', 'Bets a call'));
    sty.appendChild(tiles);
    const read = styleRead(style);
    sty.appendChild(ui.el('div', 'style-read', read.label));
    sty.appendChild(ui.el('p', 'style-note', read.note));
    sty.appendChild(ui.el('p', 'stat-hint',
      'Pots entered is how often you put money in before the flop on purpose, not counting blinds. ' +
      'Raised first is how often that was a raise rather than a call. ' +
      'Bets a call is your bets and raises for every call: above one means you lead more than you follow.'));
    body.appendChild(sty);

    // ---- Ideas.
    body.appendChild(ui.el('div', 'section-title', 'The five ideas'));
    const totals = conceptTotals(state.history, inRun() ? state.run : null);
    let anyIdea = false;
    for (const key of Object.keys(CONCEPTS)) {
      const got = !!state.progress.learned[key];
      const c = totals[key];
      if (c && c.n) anyIdea = true;
      body.appendChild(ideaRow(CONCEPTS[key], c, got, conceptSeries(state.history, key)));
    }
    if (!anyIdea) {
      body.appendChild(ui.el('p', 'empty-note',
        'Each idea is scored on its own as you play a run. Clear a step with almost no mistakes on that step’s idea and it is marked learned for good.'));
    }

    // ---- Points.
    body.appendChild(ui.el('div', 'section-title', 'Points'));
    const toNext = 120 - (state.progress.xp % 120);
    const bar = ui.el('div', 'level-wide');
    const fill = ui.el('div', 'level-wide-fill');
    fill.style.width = Math.round(((120 - toNext) / 120) * 100) + '%';
    bar.appendChild(fill);
    body.appendChild(bar);
    body.appendChild(ui.el('p', 'level-note',
      state.progress.xp + ' points. ' + toNext + ' more to level ' + (level + 1) +
      '. Points come from decisions, not from winning pots. Best clean streak: ' + state.progress.bestStreak + '.'));

    body.appendChild(ui.el('div', 'section-title', 'Every decision'));
    const breakdown = ui.el('div');
    breakdown.appendChild(leakRow('Good', stats.good || 0, 'var(--good)'));
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

    body.appendChild(ui.el('div', 'section-title', 'Runs'));
    const summary = historySummary(state.history);
    const runGrid = ui.el('div', 'stat-grid');
    runGrid.appendChild(statCard(summary.runs, 'Runs played'));
    runGrid.appendChild(statCard(summary.wins, 'Completed'));
    runGrid.appendChild(statCard(summary.bestStack, 'Best stack'));
    body.appendChild(runGrid);
    if (!state.history.length) {
      body.appendChild(ui.el('p', 'empty-note',
        'Every run you finish is recorded here and kept. Resetting your stats does not remove them.'));
    } else {
      for (const record of state.history.slice(0, 40)) {
        body.appendChild(runRow(record));
      }
      if (state.history.length > 40) {
        body.appendChild(ui.el('p', 'empty-note',
          state.history.length + ' runs on record. The most recent forty are listed.'));
      }
    }

    body.appendChild(ui.el('div', 'section-title', 'Reads on the table'));
    for (const player of state.table.players) {
      if (player.isHuman) continue;
      body.appendChild(botRow(player));
    }
  });
}

function signed(text) {
  const n = Number(text);
  return (n > 0 ? '+' : '') + text;
}

/**
 * The share of decisions rated good, day by day, with the direction it is
 * moving. Days rather than runs, because the endless table has no runs and
 * a day is the unit anybody thinks of their own practice in.
 */
function overTimeCard() {
  const card = ui.el('div', 'chart-card');
  card.appendChild(ui.el('div', 'chart-title', 'Decisions rated good'));
  const series = daySeries(state.stats.days).filter((d) => d.decisions > 0);
  const values = series.map((d) => d.good / d.decisions);
  card.appendChild(ui.el('div', 'chart-sub', series.length
    ? 'Each point is one day you played, oldest on the left. Long press a point for the number.'
    : 'Each day you play adds a point here.'));
  if (values.length >= 2) {
    card.appendChild(ui.sparkline(values, {
      min: 0, max: 1, label: 'Share of decisions rated good, by day',
      format: (v) => Math.round(v * 100) + '% good',
      pointLabel: (i) => 'on ' + series[i].key
    }));
    card.appendChild(trendRead(values, 5, 'days', (v) => Math.round(v * 100) + '%', 'points'));
  } else {
    card.appendChild(ui.el('p', 'chart-read', values.length === 1
      ? 'One day on record. Come back tomorrow and there will be a line.'
      : 'Nothing graded yet. Play a hand with the coach on.'));
  }
  return card;
}

/** How each run ended for your stack, run by run. */
function stackCard() {
  const card = ui.el('div', 'chart-card');
  card.appendChild(ui.el('div', 'chart-title', 'Chips won or lost, each run'));
  const runs = state.history.slice().reverse().filter((r) => typeof r.net === 'number');
  const values = runs.map((r) => r.net);
  card.appendChild(ui.el('div', 'chart-sub', 'Above the dotted line is a run that finished up. Oldest on the left.'));
  if (values.length >= 2) {
    const lim = Math.max(50, ...values.map(Math.abs));
    card.appendChild(ui.sparkline(values, {
      min: -lim, max: lim, label: 'Chips won or lost per run',
      format: (v) => signed(String(Math.round(v))) + ' chips',
      pointLabel: (i) => whenWords(runs[i].ended || runs[i].at)
    }));
    card.appendChild(trendRead(values, 5, 'runs', (v) => signed(String(Math.round(v))), 'chips'));
  } else {
    card.appendChild(ui.el('p', 'chart-read', 'Two finished runs and this fills in.'));
  }
  return card;
}

/** Which step each run reached, as a column per run. Complete goes higher. */
function stepsCard() {
  const card = ui.el('div', 'chart-card');
  card.appendChild(ui.el('div', 'chart-title', 'How far each run got'));
  // stepSeries turns the newest first history round itself, so it is handed
  // the history as stored and `runs` is the same thirty turned round once for
  // the labels. Reversing both put the newest bar on the left under the
  // oldest label and read the trend backwards.
  const newestFirst = state.history.slice(0, 30);
  const runs = newestFirst.slice().reverse();
  const steps = SECTORS.length;
  const values = stepSeries(newestFirst, steps);
  card.appendChild(ui.el('div', 'chart-sub', runs.length
    ? 'One column a run, oldest on the left. A full height column is a completed run.'
    : 'Every run you finish adds a column.'));
  if (values.length) {
    card.appendChild(ui.columns(values, {
      max: steps + 1, label: 'Step reached per run',
      classOf: (i) => (runs[i].won ? 'won' : ''),
      format: (v, i) => (runs[i].won ? 'Completed' : 'Reached step ' + v + ' of ' + steps) + ', ' + whenWords(runs[i].ended || runs[i].at)
    }));
    const best = Math.max(...values);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const wins = runs.filter((r) => r.won).length;
    const read = ui.el('p', 'chart-read');
    read.appendChild(document.createTextNode('Best: '));
    read.appendChild(ui.el('strong', null, best > steps ? 'completed' : 'step ' + best));
    read.appendChild(document.createTextNode('. Typical: '));
    read.appendChild(ui.el('strong', null, 'step ' + Math.min(steps, avg).toFixed(1)));
    read.appendChild(document.createTextNode('. ' + wins + ' of ' + runs.length + ' completed.'));
    const tr = trend(values, 5);
    if (tr.enough) {
      read.appendChild(document.createTextNode(' Last five runs reached '));
      read.appendChild(ui.el('strong', null, tr.recent.toFixed(1)));
      read.appendChild(document.createTextNode(' on average, the five before '));
      read.appendChild(ui.el('strong', null, tr.earlier.toFixed(1)));
      read.appendChild(document.createTextNode('.'));
    }
    card.appendChild(read);
  } else {
    card.appendChild(ui.el('p', 'chart-read', 'No runs finished yet.'));
  }
  return card;
}

/** "Last five: 72%. The five before: 60%. Up 12 points." */
function trendRead(values, window, unit, fmt, deltaUnit) {
  const tr = trend(values, window);
  const read = ui.el('p', 'chart-read');
  if (!tr.enough) {
    read.appendChild(document.createTextNode('Latest: '));
    read.appendChild(ui.el('strong', null, fmt(values[values.length - 1])));
    read.appendChild(document.createTextNode('. A direction shows after about ' + (window * 2) + ' ' + unit + '.'));
    return read;
  }
  read.appendChild(document.createTextNode('Last ' + window + ' ' + unit + ': '));
  read.appendChild(ui.el('strong', null, fmt(tr.recent)));
  read.appendChild(document.createTextNode('. The ' + window + ' before: '));
  read.appendChild(ui.el('strong', null, fmt(tr.earlier)));
  read.appendChild(document.createTextNode('. '));
  const d = deltaUnit === 'points' ? Math.round(tr.delta * 100) : Math.round(tr.delta);
  if (Math.abs(d) < 1) {
    read.appendChild(document.createTextNode('Holding steady.'));
  } else {
    read.appendChild(ui.el('span', d > 0 ? 'up' : 'down',
      (d > 0 ? 'Up ' : 'Down ') + Math.abs(d) + ' ' + deltaUnit + '.'));
  }
  return read;
}

/** One idea: how it has gone across every run, and whether it is learned. */
function ideaRow(name, totals, learned, series) {
  const n = totals ? totals.n : 0;
  const clean = totals ? totals.n - totals.mistake : 0;
  const rate = n ? clean / n : 0;
  const row = ui.el('div', 'idea-row' + (learned ? ' learned' : '') + (n >= 5 && rate < 0.6 ? ' weak' : ''));
  const top = ui.el('div', 'idea-top');
  top.appendChild(ui.el('div', 'idea-name', name));
  top.appendChild(ui.el('div', 'idea-score',
    learned ? 'Learned' : (n ? Math.round(rate * 100) + '% right' : 'Not met yet')));
  row.appendChild(top);
  const bar = ui.el('div', 'idea-bar');
  const fill = ui.el('div', 'idea-fill');
  fill.style.width = Math.round(rate * 100) + '%';
  bar.appendChild(fill);
  row.appendChild(bar);
  const tr = trend(series, 3);
  let note = n ? clean + ' of ' + n + ' decisions right across your runs.' : '';
  if (tr.enough) {
    const d = Math.round(tr.delta * 100);
    note += Math.abs(d) < 3 ? ' Holding steady run to run.'
      : (d > 0 ? ' Up ' : ' Down ') + Math.abs(d) + ' points over your last three runs.';
  }
  if (note) row.appendChild(ui.el('div', 'idea-note', note));
  return row;
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

// One finished run: how far it got, how big it got, and when.
function runRow(record) {
  const row = ui.el('div', 'run-row' + (record.won ? ' won' : ''));
  const left = ui.el('div');
  const step = Math.min((record.sector || 0) + 1, SECTORS.length);
  left.appendChild(ui.el('div', 'run-row-step',
    record.won ? 'Complete' : 'Step ' + step + ' of ' + SECTORS.length + ', ' + (record.sectorName || '')));
  left.appendChild(ui.el('div', 'run-row-when',
    record.hands + (record.hands === 1 ? ' hand' : ' hands') + ' \u00b7 ' + whenWords(record.ended || record.at)));
  row.appendChild(left);
  row.appendChild(ui.el('div', 'run-row-stat', 'peak ' + (record.peak || 0)));
  return row;
}

function whenWords(stamp) {
  if (!stamp) return 'earlier';
  const days = Math.floor((Date.now() - stamp) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return days + ' days ago';
  const weeks = Math.floor(days / 7);
  return weeks === 1 ? 'a week ago' : weeks + ' weeks ago';
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
      'How you play',
      'A run climbs five tables with the blinds going up at every step and your stack carried the whole way. Bust and it is over. Free play is one endless table that tops you back up.',
      [{ label: 'Run', value: 'run' }, { label: 'Free play', value: 'free' }],
      state.settings.mode,
      (value) => {
        if (value === state.settings.mode) { openSettings(); return; }
        state.settings.mode = value;
        save();
        clearTimer();
        clearGame();
        if (value === 'run') {
          ui.closeScreen();
          startRun();
          return;
        }
        // Abandoning a run part way through still records it. Nothing you
        // played is thrown away.
        if (state.run && !state.run.over) {
          bustRun(state.run, 'left the run');
          finishRunRecord();
        }
        state.run = null;
        renderRunHud();
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
      'Their cards',
      'After you fold, show what the player who took the pot was holding. A real table never shows you this, and knowing is how you find out what you were folding to.',
      [{ label: 'Show', value: true }, { label: 'Hide', value: false }],
      state.settings.peek !== false,
      (value) => {
        state.settings.peek = value;
        save();
        render();
        openSettings();
      }
    ));

    if (tiltAvailable() && !ui.prefersReducedMotion()) {
      body.appendChild(choiceSetting(
        'Tilt',
        'The table and the cards catch the light as you move the phone. It changes' +
          ' nothing about the game. ' + tiltNote(),
        [{ label: 'On', value: true }, { label: 'Off', value: false }],
        state.settings.tilt !== false,
        (value) => {
          setTiltEnabled(value);
          openSettings();
        }
      ));
    }

    if (state.settings.mode === 'free') {
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
    } else {
      body.appendChild(ui.el('div', 'section-title', 'The climb'));
      body.appendChild(ui.el('p', 'empty-note',
        'The table and the blinds are set by the step you are on. You pick which table to take at the start of each one.'));
      const give = ui.el('button', 'danger-btn quiet', 'Abandon this run');
      give.type = 'button';
      give.addEventListener('click', () => {
        if (state.run && !state.run.over) {
          bustRun(state.run, 'left the run');
          finishRunRecord();
        }
        ui.closeScreen();
        startRun();
      });
      body.appendChild(give);
    }

    body.appendChild(ui.el('div', 'section-title', 'Start over'));
    const reset = ui.el('button', 'danger-btn', 'Reset stats and progress');
    reset.type = 'button';
    reset.addEventListener('click', () => {
      state.stats = JSON.parse(JSON.stringify(DEFAULT_STATS));
      state.stats.play = emptyPlay();
      state.stats.days = {};
      state.progress = JSON.parse(JSON.stringify(DEFAULT_PROGRESS));
      save();
      renderProgress();
      clearGame();
      if (state.settings.mode === 'run') {
        ui.closeScreen();
        startRun();
        return;
      }
      buildTable();
      dealNewHand();
      openSettings();
    });
    body.appendChild(reset);
    body.appendChild(ui.el('p', 'empty-note',
      'Your finished runs are kept separately and this does not touch them.'));
  });
}

/**
 * Say out loud what the tilt is actually doing. An effect that quietly does
 * nothing looks exactly like one that is broken, and this shipped that way
 * once: the sensor was never being asked for and there was no way to tell.
 */
function tiltNote() {
  if (state.settings.tilt === false) return 'Turned off.';
  switch (tiltStatus()) {
    case 'running': return 'Running now. Turn the phone and the light moves with it.';
    case 'refused': return 'Your phone said no to the motion sensor. To change that, ' +
      'turn on Motion and Orientation Access in Settings, under Safari.';
    case 'needs-tap': return 'Waiting to ask your phone for the motion sensor. Tap On again.';
    case 'unavailable': return 'This device does not report how it is being held.';
    default: return 'Tap On to let it use the motion sensor.';
  }
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

/**
 * The tilt has to be asked for on iOS, and only from a real tap, so it is
 * armed on the first one rather than at load. Anyone who has asked their
 * phone to stop moving things never gets asked at all.
 */
function armTilt() {
  if (!state.settings.tilt || ui.prefersReducedMotion() || !tiltAvailable()) return;
  // On a click, not a pointerdown. iOS only counts some events as the gesture
  // that is allowed to ask for the sensor, and pointerdown is not one of them:
  // asking from it throws, which the first version of this swallowed, so the
  // effect silently never started.
  const go = () => {
    startTilt((x, y) => ui.setTilt(x, y)).then((on) => {
      // Only stop asking once it has actually worked. Giving up after one
      // attempt is the other half of why this never ran: a single failure,
      // for any reason, used to end it for the rest of the session.
      if (on || tiltStatus() === 'refused') {
        document.removeEventListener('click', go, true);
        document.removeEventListener('touchend', go, true);
      }
    });
  };
  document.addEventListener('click', go, true);
  document.addEventListener('touchend', go, true);
  // Coming back to the app is usually coming back to it held differently, so
  // wherever it is being held now becomes the new middle. This is its own
  // listener rather than a line in the one the service worker sets up,
  // because that one only exists if the worker registered and this has
  // nothing to do with caching.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) recentreTilt();
  });
}

function setTiltEnabled(on) {
  state.settings.tilt = on;
  save();
  if (!on) {
    stopTilt();
    ui.setTilt(0, 0);
    return;
  }
  // Already inside a tap here, so this is the gesture iOS wants.
  if (!tiltIsRunning()) startTilt((x, y) => ui.setTilt(x, y));
}

function boot() {
  ui.cacheDom();
  load();
  ui.setLiveNoteProvider((slug) => liveNote(slug, state.table, HERO_SEAT));
  ui.setDiagramProvider((slug) => diagramData(slug, state.table, HERO_SEAT));
  wireEvents();
  armTilt();
  buildTable();
  renderProgress();
  registerServiceWorker();
  if (restoreGame()) {
    renderRunHud();
    render();
    step();
    return;
  }
  if (state.settings.mode === 'run') {
    startRun();
    return;
  }
  dealNewHand();
}

boot();
