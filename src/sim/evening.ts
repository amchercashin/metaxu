import { setCamp } from "./flags";
import type { ArgumentOfDay, CampKind, GameState } from "./types";

function argumentResidue(arg: ArgumentOfDay | null): string {
  switch (arg) {
    case "node":
      return "Клеон: «Узел ещё не затянут.» Аристон молчит дольше, чем нужно.";
    case "distinction":
      return "Аристон: «Я различил. И всё равно не знаю, кто шёл в воде.»";
    case "haste":
      return "Клеон смеётся коротко. «Завтра различим. Если ноги донесут.»";
    default:
      return "Спор лежит между ними, как камень, который никто не поднимает.";
  }
}

export function composeEvening(state: GameState, camp: CampKind): GameState {
  const lines: string[] = [];
  if (camp === "no_fire") {
    lines.push("Огня нет. Холод камня поднимается в колени. Река слышна ближе, чем лица.");
  } else if (camp === "camp_east_bank") {
    lines.push("Восток. Тот берег принял их. Дым тонкий, пальцы ещё мокрые.");
  } else {
    lines.push("Западный берег. Река впереди, не позади. День не перешёл — он остался.");
  }
  if (state.flags.saved_drowning) lines.push("Спасённый не здесь. Но вес его руки ещё в плече.");
  if (state.flags.ignored_drowning) lines.push("Клеон не смотрит на воду. Аристон смотрит слишком прямо.");
  if (state.flags.scroll_lost) lines.push("За спиной пусто. Фрагменты Демокрита — уже речь реки.");
  if (state.flags.scroll_wet) lines.push("Свиток сушится у камня. Чернила поползли. Одна посылка крива.");
  if (state.flags.scroll_corrupt) lines.push("Память Аристона легла поверх воды. Он сам не уверен, что не выдумал черту.");
  if (state.flags.scroll_given) lines.push("Свитка нет. Закон места сытее их учения.");
  if (state.flags.killed_animal) lines.push("Мяса не кладут в котелок. Клеон ищет красивую фразу и не находит.");
  if (state.flags.pride_of_throw) lines.push("Младший вертит камень. Попадание всё ещё греет ладонь.");
  if (state.flags.debt_ford_keeper) lines.push("Имя, сказанное сборщику, не спит.");
  if (state.flags.spoke_to_silent_man) lines.push("Молчаливый не пришёл к огню. Его жест — как брод, который ещё надо проверить.");
  if (state.flags.left_silent_man) lines.push("Они прошли мимо сидящего. Мир не обижается. Он запоминает спину.");
  if (state.flags.followed_night_tracks) lines.push("След ночи увёл бы дальше. Они взяли его на день — или он взял их.");
  lines.push(argumentResidue(state.argument_of_day));
  lines.push("Спор не закрыт. Ночь не учитель.");
  return {
    ...state,
    phase: "evening",
    currentEventId: null,
    flags: setCamp(state.flags, camp),
    eveningLines: lines,
  };
}

export function campChoices(state: GameState): { id: CampKind; label: string }[] {
  const choices: { id: CampKind; label: string }[] = [];
  if (state.crossedRiver || state.bank === "east") {
    choices.push({ id: "camp_east_bank", label: "Огонь на восточном берегу" });
  }
  choices.push({ id: "camp_west_bank", label: "Вернуться и жечь на западном" });
  choices.push({ id: "no_fire", label: "Без огня. Спать в холоде камня" });
  return choices;
}
