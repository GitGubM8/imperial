import { Nation, Bond } from "./constants.js";
import Action from "./action.js";
import standardGameBoard from "./board.js";
import setup from "./standardSetup.js";

export default class Imperial {
  static fromLog(log) {
    let game = new Imperial();
    log.forEach(entry => game.tick(entry));
    return game;
  }

  constructor(board) {
    this.board = board || standardGameBoard;
    this.log = [];
    this.unitsToMove = [];
    this.units = new Set();
    this.provinces = new Map();
    this.nations = new Map();
    this.availableActions = new Set();

    this.maneuvering = false;
    this.handlingConflict = false;
  }

  tick(action) {
    // Initialize and endGame actions are always valid.
    if (action.type === "initialize") {
      this.log.push(action);
      this.initialize(action);
      return;
    } else if (action.type === "endGame") {
      this.log.push(action);
      this.endGame();
      return;
    }

    // Check if the requested action is invalid.
    let validAction = false;
    for (const availableAction of this.availableActions) {
      if (this.isEqual(availableAction, action)) {
        validAction = true;
      }
    }

    if (!validAction) { return; }

    this.log.push(action);

    switch (action.type) {
      case "noop":
        return;
      case "bondPurchase": {
        this.bondPurchase(action);
        return;
      }
      case "endManeuver": {
        this.endManeuver();
        return;
      }
      case "fight": {
        this.fight(action);
        return;
      }
      case "coexist": {
        this.coexist();
        return;
      }
      case "buildFactory": {
        this.buildFactory(action);
        return;
      }
      case "import": {
        this.import(action);
        return;
      }
      case "maneuver": {
        this.maneuver(action);
        return;
      }
      case "rondel": {
        this.rondel(action);
        return;
      }
    }
  }

  initialize(action) {
    const s = setup({
      players: action.payload.players,
      provinceNames: Array.from(this.board.graph.keys())
    });
    this.availableBonds = s.availableBonds;
    this.currentNation = s.currentNation;
    this.investorCardHolder = s.investorCardHolder;
    this.nations = s.nations;
    this.order = s.order;
    this.players = s.players;
    this.provinces = s.provinces;
    this.units = s.units;
    this.currentPlayerName = this.nations.get(this.currentNation).controller;
    this.availableActions = new Set(this.rondelActions(this.currentNation));
  }

  bondPurchase(action) {
    const uncost = {
      2: 1,
      4: 2,
      6: 3,
      9: 4,
      12: 5,
      16: 6,
      20: 7,
      25: 8,
      30: 9
    };
    const bonds = this.players[action.payload.player].bonds;
    if (action.payload.cost > this.players[action.payload.player].cash) {
      const tradeIn = [...bonds]
        .filter(({ nation }) => nation === action.payload.nation)
        .map(({ cost }) => cost)[0];
      if (tradeIn === undefined) {
        throw new Error(
          `${action.payload.player} does not have any bonds to trade for ${action.payload.nation}`
        );
      }
      const bondToTrade = Bond(action.payload.nation, uncost[tradeIn]);
      const netCost = action.payload.cost - bondToTrade.cost;
      this.nations.get(action.payload.nation).treasury += netCost;
      this.availableBonds.add(bondToTrade);
      this.players[action.payload.player].cash -= netCost;
      this.players[action.payload.player].bonds.delete(bondToTrade);
    } else {
      this.nations.get(action.payload.nation).treasury += action.payload.cost;
      this.players[action.payload.player].cash -= action.payload.cost;
    }

    const newBond = Bond(action.payload.nation, uncost[action.payload.cost]);
    if (!this.availableBonds.has(newBond)) {
      throw new Error(`${newBond} not available`);
    }
    this.players[action.payload.player].bonds.add(newBond);
    this.availableBonds.delete(newBond);

    if (this.nations.get(action.payload.nation).controller === null) {
      this.nations.get(action.payload.nation).controller =
        action.payload.player;
    }

    if (
      this.totalInvestmentInNation(
        action.payload.player,
        action.payload.nation
      ) >
      this.totalInvestmentInNation(
        this.nations.get(action.payload.nation).controller,
        action.payload.nation
      )
    ) {
      this.nations.get(action.payload.nation).controller =
        action.payload.player;
    }
    this.investorCardActive = false;
    this.advanceInvestorCard();
    this.handleAdvancePlayer();
    this.availableActions = new Set(this.rondelActions(this.currentNation));
  }

