# Пул событий: один день у реки
Режиссёр выбирает 3 из 8. Утро и вечер фиксированы.

Общие флаги дня:
- `scroll_intact` | `scroll_wet` | `scroll_lost` | `scroll_given`
- `named_to_stranger`
- `debt_ford_keeper`
- `saved_drowning`
- `ignored_drowning`
- `killed_animal`
- `followed_night_tracks`
- `left_silent_man`
- `spoke_to_silent_man`
- `pride_of_throw`
- `camp_east_bank` | `camp_west_bank` | `no_fire`

---

## RIVER_00 — Утро на валунах (фиксировано)

biome_tags: [boulder_dawn, river_approach]  
danger_material: скрытый срыв камня, холод, потеря времени  
body_demand: спуск, внимание к стопе  
thought_on_trial: имя как настройка, а не паспорт  
irreversible_price: выбранный тон спора дня  
later_hook: спор дня окрашивает все три события

primary_bearer: Kleón  
beats:
- Младший идёт первым и говорит об именах.
- Старший режет романтизм, но оставляет мысль.
- Развилка реплики игрока (3 варианта), не свободный ввод:
  1. Усилить образ «человек как узел».
  2. Попросить различение, не формулу.
  3. Свести всё к шутке и идти быстрее.
- Исход задаёт `argument_of_day`: `node` | `distinction` | `haste`

AUTHOR: вписать диалог по камертону исходного текста, без Руси и визитки. Вместо визитки — черепок или камень позже в RIVER_04.

---

## RIVER_01 — Чтение воды

biome_tags: [river, mist]  
forbidden_if: []  
requires: []

danger_material: ложный покой поверхности, снос течением  
body_demand: стоять в холодной воде, смотреть долго, не спешить  
thought_on_trial: ум превращает страх в карту, а не отменяет страх  
irreversible_price: часы дня или ложный вход  
later_hook: если выбран ложный брод, вечером кто-то из двоих хромает / знобит

primary_bearer: either  
actions_available: [watch_current, throw_float, ask_companion, enter_now, search_downstream]

outcomes:
- `true_ford`: меньше риска на переправе, `knows_ford`
- `false_calm`: экономия времени, позже штраф на плавание
- `lost_hours`: безопасно, день короче, вечером голоднее

AUTHOR: никто не должен произносить слово «информация». Говорить: «видишь линию», «врёт блеск», «здесь вода толще».

---

## RIVER_02 — Тонущий

biome_tags: [river]  
requires: []  
forbidden_if: []

danger_material: человек в течении, свиток за спиной, холод  
body_demand: плыть с ношей или бросить ношу  
thought_on_trial: проводник силы или владелец вещи  
irreversible_price: человек / свиток / рана  
later_hook: спасённый может встретиться в порту; потерянный фрагмент исказит спор в городе у камней

primary_bearer: either  
actions_available: [drop_scroll_and_swim, swim_with_scroll, throw_rope, shout_to_other, do_not_enter]

outcomes:
- `saved_drowning` + `scroll_wet`
- `saved_drowning` + `scroll_lost`
- `ignored_drowning` + `scroll_intact` + вечерний стыд/спор
- попытка спасти со свитком: проверка тела; провал = оба мокрые, рана, свиток под угрозой

AUTHOR: Старший может настаивать на свитке и ошибиться. Младший может броситься красиво и чуть не утопить обоих.

---

## RIVER_03 — Следы ночного перехода

biome_tags: [river_bank, sand]  
danger_material: засада или потеря своего брода  
body_demand: читать грунт на корточках, не оставить свой страх сверху следа  
thought_on_trial: вы не центр мира; до вас уже шли  
irreversible_price: маршрут дня  
later_hook: если пойти по следу — встреча с теми людьми позже в регионе, не обязательно сегодня

primary_bearer: Kleón  
actions_available: [follow, parallel, ignore, hide_and_wait]

outcomes:
- `followed_night_tracks`
- `knows_others_crossed`
- засада: короткий контакт, можно уступить / бежать / занять пространство
- игнор: чистое утро, беднее мир

---

## RIVER_04 — Камень и попадание

biome_tags: [boulder_dawn, river_approach]  
morning_compatible: yes

