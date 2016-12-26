// I borrow the test case in this file and took lots of hints from
// this assignment: http://cs.gettysburg.edu/~tneller/nsf/clue/clue.pdf
const csp = require('csp.js');
const invariant = require('invariant');

const suspectValues = [
  'mustard',
  'plum',
  'green',
  'peacock',
  'scarlet',
  'white',
];

const weaponValues = [
  'knife',
  'candlestick',
  'revolver',
  'rope',
  'lead pipe',
  'wrench',
];

const roomValues = [
  'hall',
  'lounge',
  'dining room',
  'kitchen',
  'ballroom',
  'conservatory',
  'billiard room',
  'library',
  'study',
];

const cardValues = suspectValues.concat(weaponValues).concat(roomValues);

function flatten(list) {
  return list.reduce((a, b) => a.concat(b), []);
}

function _hasAnyCard(cards) {
  // asserts that a player must have at least one of these cards.
  return (...playerCards) => cards.some(card => playerCards.includes(card));
}

function _hasNone(cards) {
  // asserts that a player cannot have any of these cards.
  return (...playerCards) => !_hasAnyCard(cards);
}

class Game {
  constructor(players) {
    this.p = csp.DiscreteProblem();
    this.p.addVariable('case.suspect', suspectValues);
    this.p.addVariable('case.weapon', weaponValues);
    this.p.addVariable('case.room', roomValues);

    const cardsNotInCaseFile = cardValues.length - 3;
    const cardsPerPlayer = Math.floor(cardsNotInCaseFile / players.length);
    const cardsFaceUp = cardsNotInCaseFile - cardsPerPlayer * players.length;

    // Add cards that are left face-up
    for (let idx = 0; idx < cardsFaceUp; idx++) {
      const name = `faceUp.${idx}`;
      this.p.addVariable(name, cardValues);
      this.faceUp.push(name);
    }

    // Add cards for each player
    this.cardConstraints = [];
    for (let idx = 0; idx < players.length; idx++) {
      const player = players[idx];
      invariant(suspectValues.includes(player), `found invalid player: ${player}`);
      const c = [];
      for (let cardIndex = 0; cardIndex < cardsPerPlayer; cardIndex++) {
        const name = `player.${idx}.card.${cardIndex}`;
        this.p.addVariable(name, cardValues);
        c.push(name);
      }
      this.cardConstraints.push(c);
    }

    this._constrainCardExistsAndUnique(suspectValues, 'case.suspect');
    this._constrainCardExistsAndUnique(weaponValues, 'case.weapon');
    this._constrainCardExistsAndUnique(roomValues, 'case.room');

    this.cardsPerPlayer = cardsPerPlayer;
    this.players = players;
  }

  _constrainCardExistsAndUnique(values, caseFileConstraintName) {
    // Each card is in at least one place (including case file).
    // If a card is one place, it cannot be in another place.
    const constraintNames = flatten(this.cardConstraints)
      .concat(this.faceUp)
      .concat([caseFileConstraintName]);
    this.p.addConstraint(constraintNames, function(...cards) {
      for (const value of values) {
        const idx = cards.indexOf(value);
        // tests for existence
        if (idx === -1) {
          return false;
        }
        // tests for uniqueness
        if (cards.indexOf(value, idx + 1) !== -1) {
          return false;
        }
      }
      return true;
    });
  }

  _constrainPlayerCards(player, constraint) {
    const cardConstraints = this.cardConstraints[this.players.indexOf(player)];
    this.p.addConstraint(cardConstraints, constraint);
  }

  hand(player, cards) {
    invariant(cards.length === this.cardsPerPlayer, 'hand must be');
    for (const card in cards) {
      this._constrainPlayerCards(player, _hasAnyCard([card]));
    }
  }

