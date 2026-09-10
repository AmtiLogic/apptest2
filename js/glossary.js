// glossary.js
// Every poker word the interface uses, written for somebody who has never
// heard any of them before.
//
// Rules for the copy in here:
//   1. Say what the thing literally is before saying why it matters.
//   2. Short sentences. Everyday words.
//   3. Any poker word inside a definition is written as [[slug|text]] so the
//      interface turns it into a tappable span. A definition never leans on
//      a word that is not itself defined here.
//   4. Every entry ends with one concrete example, with real cards or real
//      numbers rather than a restatement of the rule.

export const TERMS = {
  hand: {
    title: 'Hand',
    senses: [
      {
        label: 'Your two cards',
        text: 'The two cards only you can see.',
        example: 'Ace and king of spades is "ace king suited".'
      },
      {
        label: 'One round of play',
        text: 'One full round, from the deal to somebody winning the [[pot]].',
        example: 'The counter at the top left says which one you are on.'
      },
      {
        label: 'Your best five cards',
        text: 'The best five you can make from your two plus the five in the middle.',
        example: 'Two kings in your hand plus a king in the middle is three of a kind.'
      }
    ]
  },

  position: {
    title: 'Position',
    senses: [
      {
        text: 'How far you sit from the [[button]], which sets when you act. Acting later is better.',
        example: 'On the button you act last every round after the first.'
      }
    ]
  },

  'in-position': {
    title: 'In position',
    senses: [
      {
        text: 'You act after them on every round left. The good side to be on.',
        example: 'You are on the [[button]], they are in the [[big-blind|big blind]].'
      }
    ]
  },

  'out-of-position': {
    title: 'Out of position',
    senses: [
      {
        text: 'You act before them on every round left, so they get to react to you.',
        example: 'You are in the [[small-blind|small blind]] against the [[button]].'
      }
    ]
  },

  blinds: {
    title: 'Blinds',
    senses: [
      {
        text: 'Two forced bets put in before the deal, so there is always something to play for.',
        example: 'At 1 and 2, two players pay before anyone sees a card.'
      }
    ]
  },

  'small-blind': {
    title: 'Small blind',
    senses: [
      {
        text: 'The smaller forced bet, and the seat that pays it, one to the left of the [[button]].',
        example: 'Marked SB under a player.'
      }
    ]
  },

  'big-blind': {
    title: 'Big blind',
    senses: [
      {
        label: 'The seat',
        text: 'Two seats left of the [[button]]. Pays the bigger forced bet, acts last before the [[flop]].',
        example: 'Marked BB under a player.'
      },
      {
        label: 'A way of counting',
        text: 'The unit everyone measures money in, written BB. A 3BB raise means the same in any game.',
        example: 'At 1 and 2, a 200 chip [[stack]] is 100 big blinds.'
      }
    ]
  },

  stakes: {
    title: 'Stakes',
    senses: [
      {
        text: 'How big the [[blinds]] are. Everything else scales off them.',
        example: 'Change them under Setup.'
      }
    ]
  },

  button: {
    title: 'Button',
    senses: [
      {
        text: 'The marker for who acts last after the [[flop]]. It moves one seat left every [[hand]].',
        example: 'The white D badge.'
      }
    ]
  },

  dealer: {
    title: 'Dealer',
    senses: [
      {
        text: 'Whoever has the [[button]] this [[hand]]. The app deals, so the badge only marks the best seat.',
        example: 'It moves every hand, so everyone gets it.'
      }
    ]
  },

  pot: {
    title: 'Pot',
    senses: [
      {
        text: 'Every chip bet so far. The winner takes all of it.',
        example: 'Three players put in 10 each, so the pot is 30.'
      }
    ]
  },

  'side-pot': {
    title: 'Side pot',
    senses: [
      {
        text: 'A second pile made when somebody is [[all-in|all in]] for less. They can only win what they matched.',
        example: 'All in for 20 against two others, you can win 60.'
      }
    ]
  },

  stack: {
    title: 'Stack',
    senses: [
      {
        text: 'The chips in front of you. The most you can win or lose this [[hand]].',
        example: 'Shown under your cards.'
      }
    ]
  },

  'community-cards': {
    title: 'Community cards',
    senses: [
      {
        text: 'The five face up cards in the middle. Everybody uses them.',
        example: 'Your two hearts plus three in the middle is a [[flush]].'
      }
    ]
  },

  board: {
    title: 'Board',
    senses: [
      {
        text: 'The [[community-cards|community cards]] showing right now.',
        example: 'King, seven, two with two spades.'
      }
    ]
  },

  'board-texture': {
    title: 'Board texture',
    senses: [
      {
        text: 'How dangerous the [[board]] is. Cards close in rank or matching suits mean more big hands are out there.',
        example: 'King seven two is dry. Nine eight seven with two hearts is wet.'
      }
    ]
  },

  street: {
    title: 'Street',
    senses: [
      {
        text: 'One round of betting. There are four: [[preflop]], [[flop]], [[turn]], [[river]].',
        example: 'Betting the flop and turn is betting two streets.'
      }
    ]
  },

  preflop: {
    title: 'Preflop',
    senses: [
      {
        text: 'The first betting round, before anything hits the middle. Your cards and your [[position]] are all you have.',
        example: 'Most of your decisions happen here, and most are folds.'
      }
    ]
  },

  flop: {
    title: 'Flop',
    senses: [
      {
        text: 'The first three [[community-cards|community cards]], turned over together.',
        example: 'Most hands become something or nothing right here.'
      }
    ]
  },

  turn: {
    title: 'Turn',
    senses: [
      {
        text: 'The fourth [[community-cards|community card]].',
        example: 'Bets get bigger here because the [[pot]] is bigger.'
      }
    ]
  },

  river: {
    title: 'River',
    senses: [
      {
        text: 'The fifth and last card. Nothing improves after it.',
        example: 'A missed [[draw]] on the river is simply worthless.'
      }
    ]
  },

  check: {
    title: 'Check',
    senses: [
      {
        text: 'Pass without betting. Only allowed if nobody has bet this round. It is free.',
        example: 'Everyone checks and the next card comes for nothing.'
      }
    ]
  },

  call: {
    title: 'Call',
    senses: [
      {
        text: 'Match the current bet and stay in.',
        example: 'They bet 10, you call 10.'
      }
    ]
  },

  bet: {
    title: 'Bet',
    senses: [
      {
        text: 'Be the first to put chips in this round.',
        example: 'Everyone checked, so on the [[turn]] you bet 12.'
      }
    ]
  },

  raise: {
    title: 'Raise',
    senses: [
      {
        text: 'Put in more than the current bet, so everyone else must match your number or [[fold]].',
        example: 'They bet 10, you make it 30.'
      }
    ]
  },

  'three-bet': {
    title: 'Three-bet',
    senses: [
      {
        text: 'The second [[raise]] in a round. It usually means a very strong [[hand]].',
        example: 'They open to 6, you make it 20 with two queens.'
      }
    ]
  },

  fold: {
    title: 'Fold',
    senses: [
      {
        text: 'Give up. Anything you already put in stays in the [[pot]], and you cannot lose more.',
        example: 'The right answer far more often than beginners expect.'
      }
    ]
  },

  limp: {
    title: 'Limp',
    senses: [
      {
        text: 'Just [[call|calling]] the [[big-blind|big blind]] instead of raising. Usually weak.',
        example: 'Two players limp for 2, then the [[button]] raises to 12.'
      }
    ]
  },

  open: {
    title: 'Open',
    senses: [
      {
        text: 'Being the first to [[raise]] before the [[flop]].',
        example: 'It folds to you in the [[cutoff]] and you raise to 5.'
      }
    ]
  },

  'all-in': {
    title: 'All in',
    senses: [
      {
        text: 'Every chip you have. You cannot be bet off the [[hand]] after that.',
        example: 'You call all in for your last 40 against their 60.'
      }
    ]
  },

  showdown: {
    title: 'Showdown',
    senses: [
      {
        text: 'Cards face up at the end. Best five wins the [[pot]].',
        example: 'A [[flush]] beats their pair of kings.'
      }
    ]
  },

  'showdown-value': {
    title: 'Showdown value',
    senses: [
      {
        text: 'Not strong enough to [[bet]], but good enough to win if you get to the end cheaply.',
        example: 'A small pair on the [[river]]. [[check|Check]] it.'
      }
    ]
  },

  kicker: {
    title: 'Kicker',
    senses: [
      {
        text: 'The spare card that breaks a tie when two players have the same [[pair]].',
        example: 'Both have aces. Your king beats their nine.'
      }
    ]
  },

  'pot-odds': {
    title: 'Pot odds',
    senses: [
      {
        text: 'The price of a [[call]]: what it costs, divided by the [[pot]] after you call. That is how often you need to win.',
        example: 'Pay 10 to win 40 is 25 percent, so one time in four.'
      }
    ]
  },

  outs: {
    title: 'Outs',
    senses: [
      {
        text: 'Cards left in the deck that would make your [[hand]] a winner. Count them.',
        example: 'Four hearts means nine hearts left, so nine outs.'
      }
    ]
  },

  'rule-of-two-and-four': {
    title: 'Rule of two and four',
    senses: [
      {
        text: '[[outs|Outs]] times two for one card to come, times four for two. A rough percentage in your head.',
        example: 'Nine outs, one card to come, about eighteen percent.'
      }
    ]
  },

  equity: {
    title: 'Equity',
    senses: [
      {
        text: 'Your share of the [[pot]] on average, as a percentage.',
        example: 'A [[flush-draw|flush draw]] against one pair is about 35 percent.'
      }
    ]
  },

  range: {
    title: 'Range',
    senses: [
      {
        text: 'All the [[hand|hands]] somebody could be holding, counted as one group instead of guessed at one at a time.',
        example: 'You cannot know they have ace king. You can know they raise with about forty hands, and ace king is one of them.'
      },
      {
        label: 'Why it is a group',
        text: 'Unless there is a [[showdown]] you never find out what they had, so one guess is wrong nearly every time. A group can be right.'
      },
      {
        label: 'Your own range',
        text: 'You have one too: the hands you would play this way from this seat. Playing everything the same from every seat is what makes you readable.'
      }
    ]
  },

  draw: {
    title: 'Draw',
    senses: [
      {
        text: 'Worth nothing yet, but the right card makes it strong. The only question is the price.',
        example: 'Four cards toward a [[flush]] with two cards to come.'
      }
    ]
  },

  'flush-draw': {
    title: 'Flush draw',
    senses: [
      {
        text: 'Four cards of one suit. Nine cards left finish it, so nine [[outs]].',
        example: 'Any spade gives you the [[flush]].'
      }
    ]
  },

  flush: {
    title: 'Flush',
    senses: [
      {
        text: 'Five cards of the same suit. Beats a [[straight]].',
        example: 'Two diamonds in hand, three more in the middle.'
      }
    ]
  },

  straight: {
    title: 'Straight',
    senses: [
      {
        text: 'Five cards in a row, any suits. An ace goes at either end but does not wrap around.',
        example: 'Five six seven eight nine.'
      }
    ]
  },

  'open-ended-straight-draw': {
    title: 'Open ended straight draw',
    senses: [
      {
        text: 'Four in a row. Either end finishes it, so eight [[outs]].',
        example: 'Six seven eight nine. A five or a ten does it.'
      }
    ]
  },

  gutshot: {
    title: 'Gutshot',
    senses: [
      {
        text: 'A [[straight]] [[draw]] with a hole in the middle. Only four [[outs]], so usually not worth much.',
        example: 'Six seven against nine ten. Only an eight.'
      }
    ]
  },

  'backdoor-draw': {
    title: 'Backdoor draw',
    senses: [
      {
        text: 'Needs both remaining cards to go your way. Nearly worthless on its own.',
        example: 'Three hearts on the [[flop]].'
      }
    ]
  },

  'top-pair': {
    title: 'Top pair',
    senses: [
      {
        text: 'You paired the highest card on the [[board]]. A genuinely good ordinary [[hand]].',
        example: 'Ace nine on a nine six two [[board]].'
      }
    ]
  },

  'middle-pair': {
    title: 'Middle pair',
    senses: [
      {
        text: 'You paired a middle card on the [[board]]. Worth a [[call]], not a big bet.',
        example: 'Seven six on king seven three.'
      }
    ]
  },

  overpair: {
    title: 'Overpair',
    senses: [
      {
        text: 'Your [[pocket-pair|pocket pair]] is higher than every card on the [[board]]. Usually strong.',
        example: 'Two queens on nine six two.'
      }
    ]
  },

  'bottom-pair': {
    title: 'Bottom pair',
    senses: [
      {
        text: 'You paired the lowest card on the [[board]]. Very weak.',
        example: 'Nine three on king eight three.'
      }
    ]
  },

  pair: {
    title: 'Pair',
    senses: [
      {
        text: 'Two cards of the same rank. Most pots are won with one.',
        example: 'A king in your hand, a king in the middle.'
      }
    ]
  },

  'pocket-pair': {
    title: 'Pocket pair',
    senses: [
      {
        text: 'Two cards of the same rank dealt to you, so you start with a [[pair]] already.',
        example: 'Two nines.'
      }
    ]
  },

  'two-pair': {
    title: 'Two pair',
    senses: [
      {
        text: 'Two separate [[pair|pairs]]. Watch out when both are on the [[board]], because then everyone has them.',
        example: 'Ace nine on an ace nine four [[board]].'
      }
    ]
  },

  'three-of-a-kind': {
    title: 'Three of a kind',
    senses: [
      {
        text: 'Three of the same rank. Called a set when it comes from your [[pocket-pair|pocket pair]], and it is well hidden.',
        example: 'Two sevens and a seven on the [[flop]].'
      }
    ]
  },

  'full-house': {
    title: 'Full house',
    senses: [
      {
        text: '[[three-of-a-kind|Three of a kind]] plus a [[pair]]. Beats a [[flush]].',
        example: 'Two nines on a nine four four [[board]].'
      }
    ]
  },

  'four-of-a-kind': {
    title: 'Four of a kind',
    senses: [
      {
        text: 'All four of one rank. Only a [[straight-flush|straight flush]] beats it.',
        example: 'Two jacks and two more in the middle.'
      }
    ]
  },

  'straight-flush': {
    title: 'Straight flush',
    senses: [
      {
        text: 'Five in a row, all one suit. The best [[hand]] there is. Ten to ace is a royal flush.',
        example: 'Five six seven eight nine of hearts.'
      }
    ]
  },

  'made-hand': {
    title: 'Made hand',
    senses: [
      {
        text: 'Already worth something without another card. The opposite of a [[draw]].',
        example: 'A [[pair]] of kings is made. Four to a [[flush]] is not.'
      }
    ]
  },

  'high-card': {
    title: 'High card',
    senses: [
      {
        text: 'No [[pair]], no [[draw]], nothing. Almost always a [[fold]] when somebody bets.',
        example: 'King four on a nine seven two [[board]].'
      }
    ]
  },

  'continuation-bet': {
    title: 'Continuation bet',
    senses: [
      {
        text: 'Betting the [[flop]] after you raised before it. It works because most flops miss most hands.',
        example: 'You raised with ace queen, the flop is king seven two, you bet anyway.'
      }
    ]
  },

  'value-bet': {
    title: 'Value bet',
    senses: [
      {
        text: 'Betting a strong [[hand]] because you want to be [[call|called]]. Not folding them out, getting paid.',
        example: 'You bet [[two-pair|two pair]] and their one pair pays you.'
      }
    ]
  },

  bluff: {
    title: 'Bluff',
    senses: [
      {
        text: 'Betting a weak [[hand]] to make a better one [[fold]]. The story has to add up.',
        example: 'You have nothing on an ace high [[board]] and bet like you have the ace.'
      }
    ]
  },

  'semi-bluff': {
    title: 'Semi-bluff',
    senses: [
      {
        text: 'Betting a [[draw]]. You win now if they fold, and you still have [[outs]] if they call.',
        example: 'Betting your [[flush-draw|flush draw]] on the [[turn]].'
      }
    ]
  },

  dominated: {
    title: 'Dominated',
    senses: [
      {
        text: 'Sharing a card with a better [[hand]], so pairing up still leaves you losing. It costs beginners big pots.',
        example: 'Ace five against ace king. An ace comes and you still lose.'
      }
    ]
  },

  suited: {
    title: 'Suited',
    senses: [
      {
        text: 'Both your cards are the same suit, so a [[flush]] is possible. Written with an s, as AKs.',
        example: 'King and nine of hearts.'
      },
      {
        label: 'Why it matters',
        text: 'It is the same two ranks either way, so the [[flush]] is free extra value. Queen jack suited is worth opening from seats queen jack [[offsuit]] is not.'
      }
    ]
  },

  offsuit: {
    title: 'Offsuit',
    senses: [
      {
        text: 'Your cards are different suits, so no [[flush]] using both. Written with an o, as AKo.',
        example: 'Ace of clubs, queen of hearts.'
      },
      {
        label: 'Worth less than suited',
        text: 'The same ranks [[suited]] make flushes and these do not, so the offsuit version drops out of a [[range]] first. It is the weaker of the two.'
      }
    ]
  },

  connectors: {
    title: 'Connectors',
    senses: [
      {
        text: 'Two cards next to each other in rank, so they can make a [[straight]]. Much better when also [[suited]].',
        example: 'Eight seven of hearts.'
      }
    ]
  },

  broadway: {
    title: 'Broadway cards',
    senses: [
      {
        text: 'Ten, jack, queen, king, ace. Two of them together is a strong start.',
        example: 'King queen makes [[top-pair|top pair]] with a good [[kicker]] often.'
      }
    ]
  },

  cutoff: {
    title: 'Cutoff',
    senses: [
      {
        text: 'One seat to the right of the [[button]], so it acts second to last. The second best seat.',
        example: 'Only the button acts after you.'
      }
    ]
  },

  hijack: {
    title: 'Hijack',
    senses: [
      {
        text: 'Two seats to the right of the [[button]]. A middle seat.',
        example: 'Three players still act after you.'
      }
    ]
  },

  'under-the-gun': {
    title: 'Under the gun',
    senses: [
      {
        text: 'First to act before the [[flop]]. The worst seat, so play very few [[hand|hands]] from it.',
        example: 'Everybody else gets to act after you.'
      }
    ]
  },

  steal: {
    title: 'Steal',
    senses: [
      {
        text: 'Raising from a late seat mostly to win the [[blinds]] without a fight.',
        example: 'It folds to you on the [[button]] and you raise with nine seven.'
      }
    ]
  },

  'check-raise': {
    title: 'Check-raise',
    senses: [
      {
        text: '[[check|Check]], let them [[bet]], then [[raise]] them. It gets more money in than betting yourself.',
        example: 'You check [[two-pair|two pair]], they bet 10, you make it 35.'
      }
    ]
  },

  'pot-sized-bet': {
    title: 'Pot sized bet',
    senses: [
      {
        text: 'A bet the size of the [[pot]]. About the most you can charge a [[draw]] and still get called.',
        example: 'Pot is 30, you bet 30.'
      }
    ]
  },

  'expected-value': {
    title: 'Expected value',
    senses: [
      {
        text: 'What a decision is worth on average. A good one still loses plenty of the time.',
        example: 'Calling 10 to win 40 one time in three makes money long term.'
      }
    ]
  },

  tight: {
    title: 'Tight',
    senses: [
      {
        text: 'Plays very few [[hand|hands]]. When they put money in, believe them.',
        example: 'Folds twenty in a row, then raises. Respect it.'
      }
    ]
  },

  loose: {
    title: 'Loose',
    senses: [
      {
        text: 'Plays lots of [[hand|hands]], including weak ones, so their bets tell you less.',
        example: 'They called a raise with seven three.'
      }
    ]
  },

  passive: {
    title: 'Passive',
    senses: [
      {
        text: '[[check|Checks]] and [[call|calls]] rather than betting and raising. Rarely puts you under pressure.',
        example: 'Called three streets, never raised.'
      }
    ]
  },

  aggressive: {
    title: 'Aggressive',
    senses: [
      {
        text: 'Bets and raises often. Most beginners do not do this enough.',
        example: 'They raise your [[flop]] bet with only a [[draw]].'
      }
    ]
  },

  'calling-station': {
    title: 'Calling station',
    senses: [
      {
        text: '[[call|Calls]] with anything and will not [[fold]]. Never [[bluff]] them, just [[value-bet|value bet]] them.',
        example: 'Bet [[top-pair|top pair]] three times and get paid every time.'
      }
    ]
  },

  leak: {
    title: 'Leak',
    senses: [
      {
        text: 'A mistake you keep repeating. Fixing one is worth more than any new trick.',
        example: 'The Stats screen lists yours, worst first.'
      }
    ]
  }

};