danger_material: почти никакой внешней; опасность тщеславия  
body_demand: бросок телом, не расчётом  
thought_on_trial: кто действовал в удачном броске  
irreversible_price: `pride_of_throw` или отказ назвать источник  
later_hook: в бою или на палубе гордыня броска вернётся как лишнее движение

primary_bearer: Kleón  
actions_available: [let_him_throw, ask_what_he_felt, mock_gently, name_it_god, name_it_craft, stay_silent]

outcomes:
- молчание Старшего оставляет странность живой
- «это бог» делает Младшего самодовольным на день
- «это ремесло» чуть убивает странность
- насмешка спасает от храма пафоса, но ранит слух

AUTHOR: это наследник сцены с визиткой. Предмет — тонкий черепок или плоский камень в щель между валунами.

---

## RIVER_05 — Сборщик брода

biome_tags: [ford, inhabited_edge]  
danger_material: отказ в переходе, крик страже, отнятие свитка  
body_demand: стоять близко к чужому телу, не начать первым  
thought_on_trial: имя как обязательство перед чужим законом  
irreversible_price: долг, ложное имя, драка  
later_hook: `debt_ford_keeper` возвращается в порту или на царской дороге

primary_bearer: Ariston  
actions_available: [give_true_name, give_road_name, pay, refuse, threaten, let_younger_speak]

outcomes:
- `named_to_stranger`
- `debt_ford_keeper`
- `scroll_given` (крайний)
- короткий конфликт: можно остановить удар

AUTHOR: сборщик не карикатура. У него закон места. Он может быть справедлив и всё равно опасен для свитка.

---

## RIVER_06 — Зверь в камыше

biome_tags: [palm_lowland, reeds]  
danger_material: клыки / копыта / детёныш позади  
body_demand: заметить раньше, не делать лишний шаг  
thought_on_trial: мир не аудитория вашей беседы  
irreversible_price: рана, убийство, долгий обход  
later_hook: `killed_animal` меняет вечер: Младший красиво оправдывается или не может есть мясо

primary_bearer: either  
actions_available: [stop, back, occupy_space, strike, flee, give_food]

outcomes:
- разошлись
- рана одному
- `killed_animal`
- обход = потеря часов, встреча с другим событием становится вероятнее вечером урезанной

AUTHOR: не делать зверя символом. Сначала животное, потом мысль.

---

## RIVER_07 — Молчаливый на том берегу

biome_tags: [far_bank, temple_distance]  
danger_material: оскорбление чужого молчания или потеря проводника  
body_demand: подойти мокрым, усталым, без театра  
thought_on_trial: не всякая встреча обязана стать беседой  
irreversible_price: знание места / отказ  
later_hook: если `spoke_to_silent_man` — он может указать настоящий брод или отказать завтра; если `left_silent_man` — в городе у камней узнают этот жест

primary_bearer: Ariston  
actions_available: [pass, sit_nearby_silent, greet, offer_food, ask_ford]

outcomes:
- он молчит, и это достаточный ответ
- он показывает брод жестом
- он уходит, если речь слишком быстрая
- ложная любезность героев закрывает дверь

AUTHOR: не превращать его в готового гуру. Он может быть просто человеком, который не хочет греков.

---

## RIVER_08 — Промокший фрагмент

biome_tags: [river]  
requires: [scroll_present]  
forbidden_if: [scroll_lost]

danger_material: вода берёт знание без драмы  
body_demand: сушить, переписать по памяти, признать потерю  
thought_on_trial: знание материально; мысль не висит в воздухе  
irreversible_price: один фрагмент досье нечитаем  
later_hook: в финальном споре не хватает именно этой посылки

primary_bearer: either  
actions_available: [dry_now, rewrite_from_memory, accept_loss, blame_companion]

outcomes:
- `scroll_wet` + потерянный фрагмент id=3
- перепись по памяти вводит ошибку (`scroll_corrupt`)
- обвинение портит спор дня

AUTHOR: событие может выпасть даже после «успешной» переправы. Река не обязана награждать добродетель.

---

## Вечер (фиксированное закрытие)

Зависит от берега и флагов. Всегда незаконченный спор.  
Запрещено решать внутренний вопрос дня окончательно.
