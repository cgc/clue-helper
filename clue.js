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

/**
 * Given a list of true variables, this returns a negated list of all other variables
 * that are in our solver. This can be useful for making a set of true variables into
 * something that can totally identify a solution to eliminate it from a solver.
 * @param {LogicSolver} solver - A Logic solver instance.
 * @param {array<string>} v - The variable we are trying to
 *   find potential cards for.
 */
function negatedMissingVars(solver, trueVars) {
  const allVars = solver._num2name.filter(function(name) { return name && name[0] !== '$' });
  const trueVarsObject = trueVars.reduce(function(acc, v) { acc[v] = true; return acc; }, {});
  return allVars.filter(v => !trueVarsObject[v]).map(v => Logic.not(v));
}

/**
 * Finds potental cards that a variable can potentially have.
 * @param {LogicSolver} solver - A Logic solver instance.
 * @param {LogicSolverVariable} v - The variable we are trying to
 *   find potential cards for.
 */
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

    invariant(cardsFaceUp === 0, 'TODO have not added support for specifying cards face up');

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

  *_playersBetween(suggester, refuter) {
    // returns list of player indices between suggester and refuter. If refuter
    // is missing, all players but the suggester are returned.
    // Handles wrap-around in players array. Handles case of missing refuter.
    const suggesterIndex = this.players.indexOf(suggester);
    const refuterIndex = refuter ? this.players.indexOf(refuter) : suggesterIndex;
    let lastIndex = refuterIndex;
    if (refuterIndex <= suggesterIndex) {
      lastIndex += this.players.length;
    }

    for (let idx = suggesterIndex + 1; idx < lastIndex; idx++) {
      yield this.players[idx % this.players.length];
    }
  }

  suggest(suggester, suspect, weapon, room, refuter, cardShown) {
    invariant(refuter !== suggester, 'refuter is the suggester');

    const suggestedCards = [suspect, weapon, room];

    for (const player of this._playersBetween(suggester, refuter)) {
      this._constrainPlayerCards(player, _hasNone(suggestedCards));
    }

    if (cardShown) {
      this._constrainPlayerCards(refuter, _hasAnyCard([cardShown]));
    } else if (refuter) {
      this._constrainPlayerCards(refuter, _hasAnyCard(suggestedCards));
    }
  }

  potentialSolution() {
    return {
      suspect: potentialCards(this.solver, this.caseSuspect),
      weapon: potentialCards(this.solver, this.caseWeapon),
      room: potentialCards(this.solver, this.caseRoom)
    };
  }

  checkAccusation(suspect, weapon, room) {
    const s = this.potentialSolution();
    return s.suspect.includes(suspect) &&
      s.weapon.includes(weapon) &&
      s.room.includes(room);
  }

  hasExactSolution() {
    const s = this.potentialSolution();
    return s.suspect.length === 1 &&
      s.weapon.length === 1 &&
      s.room.length === 1;
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
// visible for testing
exports._negatedMissingVars = negatedMissingVars;
exports._potentialCards = potentialCards;