// Different ways the same thing gets written, so copy can read naturally.
export const ALIASES = {
  'community cards': 'community-cards',
  'big blind': 'big-blind',
  'small blind': 'small-blind',
  'pot odds': 'pot-odds',
  'flush draw': 'flush-draw',
  'top pair': 'top-pair',
  'middle pair': 'middle-pair',
  'two pair': 'two-pair',
  'all in': 'all-in',
  'in position': 'in-position',
  'out of position': 'out-of-position',
  'open ended straight draw': 'open-ended-straight-draw',
  'continuation bet': 'continuation-bet',
  'value bet': 'value-bet',
  'semi bluff': 'semi-bluff',
  'made hand': 'made-hand',
  'high card': 'high-card',
  'showdown value': 'showdown-value',
  'side pot': 'side-pot',
  'board texture': 'board-texture',
  'expected value': 'expected-value',
  'check raise': 'check-raise',
  'pot sized bet': 'pot-sized-bet',
  'rule of two and four': 'rule-of-two-and-four',
  'backdoor draw': 'backdoor-draw',
  'calling station': 'calling-station',
  'under the gun': 'under-the-gun',
  'three bet': 'three-bet',
  'pocket pair': 'pocket-pair',
  'bottom pair': 'bottom-pair',
  'three of a kind': 'three-of-a-kind',
  set: 'three-of-a-kind',
  'full house': 'full-house',
  'four of a kind': 'four-of-a-kind',
  'straight flush': 'straight-flush',
  'royal flush': 'straight-flush'
};

