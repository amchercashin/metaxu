# Флаги памяти — River Day (канон продюсера)

Источник: `events-river-day.md`. Меняет только Продюсер. Системы читают, не расширяют без согласования.

Сохранение дня обязано покрыть все канонические флаги.

## Канон дня

| id | значения | откуда |
| --- | --- | --- |
| `argument_of_day` | `node` \| `distinction` \| `haste` | RIVER_00 утро |
| `scroll_intact` | bool | старт / игнор тонущего |
| `scroll_wet` | bool | тонущий / промокший фрагмент |
| `scroll_lost` | bool | тонущий |
| `scroll_given` | bool | сборщик брода, крайний исход |
| `scroll_corrupt` | bool | RIVER_08, перепись по памяти |
| `named_to_stranger` | bool | сборщик брода |
| `debt_ford_keeper` | bool | сборщик брода |
| `saved_drowning` | bool | тонущий |
| `ignored_drowning` | bool | тонущий |
| `killed_animal` | bool | зверь в камыше |
| `followed_night_tracks` | bool | следы ночи |
| `left_silent_man` | bool | молчаливый |
| `spoke_to_silent_man` | bool | молчаливый |
| `pride_of_throw` | bool | камень и попадание |
| `camp_east_bank` | bool | вечер |
| `camp_west_bank` | bool | вечер |
| `no_fire` | bool | вечер |

Свиток: взаимоисключающие состояния `intact` / `wet` / `lost` / `given`; `corrupt` наслаивается на `wet` после переписи. Лагерь: одно из `camp_east_bank` / `camp_west_bank` / `no_fire`.

## Вторичные (исход события, не обязательно вечерняя память)

| id | откуда |
| --- | --- |
| `knows_ford` | RIVER_01, верный брод |
| `knows_others_crossed` | RIVER_03, не пошли по следу, но прочли |

## Запрет

Не добавлять флаги круга 14 (палуба, порт, царская дорога). Хуки «вернётся в порту» пишутся в карточке, флаг ставится сегодня, чтение — позже.