  suggest(suggester, suspect, weapon, room, refuter, cardShown) {
    invariant(refuter !== suggester, 'refuter is the suggester');

    const suggestedCards = [suspect, weapon, room];
    const suggesterIndex = this.players.indexOf(suggester);

    // handles wrap-around in players array. handles case of missing refuter.
    const refuterIndex = refuter ? this.players.indexOf(refuter) : suggesterIndex;
    for (let idx = suggesterIndex; idx < refuterIndex; idx = (idx + 1) % this.players.length) {
      this._constrainPlayerCards(this.players[idx], _hasNone(suggestedCards));
    }

    if (cardShown) {
      this._constrainPlayerCards(refuter, _hasAnyCard([cardShown]));
    } else if (refuter) {
      this._constrainPlayerCards(refuter, _hasAnyCard(suggestedCards));
    }
  }
}

function test() {
  const cr = new Game([
    'scarlet',
    'mustard',
    'white',
    'green',
    'peacock',
    'plum',
  ]);

  console.log('hi', cr.p.getSolutions());
  cr.hand('scarlet', ['white', 'library', 'study']);
  console.log('hi', cr.p.getSolutions());
  cr.suggest('scarlet', 'scarlet', 'rope', 'lounge', 'mustard', 'scarlet');
  cr.suggest('mustard', 'peacock', 'lead pipe', 'dining room', 'peacock', null);
  cr.suggest('white', 'mustard', 'revolver', 'ballroom', 'peacock', null);
  cr.suggest('green', 'white', 'knife', 'ballroom', 'plum', null);
  console.log(cr.p.getSolutions());
  cr.suggest('peacock', 'green', 'candlestick', 'dining room', 'white', null);
  cr.suggest('plum', 'white', 'wrench', 'study', 'scarlet', 'white');
  cr.suggest('scarlet', 'plum', 'rope', 'conservatory', 'mustard', 'plum');
  cr.suggest('mustard', 'peacock', 'rope', 'ballroom', 'white', null);
  cr.suggest('white', 'mustard', 'candlestick', 'study', 'green', null);
  cr.suggest('green', 'peacock', 'knife', 'dining room', 'peacock', null);
  cr.suggest('peacock', 'mustard', 'lead pipe', 'dining room', 'plum', null);
  cr.suggest('plum', 'green', 'knife', 'conservatory', 'white', null);
  cr.suggest('scarlet', 'peacock', 'knife', 'lounge', 'mustard', 'lounge');
  console.log(cr.p.getSolutions());
  cr.suggest('mustard', 'peacock', 'knife', 'dining room', 'white', null);
  cr.suggest('white', 'peacock', 'wrench', 'hall', 'green', null);
  cr.suggest('green', 'white', 'lead pipe', 'conservatory', 'plum', null);
  cr.suggest('peacock', 'scarlet', 'lead pipe', 'hall', 'mustard', null);
  cr.suggest('plum', 'peacock', 'lead pipe', 'ballroom', null, null);
  cr.suggest('scarlet', 'white', 'lead pipe', 'hall', 'peacock', 'hall');
  cr.suggest('white', 'peacock', 'lead pipe', 'hall', 'peacock', null);
  cr.suggest('peacock', 'peacock', 'lead pipe', 'hall', null, null);
  cr.suggest('scarlet', 'green', 'lead pipe', 'study', 'white', 'green');
  cr.suggest('mustard', 'peacock', 'lead pipe', 'ballroom', 'plum', null);
  cr.suggest('white', 'peacock', 'lead pipe', 'study', 'scarlet', 'study');
  cr.suggest('green', 'white', 'lead pipe', 'study', 'scarlet', 'white');
  cr.suggest('peacock', 'white', 'lead pipe', 'study', 'scarlet', 'white');
  cr.suggest('plum', 'peacock', 'lead pipe', 'kitchen', 'green', null);
  console.log(cr.p.getSolutions());
  cr.accuse('scarlet', 'peacock', 'lead pipe', 'billiard room', true);
}

test();