  endManeuver() {
    this.unitsToMove = [];
    this.maneuvering = false;
    this.handleAdvancePlayer();
    this.availableActions = new Set(this.rondelActions(this.currentNation));
  }

  endGame() {
    const scores = {};
    Object.keys(this.players).forEach(player => {
      let score = 0;
      for (const bond of this.players[player].bonds) {
        const powerPoints = this.nations.get(bond.nation).powerPoints;
        score += bond.number * parseInt(powerPoints / 5);
      }
      score += this.players[player].cash;
      scores[player] = score;
    });
    const winningScore = Math.max(...Object.keys(scores).map(x => scores[x]));
    const winner = Object.keys(scores).filter(
      x => scores[x] === winningScore
    )[0];

    this.winner = winner;
  }

  fight(action) {
    const incumbentUnitsAtProvince = this.units
      .get(action.payload.incumbent)
      .get(action.payload.province);
    const challengerUnitsAtProvince = this.units
      .get(action.payload.challenger)
      .get(action.payload.province);

    // Remove units at the fight
    if (incumbentUnitsAtProvince.fleets > 0) {
      if (action.payload.targetType === "army") {
        incumbentUnitsAtProvince.armies -= 1;
        challengerUnitsAtProvince.armies -= 1;
      } else {
        incumbentUnitsAtProvince.fleets -= 1;
        challengerUnitsAtProvince.fleets -= 1;
      }
    } else {
      incumbentUnitsAtProvince.armies -= 1;
      challengerUnitsAtProvince.armies -= 1;
    }

    const totalIncumbentUnitsAtProvince =
      incumbentUnitsAtProvince.armies + incumbentUnitsAtProvince.fleets;
    const totalChallengerUnitsAtProvince =
      challengerUnitsAtProvince.armies + challengerUnitsAtProvince.fleets;

    // Change flags, if challenger wins
    if (totalChallengerUnitsAtProvince > totalIncumbentUnitsAtProvince) {
      this.provinces.get(action.payload.province).flag =
        action.payload.challenger;
    }

    this.handlingConflict = false;
    if (this.unitsToMove.length === 0) {
      this.unitsToMove = [];
      this.handleAdvancePlayer();
      this.availableActions = new Set(this.rondelActions(this.currentNation));
    } else {
      const lastManeuverRondelAction = this.log
        .reverse()
        .find(action => action.type === "rondel");
      this.beginManeuver(lastManeuverRondelAction);
    }
  }

  coexist() {
    this.handlingConflict = false;
    if (this.unitsToMove.length === 0) {
      this.unitsToMove = [];
      this.handleAdvancePlayer();
      this.availableActions = new Set(this.rondelActions(this.currentNation));
    } else {
      const lastManeuverRondelAction = this.log
        .reverse()
        .find(action => action.type === "rondel");
      const destinations = new Set([Action.endManeuver()]);
      const action = lastManeuverRondelAction;
      const provincesWithFleets = new Map();
      const provincesWithArmies = new Map();

      for (const [province, type] of this.unitsToMove) {
        if (type === "fleet") {
          provincesWithFleets.set(province, 1);
        } else {
          provincesWithArmies.set(province, 1);
        }
      }

      for (const [origin] of provincesWithFleets) {
        for (const destination of this.board.neighborsFor({
          origin,
          nation: action.payload.nation,
          isFleet: true,
          friendlyFleets: new Set()
        })) {
          destinations.add(
            Action.maneuver({
              origin,
              destination
            })
          );
        }
      }

      for (const [origin] of provincesWithArmies) {
        for (const destination of this.board.neighborsFor({
          origin,
          nation: action.payload.nation,
          isFleet: false,
          friendlyFleets: new Set()
        })) {
          destinations.add(
            Action.maneuver({
              origin,
              destination
            })
          );
        }
      }

      this.availableActions = destinations;
    }
  }

  buildFactory(action) {
    this.provinces.get(action.payload.province).factory = this.board.graph.get(
      action.payload.province
    ).factoryType;
    this.nations.get(this.currentNation).treasury -= 5;
    if (
      this.nations.get(this.currentNation).previousRondelPosition ===
      "maneuver1"
    ) {
      this.endOfInvestorTurn();
    }
    this.handleAdvancePlayer();
    this.availableActions = new Set(this.rondelActions(this.currentNation));
    this.buildingFactory = false;
  }

