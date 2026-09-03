import { describe, expect, it } from "vitest";
import {
  autoResolveCombat,
  createCombatEncounter,
  resolveCombatRound,
  type CombatEncounterOptions,
} from "./combat";

function encounter(overrides: Partial<CombatEncounterOptions> = {}): CombatEncounterOptions {
  return {
    seed: 41,
    heroes: [
      { id: "kleon", name: "Клеон" },
      { id: "ariston", name: "Аристон" },
    ],
    enemies: [{ id: "raider", name: "Грабитель" }],
    ...overrides,
  };
}

describe("combat encounter", () => {
  it("creates a separate serializable mode for two heroes and one to three enemies", () => {
    const state = createCombatEncounter(
      encounter({
        enemies: [
          { id: "e1", name: "Первый" },
          { id: "e2", name: "Второй" },
          { id: "e3", name: "Третий" },
        ],
      }),
    );

    expect(state.mode).toBe("combat");
    expect(state.phase).toBe("active");
    expect(state.heroes).toHaveLength(2);
    expect(state.enemies).toHaveLength(3);
    expect(state.heroes.every((hero) => hero.stamina > 0 && hero.composure > 0)).toBe(true);
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);

    expect(() =>
      createCombatEncounter(
        encounter({
          heroes: [{ id: "only", name: "Один" }] as unknown as CombatEncounterOptions["heroes"],
        }),
      ),
    ).toThrow(/exactly two heroes/);
    expect(() => createCombatEncounter(encounter({ enemies: [] }))).toThrow(/one to three enemies/);
    expect(() =>
      createCombatEncounter(
        encounter({
          enemies: [
            { id: "e1", name: "1" },
            { id: "e2", name: "2" },
            { id: "e3", name: "3" },
            { id: "e4", name: "4" },
          ],
        }),
      ),
    ).toThrow(/one to three enemies/);
  });

  it("is deterministic by seed without mutating the previous state", () => {
    const options = encounter({
      seed: 938,
      enemies: [
        { id: "e1", name: "Копейщик" },
        { id: "e2", name: "Пращник" },
      ],
    });
    const first = autoResolveCombat(options);
    const repeated = autoResolveCombat(options);
    const otherSeed = autoResolveCombat({ ...options, seed: 939 });

    expect(repeated).toEqual(first);
    expect(otherSeed.log.filter((entry) => entry.roll !== undefined).map((entry) => entry.roll)).not.toEqual(
      first.log.filter((entry) => entry.roll !== undefined).map((entry) => entry.roll),
    );

    const initial = createCombatEncounter(options);
    const snapshot = JSON.parse(JSON.stringify(initial));
    resolveCombatRound(initial, [
      { actorId: "kleon", action: "attack", targetId: "e1" },
      { actorId: "ariston", action: "guard" },
    ]);
    expect(initial).toEqual(snapshot);
  });

  it("models distance, stance, stamina, defence, dodge, and regaining composure", () => {
    const initial = createCombatEncounter(encounter({ seed: 9, distance: "far" }));
    initial.heroes[0].stamina = 3;
    initial.heroes[0].composure = 2;

    const first = resolveCombatRound(initial, [
      { actorId: "kleon", action: "advance" },
      { actorId: "ariston", action: "dodge" },
    ]);

    expect(first.state.distance).toBe("reach");
    expect(first.state.heroes[0].stance).toBe("aggressive");
    expect(first.state.heroes[1].stance).toBe("evasive");
    expect(first.state.heroes[1].stamina).toBeLessThan(first.state.heroes[1].maxStamina);
    expect(first.entries.some((entry) => entry.action === "dodge")).toBe(true);
    expect(first.entries).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: "distance", distanceChange: { from: "far", to: "reach" } })]),
    );

    const recovery = createCombatEncounter(encounter({ seed: 10, distance: "far" }));
    recovery.heroes[0].stamina = 3;
    recovery.heroes[0].composure = 2;
    const second = resolveCombatRound(recovery, [
      { actorId: "kleon", action: "steady" },
      { actorId: "ariston", action: "guard" },
    ]);
    const kleon = second.state.heroes[0];
    const ariston = second.state.heroes[1];

    expect(kleon.stance).toBe("balanced");
    expect(kleon.stamina).toBeGreaterThan(recovery.heroes[0].stamina);
    expect(kleon.composure).toBeGreaterThan(recovery.heroes[0].composure);
    expect(ariston.stance).toBe("guarded");
    expect(ariston.guarding).toBe(true);
    expect(second.entries.some((entry) => entry.action === "steady")).toBe(true);
    expect(second.entries.some((entry) => entry.action === "guard")).toBe(true);

    const enemyChanceAgainst = (action: "steady" | "guard" | "dodge"): number => {
      const state = createCombatEncounter(encounter({ seed: 6, distance: "close" }));
      const update = resolveCombatRound(state, [
        { actorId: "kleon", action },
        { actorId: "ariston", action: "steady" },
      ]);
      return update.entries.find((entry) => entry.actorId === "raider" && entry.action === "attack")?.chance ?? 1;
    };
    const openChance = enemyChanceAgainst("steady");
    expect(enemyChanceAgainst("guard")).toBeLessThan(openChance);
    expect(enemyChanceAgainst("dodge")).toBeLessThan(openChance);

    const exhausted = createCombatEncounter(encounter({ seed: 8, distance: "far" }));
    exhausted.heroes[0].stamina = 1;
    exhausted.heroes[1].stamina = 0;
    const failedMoves = resolveCombatRound(exhausted, [
      { actorId: "kleon", action: "dodge" },
      { actorId: "ariston", action: "withdraw" },
    ]);
    expect(failedMoves.state.heroes[0].dodging).toBe(false);
    expect(failedMoves.state.heroes[1].stance).toBe("balanced");
    expect(failedMoves.entries.filter((entry) => entry.result === "failure").map((entry) => entry.actorId)).toEqual(
      expect.arrayContaining(["kleon", "ariston"]),
    );
  });

  it("records nonlethal and lethal consequences according to the chosen force", () => {
    const common = encounter({
      seed: 5,
      maxRounds: 6,
      heroes: [
        { id: "kleon", name: "Клеон", power: 5 },
        { id: "ariston", name: "Аристон", power: 5 },
      ],
      enemies: [{ id: "raider", name: "Грабитель", power: 1, maxWounds: 1 }],
    });
    const spared = autoResolveCombat({ ...common, heroForce: "nonlethal" });
    const killed = autoResolveCombat({ ...common, heroForce: "lethal" });

    expect(spared.outcome?.kind).toBe("victory");
    expect(spared.enemies[0].status).toBe("subdued");
    expect(spared.outcome?.consequences).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: "subdued", subjectId: "raider" })]),
    );

    expect(killed.outcome?.kind).toBe("victory");
    expect(killed.enemies[0].status).toBe("dead");
    expect(killed.outcome?.consequences).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: "death", subjectId: "raider" })]),
    );
  });

  it("turns withdrawal and defeat into journey continuations, never game over", () => {
    const withdrawn = createCombatEncounter(encounter({ distance: "far" }));
    const escape = resolveCombatRound(withdrawn, [
      { actorId: "kleon", action: "withdraw" },
      { actorId: "ariston", action: "withdraw" },
    ]).state;

    expect(escape.phase).toBe("resolved");
    expect(escape.outcome).toMatchObject({
      kind: "withdrawal",
      gameOver: false,
      nextMode: "journey",
      continuation: "road",
    });

    const failed = autoResolveCombat(
      encounter({
        seed: 1,
        maxRounds: 12,
        heroes: [
          { id: "kleon", name: "Клеон", power: 1, maxWounds: 1, maxStamina: 3, maxComposure: 2 },
          { id: "ariston", name: "Аристон", power: 1, maxWounds: 1, maxStamina: 3, maxComposure: 2 },
        ],
        enemies: [
          { id: "e1", name: "Первый", power: 5, maxWounds: 5, maxStamina: 12, maxComposure: 10 },
          { id: "e2", name: "Второй", power: 5, maxWounds: 5, maxStamina: 12, maxComposure: 10 },
          { id: "e3", name: "Третий", power: 5, maxWounds: 5, maxStamina: 12, maxComposure: 10 },
        ],
        enemyForce: "lethal",
      }),
    );

    expect(failed.outcome).toMatchObject({
      kind: "defeat",
      gameOver: false,
      nextMode: "journey",
      continuation: "captivity",
    });
    expect(failed.outcome?.consequences).toEqual(expect.arrayContaining([expect.objectContaining({ kind: "captured" })]));
  });

  it("returns a structured per-round journal suitable for incremental UI rendering", () => {
    const state = createCombatEncounter(encounter({ seed: 17 }));
    const update = resolveCombatRound(state, [
      { actorId: "kleon", action: "attack", targetId: "raider" },
      { actorId: "ariston", action: "guard" },
    ]);

    expect(update.entries.length).toBeGreaterThan(2);
    expect(update.state.log).toEqual(update.entries);
    expect(new Set(update.entries.map((entry) => entry.id)).size).toBe(update.entries.length);
    expect(update.entries.every((entry) => entry.round === 1 && entry.text.length > 0)).toBe(true);
    expect(update.entries.some((entry) => entry.actorId === "kleon" && entry.action === "attack")).toBe(true);
  });
});
