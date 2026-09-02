export type HeroId = "kleon" | "ariston";

export type ArgumentOfDay = "node" | "distinction" | "haste";

export type ScrollKind = "intact" | "wet" | "lost" | "given";

export type CampKind = "camp_east_bank" | "camp_west_bank" | "no_fire";

export type DayPhase = "morning" | "travel" | "event" | "evening";

export type Gesture =
  | "morning_name"
  | "read_water"
  | "rescue"
  | "tracks"
  | "throw"
  | "keeper"
  | "beast"
  | "silence"
  | "wet_fragment";

export interface BodyState {
  satiety: number;
  thirst: number;
  sleep: number;
  fatigue: number;
  cold: number;
  heat: number;
  wound: number;
  illness: number;
  wet: boolean;
}

export interface HeroState {
  id: HeroId;
  /** Spoken name on the road — not a skin. */
  spokenName: string;
  /** Obligation the current name carries. */
  nameDuty: string;
  body: BodyState;
}

export interface FlagBag {
  scroll_intact: boolean;
  scroll_wet: boolean;
  scroll_lost: boolean;
  scroll_given: boolean;
  scroll_corrupt: boolean;
  named_to_stranger: boolean;
  debt_ford_keeper: boolean;
  saved_drowning: boolean;
  ignored_drowning: boolean;
  killed_animal: boolean;
  followed_night_tracks: boolean;
  left_silent_man: boolean;
  spoke_to_silent_man: boolean;
  pride_of_throw: boolean;
  camp_east_bank: boolean;
  camp_west_bank: boolean;
  no_fire: boolean;
  knows_ford: boolean;
  knows_others_crossed: boolean;
}

export type FlagName = keyof FlagBag;

export interface Debt {
  id: string;
  to: string;
  note: string;
}

export interface BodyDelta {
  satiety?: number;
  thirst?: number;
  sleep?: number;
  fatigue?: number;
  cold?: number;
  heat?: number;
  wound?: number;
  illness?: number;
  wet?: boolean;
}

export interface ChoiceEffects {
  flags?: Partial<FlagBag>;
  scroll?: ScrollKind;
  lostFragmentId?: string;
  body?: Partial<Record<HeroId | "both" | "leader", BodyDelta>>;
  debtsAdd?: Debt[];
  recap?: string;
  outcome?: string;
}

export interface EventChoice {
  id: string;
  label: string;
  /** Short in-voice line shown after pick. */
  line: string;
  speaker?: HeroId | "other" | "world";
  effects?: ChoiceEffects;
  bodyCheck?: {
    hero: HeroId | "leader";
    demand: "swim_burden" | "stand_cold" | "strike" | "hold_ground";
    threshold?: number;
    pass: ChoiceEffects;
    fail: ChoiceEffects;
  };
}

export interface EventCard {
  id: string;
  title: string;
  gesture: Gesture;
  biome_tags: string[];
  region_tags?: string[];
  requires: string[];
  forbidden_if: string[];
  primary_bearer: HeroId | "either";
  ribbonOrder: number;
  setup: string[];
  choices: EventChoice[];
}

export interface GameState {
  version: 1;
  seed: number;
  rngDraws: number;
  day: number;
  phase: DayPhase;
  argument_of_day: ArgumentOfDay | null;
  selectedEventIds: string[];
  completedEventIds: string[];
  currentEventId: string | null;
  lastGestures: Gesture[];
  leader: HeroId;
  bank: "west" | "east";
  crossedRiver: boolean;
  scroll: ScrollKind;
  lostFragmentId: string | null;
  flags: FlagBag;
  debts: Debt[];
  heroes: Record<HeroId, HeroState>;
  recapNotes: string[];
  eveningLines: string[];
  biomeTags: string[];
}

export interface SaveSnapshot {
  version: 1;
  savedAt: string;
  state: GameState;
}

export interface SaveAdapter {
  write(slot: string, snapshot: SaveSnapshot): Promise<void>;
  read(slot: string): Promise<SaveSnapshot | null>;
  remove?(slot: string): Promise<void>;
}