  import(action) {
    action.payload.placements.forEach(({ province, type }) => {
      const nation = this.board.graph.get(province).nation;
      if (type === "army") {
        this.units.get(nation).get(province).armies++;
      } else {
        this.units.get(nation).get(province).fleets++;
      }
      this.nations.get(nation).treasury--;
    });
    const potentialPreInvestorSlots = [
      "maneuver1",
      "production1",
      "factory",
      "taxation",
      "maneuver2"
    ];
    this.importing = false;
    if (
      potentialPreInvestorSlots.includes(
        this.nations.get(this.currentNation).previousRondelPosition
      )
    ) {
      this.endOfInvestorTurn();
      return;
    } else {
      this.handleAdvancePlayer();
      this.availableActions = new Set(this.rondelActions(this.currentNation));
    }
  }

  maneuver(action) {
    const origin = action.payload.origin;
    const destination = action.payload.destination;
    const unitType = this.board.graph.get(destination).isOcean
      ? "fleet"
      : "army";

    // Execute the unit movement
    if (unitType === "fleet") {
      this.units.get(this.currentNation).get(origin).fleets--;
      this.units.get(this.currentNation).get(destination).fleets++;
    }
    if (unitType === "army") {
      this.units.get(this.currentNation).get(origin).armies--;
      this.units.get(this.currentNation).get(destination).armies++;

      // Fleets cannot move after armies!
      this.unitsToMove = this.unitsToMove.filter(([, type]) => type === "army");
    }

    // Remove the unit that just moved from this.unitsToMove
    const i = this.unitsToMove.findIndex(
      arr => arr[0] === action.payload.origin && arr[1] === unitType
    );
    this.unitsToMove.splice(i, 1);

    // Interrupt manuevers in case of potential conflict!
    for (const [nation] of this.nations) {
      if (nation !== this.currentNation) {
        const units = this.units.get(nation).get(destination);
        if (units.armies > 0 || units.fleets > 0) {
          this.availableActions = new Set();
          if (units.armies > 0) {
            this.availableActions.add(
              Action.fight({
                province: destination,
                incumbent: nation,
                challenger: this.currentNation,
                targetType: "army"
              })
            );
          }
          if (units.fleets > 0) {
            this.availableActions.add(
              Action.fight({
                province: destination,
                incumbent: nation,
                challenger: this.currentNation,
                targetType: "fleet"
              }),
            );
          }
          this.availableActions.add(
            Action.coexist({
              province: destination,
              incumbent: nation,
              challenger: this.currentNation
            })
          )
          this.handlingConflict = true;
          return;
        }
      }
    }

    // Don't update the province flag if the province is a home province of a nation.
    let plantFlag = true;
    for (const [nation, provinces] of this.board.byNation) {
      if (provinces.has(destination) && !!nation) {
        plantFlag = false;
      }
    }
    if (plantFlag === true) {
      // Update province flag
      this.provinces.get(destination).flag = this.currentNation;
    }

    if (this.unitsToMove.length > 0) {
      const provincesWithFleets = new Map();
      const provincesWithArmies = new Map();
      const out = new Set([Action.endManeuver()]);
      this.unitsToMove.forEach(([origin]) => {
        const units = this.units.get(this.currentNation).get(origin);
        if (units.fleets > 0) {
          provincesWithFleets.set(origin, units.fleets);
        } else if (units.armies > 0) {
          provincesWithArmies.set(origin, units.armies);
        }
        for (const [origin] of provincesWithFleets) {
          for (const destination of this.board.neighborsFor({
            origin,
            nation: this.currentNation,
            isFleet: true,
            friendlyFleets: new Set()
          })) {
            out.add(Action.maneuver({ origin, destination }));
          }
        }
        const friendlyFleets = new Set();
        for (const [province, units] of this.units.get(this.currentNation)) {
          if (units.fleets > 0) {
            friendlyFleets.add(province);
          }
        }
        for (const [origin] of provincesWithArmies) {
          for (const destination of this.board.neighborsFor({
            origin,
            nation: this.currentNation,
            isFleet: false,
            friendlyFleets
          })) {
            out.add(Action.maneuver({ origin, destination }));
          }
        }
      });
      this.availableActions = out;
    } else {
      // No more units may be maneuvered on this turn.
      if (this.nations.get(this.currentNation).rondelPosition === "maneuver2") {
        const potentialPreInvestorSlots = [
          "factory",
          "production1",
          "maneuver1"
        ];
        if (
          potentialPreInvestorSlots.includes(
            this.nations.get(this.currentNation).previousRondelPosition
          )
        ) {
          this.endOfInvestorTurn();
        }
      }
      this.maneuvering = false;
      this.handleAdvancePlayer();
      this.availableActions = new Set(this.rondelActions(this.currentNation));
    }
  }

