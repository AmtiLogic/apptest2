// ui.js
// All DOM rendering. Nothing in here decides anything about poker, it just
// draws whatever the app hands it.

import { RANK_CHARS, SUIT_SYMBOLS, isRed } from './cards.js';
import { parseMarkup, getTerm } from './glossary.js';

export const dom = {};

export function cacheDom() {
  const ids = [
    'hand-number', 'opponents', 'board', 'pot-amount',
    'table-message', 'hand-result', 'coach-banner', 'action-area', 'hero-cards',
    'hero-stack', 'hero-readout', 'sheet', 'sheet-title', 'sheet-body',
    'screen', 'screen-title', 'screen-body',
    'level-label', 'streak-label', 'level-fill'
  ];
  for (const id of ids) {
    dom[camel(id)] = document.getElementById(id);
  }
}

function camel(id) {
  return id.replace(/-([a-z])/g, (m, c) => c.toUpperCase());
}

export function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = String(text);
  return node;
}

function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

/**
 * Turn copy written with [[slug|text]] markup into text nodes and tappable
 * term spans.
 */
export function renderMarkup(markup) {
  const frag = document.createDocumentFragment();
  for (const token of parseMarkup(String(markup || ''))) {
    if (token.type === 'term') {
      const span = el('span', 'term', token.text);
      span.dataset.term = token.slug;
      span.setAttribute('role', 'button');
      span.setAttribute('tabindex', '0');
      frag.appendChild(span);
    } else {
      frag.appendChild(document.createTextNode(token.text));
    }
  }
  return frag;
}

export function setMarkup(node, markup) {
  clear(node);
  node.appendChild(renderMarkup(markup));
}

// ------------------------------------------------------------------- cards

export function cardEl(card, options = {}) {
  const node = el('div', 'card');
  if (options.mini) node.className = 'mini-card face';
  if (options.faceDown) {
    node.className = options.mini ? 'mini-card' : 'card back';
    return node;
  }
  if (!card) {
    node.className = options.mini ? 'mini-card' : 'card empty';
    return node;
  }
  if (isRed(card)) node.classList.add('red');
  if (options.dealt) node.classList.add('dealt');
  if (options.mini) {
    node.textContent = RANK_CHARS[card.rank] + SUIT_SYMBOLS[card.suit];
    return node;
  }
  node.appendChild(el('span', 'rank', RANK_CHARS[card.rank]));
  node.appendChild(el('span', 'suit', SUIT_SYMBOLS[card.suit]));
  return node;
}

let lastBoardCount = 0;

export function renderBoard(board) {
  clear(dom.board);
  for (let i = 0; i < 5; i++) {
    const card = board[i];
    if (!card) {
      dom.board.appendChild(cardEl(null, { faceDown: true }));
      continue;
    }
    dom.board.appendChild(cardEl(card, { dealt: i >= lastBoardCount }));
  }
  lastBoardCount = board.length;
}

export function resetBoardAnimation() {
  lastBoardCount = 0;
}

// Treat this many board cards as already on the table, so a restored hand
// does not replay the deal.
export function primeBoard(count) {
  lastBoardCount = count;
}

// ------------------------------------------------------------------- seats

export function renderSeats(table, options = {}) {
  clear(dom.opponents);
  dom.opponents.classList.toggle('many', table.players.length > 6);
  for (const player of table.players) {
    if (player.isHuman) continue;
    dom.opponents.appendChild(seatEl(table, player, options));
  }
}

