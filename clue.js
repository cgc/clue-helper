// I borrow the test case in this file and took lots of hints from
// this assignment: http://cs.gettysburg.edu/~tneller/nsf/clue/clue.pdf
const Logic = require('logic-solver');
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

function negatedMissingVars(solver, trueVars) {
  const allVars = solver._num2name.filter(function(name) { return name && name[0] !== '$' });
  const trueVarsObject = trueVars.reduce(function(acc, v) { acc[v] = true; return acc; }, {});
  return allVars.filter(v => !trueVarsObject[v]).map(v => Logic.not(v));
}

function potentialCards(solver, v) {
  const prev = [];
  const solutions = new Set();

  while (true) {
    const solution = solver.solveAssuming(Logic.and(...prev));

    if (!solution) {
      break;
    }

    const s = cardValues[solution.evaluate(v)];
    if (solutions.has(s)) {
      break;
    }
    solutions.add(s);

    const solutionTrue = solution.getTrueVars().filter(s => v.bits.includes(s));
    prev.push(Logic.not(Logic.and(
      ...solutionTrue,
      ...negatedMissingVars({_num2name: v.bits}, solutionTrue)
    )));
  }

  return Array.from(solutions);
}

function _hasAnyCard(cards) {
  const bitCards = cards.map(c => Logic.constantBits(cardValues.indexOf(c)));
  // asserts that a player must have at least one of these cards.
  return (playerCards) => Logic.or(
    ...bitCards.map(bitCard => Logic.or(
      ...playerCards.map(playerCard =>
        Logic.equalBits(playerCard, bitCard)))));
}

function _hasNone(cards) {
  // asserts that a player cannot have any of these cards.
  return (playerCards) => Logic.not(_hasAnyCard(cards)(playerCards));
}

class ClueGame {
  constructor(players) {
    this.solver = new Logic.Solver();
    // XXX? this.solver._minisat._C.TOTAL_MEMORY = 3e8;

    const cardsNotInCaseFile = cardValues.length - 3;
    const cardsPerPlayer = Math.floor(cardsNotInCaseFile / players.length);
    const cardsFaceUp = cardsNotInCaseFile - cardsPerPlayer * players.length;

    // Add cards that are left face-up
    this.faceUp = [];
    for (let idx = 0; idx < cardsFaceUp; idx++) {
      const name = `faceUp.${idx}`;
      this.faceUp.push(this._createCardLocation(name));
    }

    // Add cards for each player
    this.cardLocations = [];
    for (let idx = 0; idx < players.length; idx++) {
      const player = players[idx];
      invariant(suspectValues.includes(player), `found invalid player: ${player}`);
      const c = [];
      for (let cardIndex = 0; cardIndex < cardsPerPlayer; cardIndex++) {
        c.push(this._createCardLocation(`player.${idx}.card.${cardIndex}`));
      }
      this.cardLocations.push(c);
    }

    this.caseSuspect = this._createCardLocation('case.suspect');
    this.caseWeapon = this._createCardLocation('case.weapon');
    this.caseRoom = this._createCardLocation('case.room');
    this._constrainCardExistsAndUnique(suspectValues, this.caseSuspect);
    this._constrainCardExistsAndUnique(weaponValues, this.caseWeapon);
    this._constrainCardExistsAndUnique(roomValues, this.caseRoom);

    this.cardsPerPlayer = cardsPerPlayer;
    this.players = players;
  }

  _createCardLocation(name) {
    const cardLocation = Logic.variableBits(name, Math.ceil(Math.log2(cardValues.length)));
    this.solver.require(Logic.lessThan(cardLocation, Logic.constantBits(cardValues.length)));
    return cardLocation;
  }

  _constrainCardExistsAndUnique(values, caseFile) {
    const bitValues = values.map(v => Logic.constantBits(cardValues.indexOf(v)));

    // ensure the case file can only have values of this kind
    this.solver.require(Logic.exactlyOne(...bitValues.map(v =>
      Logic.equalBits(caseFile, v))));

    // Each card is in at least one place (including case file).
    // If a card is one place, it cannot be in another place.
    const vars = flatten(this.cardLocations)
      .concat(this.faceUp)
      .concat([caseFile]);

    for (const bitValue of bitValues) {
      this.solver.require(Logic.exactlyOne(...vars.map(c =>
        Logic.equalBits(c, bitValue)
      )));
    }
  }

  _constrainPlayerCards(player, constraint) {
    const cardLocations = this.cardLocations[this.players.indexOf(player)];
    this.solver.require(constraint(cardLocations));
  }

  hand(player, cards) {
    invariant(cards.length === this.cardsPerPlayer, 'hand must be');
    for (const card of cards) {
      this._constrainPlayerCards(player, _hasAnyCard([card]));
    }
  }

  suggest(suggester, suspect, weapon, room, refuter, cardShown) {
    invariant(refuter !== suggester, 'refuter is the suggester');

    const suggestedCards = [suspect, weapon, room];
    const suggesterIndex = this.players.indexOf(suggester);

    // handles wrap-around in players array. handles case of missing refuter.
    const refuterIndex = refuter ? this.players.indexOf(refuter) : suggesterIndex;
    let idx = suggesterIndex + 1;
    while (idx < refuterIndex) {
      idx = idx % this.players.length;
      this._constrainPlayerCards(this.players[idx], _hasNone(suggestedCards));
      idx++;
    }

    if (cardShown) {
      this._constrainPlayerCards(refuter, _hasAnyCard([cardShown]));
    } else if (refuter) {
      this._constrainPlayerCards(refuter, _hasAnyCard(suggestedCards));
    }
  }

  checkAccusation(suspect, weapon, room) {
    return potentialCards(this.solver, this.caseSuspect).includes(suspect) &&
      potentialCards(this.solver, this.caseWeapon).includes(weapon) &&
      potentialCards(this.solver, this.caseRoom).includes(room);
  }

  failedAccusation(suspect, weapon, room) {
    // XXX
    // this.solver.require(Logic.or(
    //   Logic.not(Logic.equalBits(
    //     this.caseSuspect,
    //     Logic.constantBits(cardValues.indexOf(suspect))))
    //   ...));
  }
}

exports.ClueGame = ClueGame;