  rondel(action) {
    this.currentNation = action.payload.nation;
    const currentNation = this.nations.get(this.currentNation);
    currentNation.previousRondelPosition = currentNation.rondelPosition;
    currentNation.rondelPosition = action.payload.slot;
    this.players[this.currentPlayerName].cash -= action.payload.cost;

    switch (action.payload.slot) {
      case "investor": {
        this.investor(action);
        return;
      }
      case "import": {
        const availableActions = new Set([Action.import({ placements: [] })]);
        const homeProvinces = this.board.byNation.get(action.payload.nation);
        for (const province of homeProvinces) {
          availableActions.add(
            Action.import({ placements: [{ province, type: "army" }] })
          );
          if (this.board.graph.get(province).factoryType === "shipyard") {
            availableActions.add(
              Action.import({ placements: [{ province, type: "fleet" }] })
            );
          }

          for (const province2 of homeProvinces) {
            availableActions.add(
              Action.import({
                placements: [
                  { province, type: "army" },
                  { province: province2, type: "army" }
                ]
              })
            );
            if (this.board.graph.get(province).factoryType === "shipyard") {
              availableActions.add(
                Action.import({
                  placements: [
                    { province, type: "fleet" },
                    { province: province2, type: "army" }
                  ]
                })
              );
            }
            if (this.board.graph.get(province2).factoryType === "shipyard") {
              availableActions.add(
                Action.import({
                  placements: [
                    { province, type: "army" },
                    { province: province2, type: "fleet" }
                  ]
                })
              );
            }
            if (
              this.board.graph.get(province).factoryType === "shipyard" &&
              this.board.graph.get(province2).factoryType === "shipyard"
            ) {
              availableActions.add(
                Action.import(
                  { placements: [{ province, type: "fleet" }] },
                  { province: province2, type: "fleet" }
                )
              );
            }

            for (const province3 of homeProvinces) {
              availableActions.add(
                Action.import({
                  placements: [
                    { province, type: "army" },
                    { province: province2, type: "army" },
                    { province: province3, type: "army" }
                  ]
                })
              );
              if (this.board.graph.get(province).factoryType === "shipyard") {
                availableActions.add(
                  Action.import({
                    placements: [
                      { province, type: "fleet" },
                      { province: province2, type: "army" },
                      { province: province3, type: "army" }
                    ]
                  })
                );
              }
              if (this.board.graph.get(province2).factoryType === "shipyard") {
                availableActions.add(
                  Action.import({
                    placements: [
                      { province, type: "army" },
                      { province: province2, type: "fleet" },
                      { province: province3, type: "army" }
                    ]
                  })
                );
              }
              if (this.board.graph.get(province3).factoryType === "shipyard") {
                availableActions.add(
                  Action.import({
                    placements: [
                      { province, type: "army" },
                      { province: province2, type: "army" },
                      { province: province3, type: "fleet" }
                    ]
                  })
                );
              }
              if (
                this.board.graph.get(province).factoryType === "shipyard" &&
                this.board.graph.get(province2).factoryType === "shipyard"
              ) {
                availableActions.add(
                  Action.import({
                    placements: [
                      { province, type: "fleet" },
                      { province: province2, type: "fleet" },
                      { province: province3, type: "army" }
                    ]
                  })
                );
              }
              if (
                this.board.graph.get(province).factoryType === "shipyard" &&
                this.board.graph.get(province3).factoryType === "shipyard"
              ) {
                availableActions.add(
                  Action.import({
                    placements: [
                      { province, type: "fleet" },
                      { province: province2, type: "army" },
                      { province: province3, type: "fleet" }
                    ]
                  })
                );
              }
              if (
                this.board.graph.get(province2).factoryType === "shipyard" &&
                this.board.graph.get(province3).factoryType === "shipyard"
              ) {
                availableActions.add(
                  Action.import({
                    placements: [
                      { province, type: "army" },
                      { province: province2, type: "fleet" },
                      { province: province3, type: "fleet" }
                    ]
                  })
                );
              }
              if (
                this.board.graph.get(province).factoryType === "shipyard" &&
                this.board.graph.get(province2).factoryType === "shipyard" &&
                this.board.graph.get(province3).factoryType === "shipyard"
              ) {
                availableActions.add(
                  Action.import({
                    placements: [
                      { province, type: "fleet" },
                      { province: province2, type: "fleet" },
                      { province: province3, type: "fleet" }
                    ]
                  })
                );
              }
            }
          }
        }
        this.availableActions = availableActions;
        this.importing = true;
        return;
      }
      case "production1":
      case "production2": {
        Array.from(this.board.byNation.get(action.payload.nation))
          .filter(province => this.provinces.get(province).factory !== null)
          .forEach(province => {
            if (this.provinces.get(province).factory === "shipyard") {
              this.units.get(action.payload.nation).get(province).fleets++;
            } else {
              this.units.get(action.payload.nation).get(province).armies++;
            }
          });
        if (action.payload.slot === "production2") {
          const potentialPreInvestorSlots = [
            "maneuver1",
            "production1",
            "factory",
            "taxation"
          ];
          if (
            potentialPreInvestorSlots.includes(
              this.nations.get(this.currentNation).previousRondelPosition
            )
          ) {
            this.endOfInvestorTurn();
            return;
          }
        }
        this.handleAdvancePlayer();
        this.availableActions = new Set(this.rondelActions(this.currentNation));

        return;
      }
      case "taxation": {
        const nationName = action.payload.nation;
        const nation = this.nations.get(nationName);
        // 1. Tax revenue / success bonus
        let taxes =
          this.unoccupiedFactoryCount(nationName) * 2 +
          this.flagCount(nationName);
        // Taxes cannot exceed 20m
        if (taxes > 20) taxes = 20;
        let excessTaxes = taxes - nation.taxChartPosition;
        // Players can never lose money here and
        // nations cannot descend in taxChartPosition
        if (excessTaxes < 0) {
          excessTaxes = 0;
        }
        // Player receives full excess taxes
        this.players[this.currentPlayerName].cash += excessTaxes;
        // Nation's taxChartPosition increases to match taxes
        nation.taxChartPosition += excessTaxes;
        // The tax chart maxes out at 15
        if (nation.taxChartPosition > 15) nation.taxChartPosition = 15;
        // 2. Collecting money
        let payment = taxes - this.unitCount(nationName);
        // Nations cannot be paid less than 0m
        if (payment < 0) payment = 0;
        nation.treasury += payment;
        // 3. Adding power points
        let powerPoints = taxes - 5;
        if (powerPoints < 0) powerPoints = 0;
        nation.powerPoints += powerPoints;
        if (nation.powerPoints + taxes >= 25) {
          nation.powerPoints = 25;
          this.tick(Action.endGame());
          return;
        }

        this.availableActions = new Set(
          this.rondelActions(this.nextNation(this.currentNation))
        );
        const potentialPreInvestorSlots = ["maneuver1", "production1"];
        if (
          potentialPreInvestorSlots.includes(
            this.nations.get(this.currentNation).previousRondelPosition
          )
        ) {
          this.endOfInvestorTurn();
        }
        this.handleAdvancePlayer();
        return;
      }
      case "maneuver1":
      case "maneuver2": {
        this.maneuvering = true;
        this.beginManeuver(action);
        return;
      }
      case "factory": {
        // If nation cannot afford to build a factory
        if (this.nations.get(this.currentNation).treasury < 5) {
          this.handleAdvancePlayer();
          return;
        }

        this.availableActions = new Set();
        for (const province of this.board.byNation.get(action.payload.nation)) {
          if (!this.provinces.get(province).factory) {
            let occupied = false;
            for (const [nation] of this.nations) {
              if (this.units.get(nation).get(province).armies > 0)
                occupied = true;
            }
            if (occupied === false)
              this.availableActions.add(Action.buildFactory({ province }));
          }
        }
        this.buildingFactory = true;

        return;
      }
    }
  }