function seatEl(table, player, options) {
  const seat = el('div', 'seat');
  seat.dataset.seat = String(player.index);
  if (player.folded || !player.hasCards) seat.classList.add('folded');
  if (table.toAct === player.index && !table.handOver) seat.classList.add('acting');
  if (options.winners && options.winners.includes(player.index)) seat.classList.add('winner');

  seat.appendChild(el('div', 'seat-marker'));

  seat.appendChild(el('div', 'seat-avatar', player.avatar));
  seat.appendChild(el('div', 'seat-name', player.name));
  seat.appendChild(el('div', 'seat-stack', player.stack));

  // Dealer button, blind marker and the last action share one row, so
  // nothing sits on top of the avatar.
  const meta = el('div', 'seat-meta');
  if (table.streetFirstActor === player.index && !table.handOver) {
    const badge = el('span', 'seat-tag start', '1ST');
    badge.title = 'Acts first this round';
    meta.appendChild(badge);
  }
  if (table.buttonIndex === player.index) {
    const badge = el('span', 'seat-tag dealer', 'D');
    badge.title = 'Dealer button';
    meta.appendChild(badge);
  }
  const blind = blindLabel(table, player.index);
  if (blind) {
    const badge = el('span', 'seat-tag blind' + (blind === 'BB' ? ' big' : ''), blind);
    badge.title = blind === 'BB' ? 'Big blind' : 'Small blind';
    meta.appendChild(badge);
  }
  if (player.lastAction) {
    meta.appendChild(el('span', 'seat-action', player.lastAction.split(' ')[0]));
  }
  seat.appendChild(meta);

  const hole = el('div', 'seat-hole');
  if (player.hasCards && !player.folded) {
    const reveal = options.reveal && options.reveal.includes(player.index);
    for (const card of player.hole) {
      hole.appendChild(cardEl(card, { mini: true, faceDown: !reveal }));
    }
  }
  seat.appendChild(hole);

  // Always present so a bet appearing does not shift the row. Once the hand
  // is settled this slot shows what the player won or lost instead.
  const net = options.nets ? options.nets[player.index] : null;
  if (net !== null && net !== undefined && net !== 0) {
    seat.appendChild(el(
      'div', 'seat-bet ' + (net > 0 ? 'win' : 'lose'),
      (net > 0 ? '+' : '') + net
    ));
  } else {
    seat.appendChild(el('div', 'seat-bet' + (player.committed > 0 ? '' : ' empty'),
      player.committed > 0 ? player.committed : '0'));
  }
  return seat;
}

// "SB" or "BB" for the seat, when it posted one this hand.
export function blindLabel(table, seatIndex) {
  const blinds = table.blindSeats;
  if (!blinds) return null;
  if (blinds.bb === seatIndex) return 'BB';
  if (blinds.sb === seatIndex) return 'SB';
  return null;
}

// -------------------------------------------------------------------- hero

export function renderHero(table, hero, readout, heroNet) {
  clear(dom.heroCards);
  dom.heroCards.classList.toggle('folded', !!hero.folded);
  if (hero.hasCards && hero.hole.length) {
    for (const card of hero.hole) dom.heroCards.appendChild(cardEl(card));
  } else {
    dom.heroCards.appendChild(cardEl(null));
    dom.heroCards.appendChild(cardEl(null));
  }

  clear(dom.heroStack);
  const marks = el('div', 'hero-marks');
  if (table.buttonIndex === hero.index) {
    const badge = el('span', 'hero-mark dealer', 'D');
    badge.title = 'You are the dealer this hand';
    marks.appendChild(badge);
  }
  const blind = blindLabel(table, hero.index);
  if (blind) {
    const badge = el('span', 'hero-mark' + (blind === 'BB' ? ' big' : ''), blind);
    badge.title = blind === 'BB' ? 'You posted the big blind' : 'You posted the small blind';
    marks.appendChild(badge);
  }
  if (marks.childNodes.length) dom.heroStack.appendChild(marks);

  const stack = el('span', null, '');
  stack.appendChild(el('strong', null, hero.stack));
  stack.appendChild(document.createTextNode(' chips'));
  if (hero.committed > 0) {
    stack.appendChild(document.createTextNode(', ' + hero.committed + ' in'));
  }
  dom.heroStack.appendChild(stack);
  if (heroNet !== null && heroNet !== undefined && heroNet !== 0) {
    dom.heroStack.appendChild(el(
      'span', 'hero-net ' + (heroNet > 0 ? 'win' : 'lose'),
      (heroNet > 0 ? '+' : '') + heroNet
    ));
  }

  clear(dom.heroReadout);
  if (readout && readout.markup) {
    dom.heroReadout.appendChild(el('span', 'readout-label', 'You have'));
    dom.heroReadout.appendChild(renderMarkup(readout.markup));
  }
}

/**
 * The scoreboard at the end of a hand: who won, how much, and what it cost
 * or made you. Shown instead of the running commentary.
 */
