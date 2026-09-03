import { createRng } from "./rng";

export type CombatSide = "heroes" | "enemies";
export type CombatDistance = "close" | "reach" | "far";
export type CombatStance = "balanced" | "aggressive" | "guarded" | "evasive";
export type CombatForce = "nonlethal" | "lethal";
export type CombatantStatus = "active" | "subdued" | "dead" | "fled";
export type CombatActionKind = "attack" | "guard" | "dodge" | "steady" | "advance" | "withdraw";
export type CombatOutcomeKind = "victory" | "defeat" | "withdrawal" | "forced_retreat";

export interface CombatantSetup {
  id: string;
  name: string;
  power?: number;
  maxStamina?: number;
  maxComposure?: number;
  maxWounds?: number;
  stance?: CombatStance;
}

export interface CombatantState {
  id: string;
  name: string;
  side: CombatSide;
  power: number;
  maxStamina: number;
  stamina: number;
  maxComposure: number;
  composure: number;
  maxWounds: number;
  wounds: number;
  stance: CombatStance;
  status: CombatantStatus;
  /** Round-scoped defence flags. They are reset at the start of every round. */
  guarding: boolean;
  dodging: boolean;
}

export interface CombatRules {
  heroForce: CombatForce;
  enemyForce: CombatForce;
  maxRounds: number;
}

export interface CombatEncounterOptions {
  seed: number;
  heroes: readonly [CombatantSetup, CombatantSetup];
  enemies: readonly CombatantSetup[];
  distance?: CombatDistance;
  heroForce?: CombatForce;
  enemyForce?: CombatForce;
  maxRounds?: number;
}

export interface CombatIntent {
  actorId: string;
  action: CombatActionKind;
  targetId?: string;
  force?: CombatForce;
}

export interface CombatDelta {
  combatantId: string;
  stamina?: number;
  composure?: number;
  wounds?: number;
  stance?: CombatStance;
  guarding?: boolean;
  dodging?: boolean;
  status?: CombatantStatus;
}

export type CombatLogKind = "round" | "action" | "distance" | "hit" | "miss" | "defeat" | "outcome";

export interface CombatLogEntry {
  id: string;
  round: number;
  kind: CombatLogKind;
  text: string;
  actorId?: string;
  targetId?: string;
  action?: CombatActionKind;
  force?: CombatForce;
  result?: "success" | "failure" | "critical" | "blocked";
  roll?: number;
  chance?: number;
  distanceChange?: { from: CombatDistance; to: CombatDistance };
  changes?: CombatDelta[];
}

export type CombatConsequenceKind =
  | "wound"
  | "death"
  | "subdued"
  | "captured"
  | "forced_retreat"
  | "escaped";

export interface CombatConsequence {
  kind: CombatConsequenceKind;
  text: string;
  subjectId?: string;
  side?: CombatSide;
  severity?: number;
}

export interface CombatOutcome {
  kind: CombatOutcomeKind;
  /** A lost fight changes the journey; it never ends the game. */
  gameOver: false;
  nextMode: "journey";
  continuation: "aftermath" | "captivity" | "road";
  summary: string;
  consequences: CombatConsequence[];
}

export interface CombatState {
  mode: "combat";
  phase: "active" | "resolved";
  seed: number;
  rngDraws: number;
  round: number;
  distance: CombatDistance;
  heroes: [CombatantState, CombatantState];
  enemies: CombatantState[];
  rules: CombatRules;
  log: CombatLogEntry[];
  outcome: CombatOutcome | null;
}

export interface CombatRoundResolution {
  state: CombatState;
  /** Only the entries produced by this round; the full journal is in state.log. */
  entries: CombatLogEntry[];
  outcome: CombatOutcome | null;
}

interface QueuedIntent extends CombatIntent {
  side: CombatSide;
}

interface EncounterRng {
  draw: () => number;
  draws: () => number;
}

const DISTANCES: CombatDistance[] = ["close", "reach", "far"];