  investor(action) {
    // 1. Nation pays bond-holders interest
    for (const player of Object.keys(this.players)) {
      if (player !== this.currentPlayerName) {
        this.playerBondsOfNation(player, action.payload.nation).forEach(
          bond => {
            if (
              this.nations.get(action.payload.nation).treasury >= bond.number
            ) {
              this.nations.get(action.payload.nation).treasury -= bond.number;
            } else {
              this.players[this.currentPlayerName].cash -= bond.number;
            }
            this.players[player].cash += bond.number;
          }
        );
      }
    }
    // Nation pays its controller interest
    const amountOwedToController = [
      ...this.players[this.currentPlayerName].bonds
    ]
      .filter(bond => bond.nation === action.payload.nation)
      .reduce((x, y) => x + y.number, 0);
    if (
      this.nations.get(action.payload.nation).treasury > amountOwedToController
    ) {
      this.players[this.currentPlayerName].cash += amountOwedToController;
      this.nations.get(
        action.payload.nation
      ).treasury -= amountOwedToController;
    }
    this.investorCardActive = true;
    this.endOfInvestorTurn();
  }

  beginManeuver(action) {
    const destinations = new Set([Action.endManeuver()]);
    this.unitsToMove = [];

    // Collect all units that are allowed to move on this turn
    for (const [province, units] of this.units.get(action.payload.nation)) {
      let fleetCount = units.fleets;
      let armyCount = units.armies;
      while (fleetCount > 0 || armyCount > 0) {
        if (fleetCount > 0) {
          this.unitsToMove.push([province, "fleet"]);
          fleetCount--;
        } else if (armyCount > 0) {
          this.unitsToMove.push([province, "army"]);
          armyCount--;
        }
      }
    }

    const provincesWithFleets = new Map();
    const provincesWithArmies = new Map();

    for (const [province, units] of this.units.get(action.payload.nation)) {
      if (units.fleets > 0) {
        provincesWithFleets.set(province, units.fleets);
      }
    }

    for (const [origin] of provincesWithFleets) {
      for (const destination of this.board.neighborsFor({
        origin,
        nation: action.payload.nation,
        isFleet: true,
        friendlyFleets: new Set()
      })) {
        destinations.add(
          Action.maneuver({
            origin,
            destination
          })
        );
      }
    }

    for (const [province, units] of this.units.get(action.payload.nation)) {
      if (units.armies > 0) {
        provincesWithArmies.set(province, units.armies);
      }
    }

    for (const [origin] of provincesWithArmies) {
      for (const destination of this.board.neighborsFor({
        origin,
        nation: action.payload.nation,
        isFleet: false,
        friendlyFleets: new Set()
      })) {
        destinations.add(
          Action.maneuver({
            origin,
            destination
          })
        );
      }
    }

    this.availableActions = destinations;
  }