export function showResult(result) {
  const node = dom.handResult;
  clear(node);
  node.hidden = false;
  // Lets the stylesheet claw back room from the board while the scoreboard
  // and the last grade are both on screen.
  document.body.classList.add('showing-result');
  node.className = 'hand-result ' +
    (result.net > 0 ? 'won' : (result.net < 0 ? 'lost' : 'even'));

  const top = el('div', 'result-top');
  top.appendChild(el('div', 'result-who', result.headline));
  const delta = el('div', 'result-delta');
  delta.textContent = result.net > 0
    ? '+' + result.net
    : (result.net < 0 ? String(result.net) : 'even');
  top.appendChild(delta);
  node.appendChild(top);

  if (result.detail) {
    const detail = el('div', 'result-detail');
    detail.appendChild(renderMarkup(result.detail));
    node.appendChild(detail);
  }
}

export function hideResult() {
  dom.handResult.hidden = true;
  clear(dom.handResult);
  document.body.classList.remove('showing-result');
}

export function setPot(amount) {
  dom.potAmount.textContent = amount;
}

export function setHandNumber(n) {
  dom.handNumber.textContent = n;
}

export function setCoachState(on) {
  // The coach toggle now shares its line with the level, so it only speaks up
  // when it is off and the player might be wondering where the grades went.
  dom.streakLabel.dataset.coachOff = on ? '' : 'yes';
  refreshStreakLabel();
}

let streakValue = 0;

function refreshStreakLabel() {
  const node = dom.streakLabel;
  if (node.dataset.coachOff === 'yes') {
    node.textContent = 'coach off';
    node.className = 'streak-label muted';
    node.hidden = false;
    return;
  }
  if (streakValue >= 3) {
    node.textContent = streakValue + ' clean in a row';
    node.className = 'streak-label';
    node.hidden = false;
    return;
  }
  node.hidden = true;
}

export function setProgress(progress) {
  dom.levelLabel.textContent = 'Level ' + progress.level;
  dom.levelFill.style.width =
    Math.round((progress.intoLevel / progress.perLevel) * 100) + '%';
  streakValue = progress.streak;
  refreshStreakLabel();
}

/**
 * A small reward floating up from the banner. Points are for playing well,
 * so this fires on the decision, not on winning the pot.
 */
export function flashReward(reward) {
  if (!reward || (!reward.xp && !reward.levelUp)) return;
  const node = el('div', 'reward');
  if (reward.levelUp) {
    node.classList.add('level-up');
    node.textContent = 'Level ' + reward.levelUp;
  } else {
    node.textContent = '+' + reward.xp;
  }
  dom.coachBanner.appendChild(node);
  setTimeout(() => { if (node.parentNode) node.parentNode.removeChild(node); }, 1400);
}

export function setMessage(markup) {
  if (!markup) {
    clear(dom.tableMessage);
    return;
  }
  setMarkup(dom.tableMessage, markup);
}

// ------------------------------------------------------------------ banner

export function showBanner(result) {
  const node = dom.coachBanner;
  clear(node);
  node.className = 'coach-banner ' + result.verdict;
  node.hidden = false;
  const label = result.verdict === 'good' ? 'Good' : result.verdict === 'fine' ? 'Fine' : 'Mistake';
  node.appendChild(el('div', 'coach-verdict', label));
  const text = el('div', 'coach-text');
  text.appendChild(renderMarkup(result.text));
  node.appendChild(text);
  if (result.diagram) {
    const picture = renderDiagram(result.diagram);
    if (picture) node.appendChild(picture);
  }
  if (result.better) {
    const better = el('div', 'coach-better');
    better.appendChild(document.createTextNode('Better: '));
    better.appendChild(el('strong', null, result.better));
    node.appendChild(better);
  }
  node.scrollTop = 0;
  updateBannerFade(node);
  node.onscroll = () => updateBannerFade(node);
}

// Fade the bottom edge while there is more to scroll to, so a long banner on
// a short screen reads as scrollable rather than cut off.
function updateBannerFade(node) {
  const more = node.scrollHeight - node.scrollTop - node.clientHeight > 4;
  node.classList.toggle('scrolls', more);
}

export function hideBanner() {
  dom.coachBanner.hidden = true;
  clear(dom.coachBanner);
}

// ------------------------------------------------------------ action area

/**
 * options: { legal, bigBlind, onFold, onCheckCall, onRaise, onOpenSizer }
 */