function assertIntegerInRange(value: number, min: number, max: number, label: string): void {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${label} must be an integer from ${min} to ${max}`);
  }
}

function makeCombatant(setup: CombatantSetup, side: CombatSide): CombatantState {
  const power = setup.power ?? (side === "heroes" ? 3 : 2);
  const maxStamina = setup.maxStamina ?? (side === "heroes" ? 7 : 5);
  const maxComposure = setup.maxComposure ?? (side === "heroes" ? 5 : 4);
  const maxWounds = setup.maxWounds ?? (side === "heroes" ? 3 : 2);

  if (!setup.id.trim()) throw new Error("combatant id must not be empty");
  if (!setup.name.trim()) throw new Error(`combatant ${setup.id} must have a name`);
  assertIntegerInRange(power, 1, 5, `${setup.id}.power`);
  assertIntegerInRange(maxStamina, 3, 12, `${setup.id}.maxStamina`);
  assertIntegerInRange(maxComposure, 2, 10, `${setup.id}.maxComposure`);
  assertIntegerInRange(maxWounds, 1, 5, `${setup.id}.maxWounds`);

  return {
    id: setup.id,
    name: setup.name,
    side,
    power,
    maxStamina,
    stamina: maxStamina,
    maxComposure,
    composure: maxComposure,
    maxWounds,
    wounds: 0,
    stance: setup.stance ?? "balanced",
    status: "active",
    guarding: false,
    dodging: false,
  };
}

function cloneCombatant(combatant: CombatantState): CombatantState {
  return { ...combatant };
}

function cloneState(state: CombatState): CombatState {
  return {
    ...state,
    heroes: [cloneCombatant(state.heroes[0]), cloneCombatant(state.heroes[1])],
    enemies: state.enemies.map(cloneCombatant),
    rules: { ...state.rules },
    log: [...state.log],
    outcome: state.outcome
      ? { ...state.outcome, consequences: state.outcome.consequences.map((item) => ({ ...item })) }
      : null,
  };
}

function createEncounterRng(seed: number, priorDraws: number): EncounterRng {
  const rng = createRng(seed);
  for (let i = 0; i < priorDraws; i += 1) rng();
  let draws = priorDraws;
  return {
    draw: () => {
      draws += 1;
      return rng();
    },
    draws: () => draws,
  };
}

function active(combatants: readonly CombatantState[]): CombatantState[] {
  return combatants.filter((combatant) => combatant.status === "active");
}

function allCombatants(state: CombatState): CombatantState[] {
  return [...state.heroes, ...state.enemies];
}

function findCombatant(state: CombatState, id: string): CombatantState | undefined {
  return allCombatants(state).find((combatant) => combatant.id === id);
}

function opposingActive(state: CombatState, side: CombatSide): CombatantState[] {
  return active(side === "heroes" ? state.enemies : state.heroes);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function changeResource(current: number, delta: number, maximum: number): { value: number; delta: number } {
  const value = clamp(current + delta, 0, maximum);
  return { value, delta: value - current };
}

export function createCombatEncounter(options: CombatEncounterOptions): CombatState {
  if (!Array.isArray(options.heroes) || options.heroes.length !== 2) {
    throw new Error("combat requires exactly two heroes");
  }
  if (!Array.isArray(options.enemies) || options.enemies.length < 1 || options.enemies.length > 3) {
    throw new Error("combat requires from one to three enemies");
  }
  if (!Number.isFinite(options.seed)) throw new Error("combat seed must be finite");

  const maxRounds = options.maxRounds ?? 8;
  assertIntegerInRange(maxRounds, 1, 12, "maxRounds");

  const ids = [...options.heroes, ...options.enemies].map((combatant) => combatant.id);
  if (new Set(ids).size !== ids.length) throw new Error("combatant ids must be unique");

  return {
    mode: "combat",
    phase: "active",
    seed: options.seed,
    rngDraws: 0,
    round: 0,
    distance: options.distance ?? "reach",
    heroes: [makeCombatant(options.heroes[0], "heroes"), makeCombatant(options.heroes[1], "heroes")],
    enemies: options.enemies.map((enemy) => makeCombatant(enemy, "enemies")),
    rules: {
      heroForce: options.heroForce ?? "nonlethal",
      enemyForce: options.enemyForce ?? "nonlethal",
      maxRounds,
    },
    log: [],
    outcome: null,
  };
}

function chooseEnemyIntents(state: CombatState, rng: EncounterRng): QueuedIntent[] {
  return active(state.enemies).map<QueuedIntent>((enemy) => {
    const tactic = rng.draw();
    let action: CombatActionKind;
    if (state.distance === "far") action = "advance";
    else if (enemy.stamina <= 1) action = "steady";
    else if (enemy.composure <= Math.ceil(enemy.maxComposure / 3) && tactic < 0.65) action = "guard";
    else if (tactic < 0.62) action = "attack";
    else if (tactic < 0.79) action = "guard";
    else if (tactic < 0.91) action = "dodge";
    else action = "steady";

    if (action !== "attack") return { actorId: enemy.id, action, side: "enemies" };
    const targets = active(state.heroes);
    const target = targets[Math.floor(rng.draw() * targets.length)] ?? targets[0];
    return {
      actorId: enemy.id,
      action,
      targetId: target?.id,
      force: state.rules.enemyForce,
      side: "enemies",
    };
  });
}

function normalizeHeroIntents(state: CombatState, intents: readonly CombatIntent[]): QueuedIntent[] {
  const seen = new Set<string>();
  for (const intent of intents) {
    if (seen.has(intent.actorId)) throw new Error(`duplicate combat intent for ${intent.actorId}`);
    seen.add(intent.actorId);
    const actor = findCombatant(state, intent.actorId);
    if (!actor || actor.side !== "heroes") throw new Error(`unknown hero ${intent.actorId}`);
    if (actor.status !== "active") throw new Error(`${intent.actorId} cannot act while ${actor.status}`);
  }

  return active(state.heroes).map<QueuedIntent>((hero) => {
    const supplied = intents.find((intent) => intent.actorId === hero.id);
    const intent: CombatIntent = supplied ?? { actorId: hero.id, action: "guard" };
    if (intent.action === "attack" && intent.targetId) {
      const target = findCombatant(state, intent.targetId);
      if (!target || target.side !== "enemies" || target.status !== "active") {
        throw new Error(`invalid attack target ${intent.targetId}`);
      }
    }
    return {
      ...intent,
      targetId: intent.action === "attack" ? intent.targetId ?? active(state.enemies)[0]?.id : undefined,
      force: intent.action === "attack" ? intent.force ?? state.rules.heroForce : undefined,
      side: "heroes",
    };
  });
}

function outcomeSummary(kind: CombatOutcomeKind): string {
  if (kind === "victory") return "Противники больше не могут продолжать бой.";
  if (kind === "defeat") return "Герои проиграли схватку, но их путь продолжается из плена.";
  if (kind === "withdrawal") return "Герои разорвали дистанцию и вернулись к дороге.";
  return "Схватка затянулась; героям пришлось отступить и продолжить путь с последствиями.";
}

function buildOutcome(kind: CombatOutcomeKind, state: CombatState): CombatOutcome {
  const consequences: CombatConsequence[] = [];
  for (const combatant of allCombatants(state)) {
    if (combatant.status === "dead") {
      consequences.push({
        kind: "death",
        subjectId: combatant.id,
        side: combatant.side,
        text: `${combatant.name} погибает.`,
      });
    } else if (combatant.status === "subdued") {
      consequences.push({
        kind: "subdued",
        subjectId: combatant.id,
        side: combatant.side,
        text: `${combatant.name} больше не может сопротивляться.`,
      });
    } else if (combatant.wounds > 0) {
      consequences.push({
        kind: "wound",
        subjectId: combatant.id,
        side: combatant.side,
        severity: combatant.wounds,
        text: `${combatant.name} уносит из боя ранение (${combatant.wounds}).`,
      });
    }
  }

  if (kind === "defeat") {
    consequences.push({ kind: "captured", side: "heroes", text: "Выжившие приходят в себя в плену." });
  } else if (kind === "forced_retreat") {
    consequences.push({
      kind: "forced_retreat",
      side: "heroes",
      text: "Герои теряют время и безопасную часть маршрута, отступая к дороге.",
    });
  } else if (kind === "withdrawal") {
    consequences.push({ kind: "escaped", side: "heroes", text: "Героям удалось уйти без погони." });
  }

  return {
    kind,
    gameOver: false,
    nextMode: "journey",
    continuation: kind === "victory" ? "aftermath" : kind === "defeat" ? "captivity" : "road",
    summary: outcomeSummary(kind),
    consequences,
  };
}

function setOutcome(
  state: CombatState,
  entries: CombatLogEntry[],
  addEntry: (entry: Omit<CombatLogEntry, "id" | "round">) => void,
  kind: CombatOutcomeKind,
): void {
  state.phase = "resolved";
  state.outcome = buildOutcome(kind, state);
  addEntry({ kind: "outcome", text: state.outcome.summary });
  state.log.push(...entries);
}

function spendStamina(combatant: CombatantState, amount: number): number {
  const spent = Math.min(amount, combatant.stamina);
  combatant.stamina -= spent;
  return spent;
}

function setDistance(state: CombatState, direction: -1 | 1): CombatDistance {
  const current = DISTANCES.indexOf(state.distance);
  state.distance = DISTANCES[clamp(current + direction, 0, DISTANCES.length - 1)];
  return state.distance;
}

function attackChance(attacker: CombatantState, target: CombatantState, distance: CombatDistance, shortage: number): number {
  let chance = 0.54 + (attacker.power - target.power) * 0.07;
  chance += (attacker.composure / attacker.maxComposure - 0.5) * 0.16;
  chance -= attacker.wounds * 0.04 + shortage * 0.12;
  if (distance === "reach") chance -= 0.07;
  if (attacker.stance === "aggressive") chance += 0.1;
  if (target.stance === "aggressive") chance += 0.06;
  if (target.stance === "guarded") chance -= 0.1;
  if (target.stance === "evasive") chance -= 0.08;
  if (target.guarding) chance -= 0.16;
  if (target.dodging) chance -= 0.24;
  return clamp(chance, 0.08, 0.92);
}

/**
 * Resolves one short, deterministic combat round. Missing active-hero intents
 * become guard actions, which makes the function safe to drive from a UI.
 */
export function resolveCombatRound(state: CombatState, heroIntents: readonly CombatIntent[]): CombatRoundResolution {
  if (state.phase !== "active") throw new Error("combat is already resolved");

  const next = cloneState(state);
  next.round += 1;
  const resetChanges: CombatDelta[] = [];
  for (const combatant of allCombatants(next)) {
    if (combatant.guarding || combatant.dodging) {
      resetChanges.push({ combatantId: combatant.id, guarding: false, dodging: false });
    }
    combatant.guarding = false;
    combatant.dodging = false;
  }

  const entries: CombatLogEntry[] = [];
  const addEntry = (entry: Omit<CombatLogEntry, "id" | "round">): void => {
    entries.push({
      ...entry,
      id: `combat-${next.seed}-${next.round}-${next.log.length + entries.length + 1}`,
      round: next.round,
    });
  };
  addEntry({
    kind: "round",
    text: `Раунд ${next.round}. Дистанция: ${next.distance}.`,
    changes: resetChanges.length > 0 ? resetChanges : undefined,
  });

  const rng = createEncounterRng(next.seed, next.rngDraws);
  const heroes = normalizeHeroIntents(next, heroIntents);

  // With room already made, a coordinated withdrawal always returns to the
  // journey. It is a tactical cost, not a game-over branch.
  const canBreakAway =
    state.distance === "far" &&
    heroes.length > 0 &&
    heroes.every((intent) => intent.action === "withdraw" && (findCombatant(next, intent.actorId)?.stamina ?? 0) >= 1);
  if (canBreakAway) {
    for (const intent of heroes) {
      const actor = findCombatant(next, intent.actorId)!;
      const spent = spendStamina(actor, 1);
      actor.stance = "evasive";
      actor.status = "fled";
      addEntry({
        kind: "action",
        actorId: actor.id,
        action: "withdraw",
        result: "success",
        text: `${actor.name} выходит из боя.`,
        changes: [{ combatantId: actor.id, stamina: -spent, stance: "evasive", status: "fled" }],
      });
    }
    next.rngDraws = rng.draws();
    setOutcome(next, entries, addEntry, "withdrawal");
    return { state: next, entries, outcome: next.outcome };
  }

  const enemies = chooseEnemyIntents(next, rng);
  const intents: QueuedIntent[] = [...heroes, ...enemies];
  let movementScore = 0;

  for (const intent of intents.filter((item) => item.action !== "attack")) {
    const actor = findCombatant(next, intent.actorId);
    if (!actor || actor.status !== "active") continue;

    if (intent.action === "guard") {
      const canGuard = actor.stamina >= 1;
      const spent = spendStamina(actor, 1);
      const restored = changeResource(actor.composure, canGuard ? 1 : 0, actor.maxComposure);
      if (canGuard) {
        actor.composure = restored.value;
        actor.stance = "guarded";
        actor.guarding = true;
      }
      addEntry({
        kind: "action",
        actorId: actor.id,
        action: intent.action,
        result: canGuard ? "success" : "failure",
        text: canGuard ? `${actor.name} укрепляет защиту.` : `${actor.name} слишком измотан, чтобы держать защиту.`,
        changes: canGuard
          ? [{ combatantId: actor.id, stamina: -spent, composure: restored.delta, stance: "guarded", guarding: true }]
          : undefined,
      });
    } else if (intent.action === "dodge") {
      const spent = spendStamina(actor, 2);
      const canDodge = spent === 2;
      if (canDodge) {
        actor.stance = "evasive";
        actor.dodging = true;
      }
      addEntry({
        kind: "action",
        actorId: actor.id,
        action: intent.action,
        result: canDodge ? "success" : "failure",
        text: canDodge ? `${actor.name} готовится уйти с линии удара.` : `${actor.name} слишком измотан для уклонения.`,
        changes: spent
          ? [{ combatantId: actor.id, stamina: -spent, ...(canDodge ? { stance: "evasive" as const, dodging: true } : {}) }]
          : undefined,
      });
    } else if (intent.action === "steady") {
      const stamina = changeResource(actor.stamina, 3, actor.maxStamina);
      const composure = changeResource(actor.composure, 2, actor.maxComposure);
      actor.stamina = stamina.value;
      actor.composure = composure.value;
      actor.stance = "balanced";
      addEntry({
        kind: "action",
        actorId: actor.id,
        action: intent.action,
        result: "success",
        text: `${actor.name} переводит дыхание и возвращает самообладание.`,
        changes: [{ combatantId: actor.id, stamina: stamina.delta, composure: composure.delta, stance: "balanced" }],
      });
    } else {
      const canMove = actor.stamina >= 1;
      const spent = spendStamina(actor, 1);
      const stance = intent.action === "advance" ? "aggressive" : "evasive";
      if (canMove) {
        actor.stance = stance;
        movementScore += intent.action === "advance" ? -1 : 1;
      }
      addEntry({
        kind: "action",
        actorId: actor.id,
        action: intent.action,
        result: canMove ? "success" : "failure",
        text: canMove
          ? intent.action === "advance"
            ? `${actor.name} сокращает дистанцию.`
            : `${actor.name} отходит, сохраняя строй.`
          : `${actor.name} слишком измотан, чтобы изменить дистанцию.`,
        changes: canMove ? [{ combatantId: actor.id, stamina: -spent, stance }] : undefined,
      });
    }
  }

  if (movementScore !== 0) {
    const from = next.distance;
    const to = setDistance(next, movementScore < 0 ? -1 : 1);
    if (to !== from) {
      addEntry({
        kind: "distance",
        result: "success",
        text: `Дистанция меняется: ${from} → ${to}.`,
        distanceChange: { from, to },
      });
    }
  }

  const attacks = intents
    .filter((intent) => intent.action === "attack")
    .map((intent) => {
      const actor = findCombatant(next, intent.actorId)!;
      return { intent, initiative: rng.draw() + actor.power * 0.03 + actor.stamina * 0.005 };
    })
    .sort((a, b) => b.initiative - a.initiative);

  for (const queued of attacks) {
    const intent = queued.intent;
    const attacker = findCombatant(next, intent.actorId);
    if (!attacker || attacker.status !== "active") continue;
    attacker.stance = "aggressive";

    let target = intent.targetId ? findCombatant(next, intent.targetId) : undefined;
    if (!target || target.status !== "active" || target.side === attacker.side) {
      target = opposingActive(next, attacker.side)[0];
    }
    if (!target) continue;

    if (next.distance === "far") {
      const spent = spendStamina(attacker, 1);
      addEntry({
        kind: "miss",
        actorId: attacker.id,
        targetId: target.id,
        action: "attack",
        force: intent.force,
        result: "failure",
        text: `${attacker.name} не достаёт ${target.name}: дистанция слишком велика.`,
        changes: [{ combatantId: attacker.id, stamina: -spent, stance: "aggressive" }],
      });
      continue;
    }

    const spent = spendStamina(attacker, 2);
    const shortage = 2 - spent;
    const chance = attackChance(attacker, target, next.distance, shortage);
    const roll = rng.draw();
    if (roll >= chance) {
      addEntry({
        kind: "miss",
        actorId: attacker.id,
        targetId: target.id,
        action: "attack",
        force: intent.force,
        result: "failure",
        roll,
        chance,
        text: target.dodging ? `${target.name} уходит от удара ${attacker.name}.` : `${attacker.name} промахивается по ${target.name}.`,
        changes: [{ combatantId: attacker.id, stamina: -spent, stance: "aggressive" }],
      });
      continue;
    }

    const critical = roll < chance * 0.16;
    const rawWounds = critical ? 2 : 1;
    const woundDelta = Math.min(target.maxWounds - target.wounds, Math.max(0, rawWounds - (target.guarding ? 1 : 0)));
    const staminaHit = changeResource(target.stamina, -(critical ? 2 : 1) + (target.guarding ? 1 : 0), target.maxStamina);
    const composureHit = changeResource(target.composure, -(critical ? 2 : 1), target.maxComposure);
    target.wounds += woundDelta;
    target.stamina = staminaHit.value;
    target.composure = composureHit.value;

    const changes: CombatDelta[] = [{ combatantId: attacker.id, stamina: -spent, stance: "aggressive" }];
    changes.push({
      combatantId: target.id,
      wounds: woundDelta,
      stamina: staminaHit.delta,
      composure: composureHit.delta,
    });
    addEntry({
      kind: "hit",
      actorId: attacker.id,
      targetId: target.id,
      action: "attack",
      force: intent.force,
      result: woundDelta === 0 ? "blocked" : critical ? "critical" : "success",
      roll,
      chance,
      text:
        woundDelta === 0
          ? `${target.name} принимает удар ${attacker.name} на защиту.`
          : critical
            ? `${attacker.name} наносит ${target.name} тяжёлый удар.`
            : `${attacker.name} ранит ${target.name}.`,
      changes,
    });

    if (target.wounds >= target.maxWounds || target.composure <= 0) {
      const force = intent.force ?? (attacker.side === "heroes" ? next.rules.heroForce : next.rules.enemyForce);
      const fatalWound = force === "lethal" && target.wounds >= target.maxWounds;
      const otherStandingHero = target.side === "heroes" && active(next.heroes).some((hero) => hero.id !== target.id);
      target.status = fatalWound && (target.side === "enemies" || otherStandingHero) ? "dead" : "subdued";
      addEntry({
        kind: "defeat",
        actorId: attacker.id,
        targetId: target.id,
        action: "attack",
        force,
        result: "success",
        text: target.status === "dead" ? `${target.name} погибает.` : `${target.name} больше не может сражаться.`,
        changes: [{ combatantId: target.id, status: target.status }],
      });
    }
  }

  next.rngDraws = rng.draws();
  if (active(next.enemies).length === 0) setOutcome(next, entries, addEntry, "victory");
  else if (active(next.heroes).length === 0) setOutcome(next, entries, addEntry, "defeat");
  else if (next.round >= next.rules.maxRounds) setOutcome(next, entries, addEntry, "forced_retreat");
  else next.log.push(...entries);

  return { state: next, entries, outcome: next.outcome };
}

/** A small default strategy for prototypes, previews, and deterministic tests. */
export function autoResolveCombat(options: CombatEncounterOptions): CombatState {
  let state = createCombatEncounter(options);
  while (state.phase === "active") {
    const target = active(state.enemies)[0];
    const intents = active(state.heroes).map<CombatIntent>((hero) => {
      if (state.distance === "far") return { actorId: hero.id, action: "advance" };
      if (hero.stamina <= 1) return { actorId: hero.id, action: "steady" };
      return {
        actorId: hero.id,
        action: "attack",
        targetId: target?.id,
        force: state.rules.heroForce,
      };
    });
    state = resolveCombatRound(state, intents).state;
  }
  return state;
}