export function resolveSlug(key) {
  if (!key) return null;
  const direct = String(key).trim();
  if (TERMS[direct]) return direct;
  const lower = direct.toLowerCase();
  if (TERMS[lower]) return lower;
  if (ALIASES[lower]) return ALIASES[lower];
  const dashed = lower.replace(/\s+/g, '-');
  if (TERMS[dashed]) return dashed;
  return null;
}

export function getTerm(key) {
  const slug = resolveSlug(key);
  return slug ? Object.assign({ slug }, TERMS[slug]) : null;
}

/**
 * Split copy written with [[slug|display text]] markup into a token list the
 * renderer can turn into tappable spans.
 */
export function parseMarkup(text) {
  const tokens = [];
  const pattern = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
  let last = 0;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) {
      tokens.push({ type: 'text', text: text.slice(last, match.index) });
    }
    const slug = resolveSlug(match[1]);
    const display = match[2] || (slug ? TERMS[slug].title.toLowerCase() : match[1]);
    if (slug) {
      tokens.push({ type: 'term', slug, text: display });
    } else {
      tokens.push({ type: 'text', text: display });
    }
    last = pattern.lastIndex;
  }
  if (last < text.length) tokens.push({ type: 'text', text: text.slice(last) });
  return tokens;
}

// Plain text with the markup stripped, for search and for list previews.
export function plainText(markup) {
  return parseMarkup(String(markup || '')).map((token) => token.text).join('');
}

export function allTerms() {
  return Object.keys(TERMS)
    .map((slug) => Object.assign({ slug }, TERMS[slug]))
    .sort((a, b) => a.title.localeCompare(b.title));
}

export function searchTerms(query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return allTerms();
  return allTerms().filter((term) => {
    if (term.title.toLowerCase().includes(q)) return true;
    if (term.slug.includes(q)) return true;
    return term.senses.some((s) => plainText(s.text).toLowerCase().includes(q));
  });
}