export function renderActionRow(options) {
  const area = dom.actionArea;
  clear(area);
  const row = el('div', 'action-row');
  const legal = options.legal;

  const fold = el('button', 'act-btn fold', 'Fold');
  fold.type = 'button';
  fold.addEventListener('click', options.onFold);
  row.appendChild(fold);

  const callBtn = el('button', 'act-btn');
  callBtn.type = 'button';
  if (legal.canCheck) {
    callBtn.appendChild(el('span', null, 'Check'));
  } else {
    callBtn.appendChild(el('span', null, 'Call'));
    callBtn.appendChild(el('small', null, legal.toCall + (legal.toCall >= legal.maxRaiseTo ? ' all in' : '')));
  }
  callBtn.addEventListener('click', options.onCheckCall);
  row.appendChild(callBtn);

  if (legal.canRaise) {
    const raise = el('button', 'act-btn primary');
    raise.type = 'button';
    const quick = options.quickRaiseTo;
    raise.appendChild(el('span', null, legal.isBet ? 'Bet' : 'Raise'));
    raise.appendChild(el('small', null, quick >= legal.maxRaiseTo ? 'all in ' + quick : String(quick)));
    raise.addEventListener('click', () => options.onRaise(quick));
    row.appendChild(raise);

    const sizer = el('button', 'sizer-btn', '↑');
    sizer.type = 'button';
    sizer.setAttribute('aria-label', 'Choose a bet size');
    sizer.addEventListener('click', options.onOpenSizer);
    row.appendChild(sizer);
  }

  area.appendChild(row);
}

/**
 * options: { legal, pot, bigBlind, start, onConfirm, onCancel }
 */
export function renderBetSizer(options) {
  const area = dom.actionArea;
  clear(area);
  const legal = options.legal;
  const box = el('div', 'bet-sizer');

  const top = el('div', 'sizer-top');
  const amount = el('div', 'sizer-amount');
  const value = el('span', null, String(options.start));
  const unit = el('small', null, '');
  amount.appendChild(value);
  amount.appendChild(unit);
  top.appendChild(amount);
  const cancel = el('button', 'sizer-cancel', '✕');
  cancel.type = 'button';
  cancel.setAttribute('aria-label', 'Cancel');
  cancel.addEventListener('click', options.onCancel);
  top.appendChild(cancel);
  box.appendChild(top);

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = String(legal.minRaiseTo);
  slider.max = String(legal.maxRaiseTo);
  slider.step = '1';
  slider.value = String(options.start);
  slider.setAttribute('aria-label', 'Bet size');
  box.appendChild(slider);

  const presets = el('div', 'sizer-presets');
  // A raise "to" number counts what is already in front of you, so each preset
  // is: what you have in, plus the call, plus a share of the pot as it would
  // stand after that call.
  const committed = options.committed || 0;
  const afterCall = options.pot + legal.toCall;
  const base = committed + legal.toCall;
  const presetDefs = [
    { label: '1 BB', value: committed + Math.round(options.bigBlind) },
    { label: '1/2 Pot', value: base + Math.round(afterCall / 2) },
    { label: 'Pot', value: base + afterCall },
    { label: 'All in', value: legal.maxRaiseTo }
  ];
  const presetButtons = [];
  for (const def of presetDefs) {
    const btn = el('button', 'preset-btn', def.label);
    btn.type = 'button';
    btn.addEventListener('click', () => {
      setValue(def.value);
    });
    presets.appendChild(btn);
    presetButtons.push(btn);
  }
  box.appendChild(presets);

  const confirm = el('button', 'sizer-confirm', '');
  confirm.type = 'button';
  box.appendChild(confirm);

  function clampValue(v) {
    return Math.max(legal.minRaiseTo, Math.min(legal.maxRaiseTo, Math.round(v)));
  }

  function setValue(v) {
    const clamped = clampValue(v);
    slider.value = String(clamped);
    value.textContent = String(clamped);
    const inBB = Math.round((clamped / options.bigBlind) * 10) / 10;
    unit.textContent = inBB + 'BB';
    confirm.textContent = (legal.isBet ? 'Bet ' : 'Raise to ') + clamped +
      (clamped >= legal.maxRaiseTo ? ' (all in)' : '');
    for (let i = 0; i < presetButtons.length; i++) {
      presetButtons[i].classList.toggle('on', clampValue(presetDefs[i].value) === clamped);
    }
  }

  slider.addEventListener('input', () => setValue(Number(slider.value)));
  confirm.addEventListener('click', () => options.onConfirm(clampValue(Number(slider.value))));
  setValue(options.start);

  area.appendChild(box);
}