  flagCount(nation) {
    let count = 0;
    for (const [, { flag }] of this.provinces) {
      if (flag === nation) {
        count++;
      }
    }
    return count;
  }

  endOfInvestorTurn() {
    // 2. Investor card holder gets 2m cash
    this.players[this.investorCardHolder].cash += 2;
    // Investor card holder may buy a bond belonging to the nation
    this.availableActions = new Set(
      [...this.availableBonds]
        .filter(bond => {
          const player = this.investorCardHolder;
          const exchangeableBondCosts = [...this.players[player].bonds]
            .filter(exchangeableBond => {
              return exchangeableBond.nation === bond.nation;
            })
            .map(x => x.cost);
          const topBondCost = Math.max(exchangeableBondCosts) || 0;
          return bond.cost <= this.players[player].cash + topBondCost;
        })
        .map(bond => {
          return Action.bondPurchase({
            nation: bond.nation,
            player: this.investorCardHolder,
            cost: bond.cost
          });
        })
    );
    // TODO: 3. Investing without a flag
  }

  playerBondsOfNation(player, nation) {
    const out = [];
    for (const bond of this.players[player].bonds) {
      if (bond.nation === nation) {
        out.push(bond);
      }
    }
    return out;
  }

  handleAdvancePlayer() {
    this.currentNation = this.nextNation(this.currentNation);
    this.currentPlayerName = this.nations.get(this.currentNation).controller;
  }

  totalInvestmentInNation(player, nation) {
    return [...this.players[player].bonds]
      .filter(bond => bond.nation === nation)
      .reduce((x, y) => x + y.cost, 0);
  }

