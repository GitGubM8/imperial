import { AllBonds2030, Bond, Nation2030 } from "./constants.js";

const error = want => x => {
  throw new Error(`got=${x.value}, want=${want}`);
};

export default ({ players, provinceNames }) => {
  const nationAssignments = {
    2: ({ id, nation }) =>
      nation.when({
        RU: () => [
          { id, nation: Nation2030.RU },
          { id, nation: Nation2030.IN },
          { id, nation: Nation2030.US }
        ],
        CN: () => [
          { id, nation: Nation2030.CN },
          { id, nation: Nation2030.BR },
          { id, nation: Nation2030.EU }
        ],
        IN: error("RU|CN"),
        BR: error("RU|CN"),
        US: error("RU|CN"),
        EU: error("RU|CN")
      }),
    3: ({ id, nation }) =>
      nation.when({
        RU: () => [
          { id, nation: Nation2030.RU },
          { id, nation: Nation2030.BR }
        ],
        CN: () => [
          { id, nation: Nation2030.CN },
          { id, nation: Nation2030.EU }
        ],
        IN: () => [
          { id, nation: Nation2030.IN },
          { id, nation: Nation2030.US }
        ],
        BR: error("RU|CN|IN"),
        EU: error("RU|CN|IN"),
        US: error("RU|CN|IN")
      }),
    4: x => [x],
    5: x => [x],
    6: x => [x]
  };

  const out = {
    availableBonds: AllBonds2030(),
    nations: new Map(),
    order: players.map(p => p.id),
    players: {}
  };

  /* From the initial nation assignments, distribute bonds to the players. */
  players
    .map(nationAssignments[players.length])
    .flat()
    .forEach(({ id, nation }) => {
      if (out.players[id] === undefined) {
        out.players[id] = {
          name: id,
          cash: 2,
          bonds: new Set(),
          rawScore: 0
        };
      }

      const smallerBondNation = nation.when({
        US: () => Nation2030.RU,
        IN: () => Nation2030.BR,
        BR: () => Nation2030.CN,
        CN: () => Nation2030.US,
        RU: () => Nation2030.EU,
        EU: () => Nation2030.IN
      });

      out.availableBonds.delete(Bond(nation, 4));
      out.availableBonds.delete(Bond(smallerBondNation, 1));
      out.players[id].bonds.add(Bond(nation, 4));
      out.players[id].bonds.add(Bond(smallerBondNation, 1));
    });

  /* Gather bonds as a list of
   *
   *   { nation : Nation2030 , cost : number , number : number }
   *
   * so we can filter by nation, use the cost in our
   * calculation of each nation's treasury, and set the
   * controlling player.
   */

  const purchasedBonds = new Set();
  Object.keys(out.players).forEach(id => {
    for (const bond of out.players[id].bonds) {
      purchasedBonds.add(bond);
    }
  });

  /* Calculate treasury and controller for each nation */
  for (const n of Nation2030) {
    /* Find bonds for the given nation, sorted by descending cost */
    const forNation = Array.from(purchasedBonds)
      .filter(b => b.nation === n)
      .sort(({ cost: aCost }, { cost: bCost }) =>
        aCost < bCost ? 1 : aCost > bCost ? -1 : 0
      );

    /* The rules describe in prose this decision table
     *
     *   bonds purchased | controller
     *   ----------------|-----------
     *   none            | none
     *   2               | owner of 2
     *   9               | owner of 9
     *   9, 2            | owner of 9
     *
     * So, we'll set the controller to be the owner of
     * the highest cost bond, or null if there are no
     * bonds.
     */

    const highestBond = forNation[0];
    const highestBondOwner =
      Object.keys(out.players).find(id =>
        out.players[id].bonds.has(highestBond)
      ) || null;

    const totalCost = forNation.reduce((sum, { cost }) => sum + cost, 0);

    out.nations.set(n, {
      controller: highestBondOwner,
      treasury: totalCost,
      rondelPosition: null,
      flagCount: 0,
      powerPoints: 0,
      taxChartPosition: 5
    });

    const RUPlayer = out.nations.get(Nation2030.RU).controller;
    const RUPlayerIndex = out.order.indexOf(RUPlayer);
    if (RUPlayerIndex === out.order.length - 1) {
      out.investorCardHolder = out.order[0];
    } else {
      out.investorCardHolder = out.order[RUPlayerIndex + 1];
    }
  }

  const emptyProvinces = () => {
    const provinces = new Map();
    for (const province of provinceNames) {
      provinces.set(province, { armies: 0, fleets: 0, friendly: false });
    }
    return provinces;
  };

  const units = new Map();
  [Nation2030.RU, Nation2030.CN, Nation2030.IN, Nation2030.BR, Nation2030.US, Nation2030.EU].map(
    nation => {
      units.set(nation, emptyProvinces());
    }
  );
  out.units = units;

  const provinces = new Map();
  const armaments = [
    "chicago",
    "brasilia",
    "paris",
    "moscow",
    "beijing",
    "newdelhi"
  ];
  const shipyard = [
    "neworleans",
    "riodejaneiro",
    "london",
    "vladivostok",
    "shanghai",
    "mumbai"
  ];
  for (const province of provinceNames) {
    let factory = null;
    if (armaments.includes(province)) {
      factory = "armaments";
    } else if (shipyard.includes(province)) {
      factory = "shipyard";
    }
    provinces.set(province, { factory });
  }

  const unitLimits = new Map();

  for (const nation of Nation2030) {
    if (nation === Nation2030.CN) {
      unitLimits.set(nation, {armies: 10, fleets: 6});
    } else if (nation === Nation2030.US) {
      unitLimits.set(nation, {armies: 6, fleets: 10});
    } else {
      unitLimits.set(nation, {armies: 8, fleets: 8});
    }
  }

  out.provinces = provinces;
  out.currentNation = Nation2030.RU;
  out.unitLimits = unitLimits;
  return out;
};