export function renderWaiting(text) {
  clear(dom.actionArea);
  dom.actionArea.appendChild(el('div', 'waiting', text || ''));
}

export function renderNextHand(onNext, onReplay) {
  clear(dom.actionArea);
  const row = el('div', 'action-row');
  if (onReplay) {
    const replay = el('button', 'act-btn', 'Watch it back');
    replay.type = 'button';
    replay.addEventListener('click', onReplay);
    row.appendChild(replay);
  }
  const btn = el('button', 'next-btn wide', 'Next hand');
  btn.type = 'button';
  btn.addEventListener('click', onNext);
  row.appendChild(btn);
  dom.actionArea.appendChild(row);
}

/**
 * The controls for stepping through a finished hand. The table itself is the
 * canvas, so this is only the transport.
 */
export function renderReplayBar(options) {
  clear(dom.actionArea);
  const bar = el('div', 'replay-bar');

  const back = el('button', 'replay-btn', '\u2039');
  back.type = 'button';
  back.setAttribute('aria-label', 'Previous step');
  back.disabled = options.index === 0;
  back.addEventListener('click', options.onBack);
  bar.appendChild(back);

  const playPause = el('button', 'replay-btn play', options.playing ? '\u2016' : '\u25b6');
  playPause.type = 'button';
  playPause.setAttribute('aria-label', options.playing ? 'Pause' : 'Play');
  playPause.addEventListener('click', options.onToggle);
  bar.appendChild(playPause);

  const forward = el('button', 'replay-btn', '\u203a');
  forward.type = 'button';
  forward.setAttribute('aria-label', 'Next step');
  forward.disabled = options.index >= options.total - 1;
  forward.addEventListener('click', options.onForward);
  bar.appendChild(forward);

  const dots = el('div', 'replay-steps');
  for (let i = 0; i < options.total; i++) {
    const dot = el('span', 'replay-dot' + (i <= options.index ? ' done' : '') +
      (i === options.index ? ' now' : ''));
    dots.appendChild(dot);
  }
  bar.appendChild(dots);

  const done = el('button', 'replay-btn wide', 'Done');
  done.type = 'button';
  done.addEventListener('click', options.onExit);
  bar.appendChild(done);

  dom.actionArea.appendChild(bar);
}

// --------------------------------------------------------------- diagrams

/**
 * Turn the data from diagrams.js into a small picture. Every one of these is
 * built from the hand actually being played.
 */
export function renderDiagram(data) {
  if (!data) return null;
  if (data.kind === 'order') return orderDiagram(data);
  if (data.kind === 'odds') return oddsDiagram(data);
  if (data.kind === 'outs') return outsDiagram(data);
  if (data.kind === 'ladder') return ladderDiagram(data);
  return null;
}

function orderDiagram(data) {
  const box = el('div', 'dg dg-order');
  const strip = el('div', 'dg-strip');
  data.seats.forEach((seatData, i) => {
    if (i > 0) strip.appendChild(el('span', 'dg-arrow', '\u203a'));
    const chip = el('div', 'dg-seat' +
      (seatData.isMe ? ' me' : '') +
      (seatData.folded ? ' folded' : '') +
      (seatData.acting ? ' acting' : ''));
    chip.appendChild(el('span', 'dg-num', String(i + 1)));
    chip.appendChild(el('span', 'dg-name', seatData.name));
    // The same D badge the table uses, so it needs no explaining.
    if (seatData.isButton) chip.appendChild(el('span', 'dg-d', 'D'));
    strip.appendChild(chip);
  });
  box.appendChild(strip);
  box.appendChild(el('div', 'dg-caption', data.caption));
  return box;
}

function oddsDiagram(data) {
  const box = el('div', 'dg dg-odds' + (data.good ? ' good' : ' bad'));
  const track = el('div', 'dg-track');
  if (data.equity !== null) {
    const fill = el('div', 'dg-fill');
    const target = Math.min(100, data.equity) + '%';
    fill.style.width = '0%';
    track.appendChild(fill);
    // Grown on the next frame so the bar visibly reaches for the price.
    requestAnimationFrame(() => { fill.style.width = target; });
  }
  const tick = el('div', 'dg-tick');
  tick.style.left = Math.min(100, data.need) + '%';
  track.appendChild(tick);
  box.appendChild(track);

  const legend = el('div', 'dg-legend');
  legend.appendChild(el('span', 'dg-have',
    data.equity === null ? 'no draw' : 'you get there ' + data.equity + '%'));
  legend.appendChild(el('span', 'dg-need', 'need ' + data.need + '%'));
  box.appendChild(legend);
  box.appendChild(el('div', 'dg-caption',
    'Pay ' + data.toCall + ' to win ' + data.pot + '.' +
    (data.equity === null ? '' : (data.good ? ' Worth it.' : ' Not worth it.'))));
  return box;
}