  advanceInvestorCard() {
    if (this.investorCardHolder) {
      const index = this.order.indexOf(this.investorCardHolder);
      if (index === 0) {
        this.investorCardHolder = this.order[this.order.length - 1];
      } else {
        this.investorCardHolder = this.order[index - 1];
      }
    }
  }

  unitCount(nation) {
    let out = 0;
    for (const [, units] of this.units.get(nation)) {
      out += units.armies;
      out += units.fleets;
    }
    return out;
  }

  rondelActions(nation) {
    const rondelPositions = [
      "factory",
      "production1",
      "maneuver1",
      "investor",
      "import",
      "production2",
      "maneuver2",
      "taxation"
    ];
    const currentPosition = this.nations.get(nation).rondelPosition;
    const out = new Set();
    if (currentPosition) {
      const currentIndex = rondelPositions.indexOf(currentPosition);
      const distance = currentIndex - 8;
      [
        rondelPositions[currentIndex + 1] || rondelPositions[distance + 1],
        rondelPositions[currentIndex + 2] || rondelPositions[distance + 2],
        rondelPositions[currentIndex + 3] || rondelPositions[distance + 3]
      ].forEach(slot => {
        out.add(Action.rondel({ nation, cost: 0, slot }));
      });
      out.add(
        Action.rondel({
          nation,
          cost: 2,
          slot:
            rondelPositions[currentIndex + 4] || rondelPositions[distance + 4]
        })
      );
      out.add(
        Action.rondel({
          nation,
          cost: 4,
          slot:
            rondelPositions[currentIndex + 5] || rondelPositions[distance + 5]
        })
      );
      out.add(
        Action.rondel({
          nation,
          cost: 6,
          slot:
            rondelPositions[currentIndex + 6] || rondelPositions[distance + 6]
        })
      );
    } else {
      rondelPositions.forEach(slot => {
        out.add(Action.rondel({ nation, cost: 0, slot }));
      });
    }
    // Remove rondel positions that the player cannot afford.
    const cash = this.players[this.currentPlayerName].cash;
    for (const position of out) {
      if (position.payload.cost > cash) {
        out.delete(position);
      }
    }
    return out;
  }

  nextNation(lastTurnNation) {
    const nextNation = lastTurnNation.when({
      AH: () => Nation.IT,
      IT: () => Nation.FR,
      FR: () => Nation.GB,
      GB: () => Nation.GE,
      GE: () => Nation.RU,
      RU: () => Nation.AH
    });
    if (this.nations.get(nextNation).controller) {
      return nextNation;
    } else {
      return this.nextNation(nextNation);
    }
  }

  importAction(nation) {
    const out = new Set();
    for (const province of this.board.byNation.get(nation)) {
      if (this.board.graph.get(province).factoryType === "shipyard") {
        out.add(Action.import({ placements: [{ province, unit: "fleet" }] }));
      }
      out.add(Action.import({ placements: [{ province, unit: "army" }] }));
    }
    return out;
  }

  unoccupiedFactoryCount(nation) {
    let count = 0;
    for (const province of this.board.byNation.get(nation)) {
      let provinceIsUnoccupied = true;
      for (const [occupyingNation] of this.units) {
        if (occupyingNation !== nation) {
          if (this.units.get(occupyingNation).get(province).armies > 0) {
            provinceIsUnoccupied = false;
          }
        }
      }
      if (this.provinces.get(province).factory && provinceIsUnoccupied) {
        count++;
      }
    }
    return count;
  }

  isEqual(action1, action2) {
    if (action1.type !== action2.type) return false;
    
    if (action1.payload && action2.payload) {
      if (action1.type === "import" && action2.type === "import") {
        return this.arraysAreEqual(action1.payload.placements, action2.payload.placements);
      }

      return Object.keys(action1.payload).every(key => {
        return action1.payload[key] === action2.payload[key]
      });
    } else {
      return true;
    }
  }

  arraysAreEqual(array1, array2) {
    if (array1.length !== array2.length) return false;

    for (let i=0; i < array1.length; i++) {
      const allAttributesMatch = Object.keys(array1[i]).every(key => {
        return array1[i][key] === array2[i][key]
      });
      if (!allAttributesMatch) return false;
    }

    return true;
  }
}