function outsDiagram(data) {
  const box = el('div', 'dg dg-outs');
  const grid = el('div', 'dg-grid');
  for (let i = 0; i < data.unseen; i++) {
    const card = el('span', 'dg-card' + (i < data.outs ? ' out' : ''));
    // The winning cards fill in one after another, so the count is felt
    // rather than read.
    if (i < data.outs) card.style.animationDelay = (i * 45) + 'ms';
    grid.appendChild(card);
  }
  box.appendChild(grid);
  box.appendChild(el('div', 'dg-caption',
    data.outs === 0
      ? 'None of the ' + data.unseen + ' cards left saves this hand.'
      : data.outs + ' of the ' + data.unseen + ' cards left win it, about ' +
        data.percent + ' percent per card.'));
  return box;
}

function ladderDiagram(data) {
  const box = el('div', 'dg dg-ladder');
  // Strongest at the top, the way hand rankings are always drawn.
  for (let i = data.rows.length - 1; i >= 0; i--) {
    const row = data.rows[i];
    const line = el('div', 'dg-rung' +
      (row.current ? ' current' : '') + (row.beaten ? ' beaten' : ''));
    line.appendChild(el('span', 'dg-rung-name', row.name));
    if (row.current) line.appendChild(el('span', 'dg-rung-you', 'you'));
    box.appendChild(line);
  }
  return box;
}

// ------------------------------------------------------------------- sheet

// Set by the app. Given a term, it returns a sentence about the hand being
// played right now, or null when the term has nothing to say about it.
let liveNoteFor = null;
let diagramFor = null;

export function setLiveNoteProvider(provider) {
  liveNoteFor = provider;
}

export function setDiagramProvider(provider) {
  diagramFor = provider;
}

// Tapping a term inside a definition replaces the sheet with that term, so
// one panel can walk through as many words as it takes.
export function openTermSheet(slug) {
  const term = getTerm(slug);
  if (!term) return;
  dom.sheetTitle.textContent = term.title;
  clear(dom.sheetBody);

  // What the word means for the hand in front of you comes first and gets the
  // most weight. The general definition is the small print under it.
  const picture = diagramFor ? renderDiagram(diagramFor(term.slug)) : null;
  if (picture) dom.sheetBody.appendChild(picture);

  const live = liveNoteFor ? liveNoteFor(term.slug) : null;
  if (live) {
    const box = el('div', 'live-note');
    box.appendChild(renderMarkup(live));
    dom.sheetBody.appendChild(box);
  }

  for (const sense of term.senses) {
    const wrap = el('div', 'sense');
    if (sense.label) wrap.appendChild(el('div', 'sense-label', sense.label));
    const text = el('div', 'sense-text' + (live ? ' secondary' : ''));
    text.appendChild(renderMarkup(sense.text));
    wrap.appendChild(text);
    // The live line already is an example, so only fall back to the written
    // one when there is nothing to say about this hand.
    if (sense.example && !live) {
      const example = el('div', 'sense-example');
      example.appendChild(renderMarkup(sense.example));
      wrap.appendChild(example);
    }
    dom.sheetBody.appendChild(wrap);
  }
  dom.sheet.hidden = false;
  dom.sheet.querySelector('.sheet-panel').scrollTop = 0;
}

export function closeSheet() {
  dom.sheet.hidden = true;
}

export function sheetIsOpen() {
  return !dom.sheet.hidden;
}

// ------------------------------------------------------------------ screen

export function openScreen(title, build) {
  dom.screenTitle.textContent = title;
  clear(dom.screenBody);
  build(dom.screenBody);
  dom.screen.hidden = false;
  dom.screenBody.scrollTop = 0;
}

export function closeScreen() {
  dom.screen.hidden = true;
  clear(dom.screenBody);
}

export function screenIsOpen() {
  return !dom.screen.hidden;
}

export { clear };
