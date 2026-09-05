# Рабочее окружение Windows — 5 сентября 2026

**Статус: подготовка выполнена частично; редактор и полный цикл ещё не проверены.**
Установка Blender и .NET ждёт разрешения Windows. Установщик Unity вернул
«Операция была отменена пользователем». Вход Unity CLI завершился по тайм-ауту.
После подтверждения установок и входа в Unity продолжить пункты ниже.

## Рабочие папки

- Репозиторий: `C:\Dev\metaxu`, ветка `codex/windows-unity`.
- Новый Unity-проект: `C:\Dev\metaxu\unity\Metaxu`.
- Рабочее пространство VS Code: `C:\Dev\metaxu\Metax.code-workspace`.
- Редактор (целевой путь): `C:\Dev\Tools\Unity\6000.3.23f1\Editor\Unity.exe`.
- Blender (целевой путь): `C:\Program Files\Blender Foundation\Blender 5.2\blender.exe`.
- Blender MCP: `C:\Dev\Tools\blender-mcp`, отдельная `.venv` с Python 3.12.12.
- Установщик Unity и архив URP-шаблона: `D:\MetaxDownloads`.
- Логи, проверки, Windows exe: `C:\Dev\metaxu\artifacts` (исключены из Git).

Компьютер: Ryzen 5 7500F, 32 ГБ RAM, RTX 5060. Перед установкой свободно
около 229 ГиБ на C и 2077 ГиБ на D. Существующие программы не удалялись.

## Установлено и подготовлено

- Git 2.53.0 и LFS 3.7.1 уже были установлены; LFS включён для этого репозитория.
- Unity Hub 3.21.1 установлен через winget.
- Unity CLI 1.0.0-beta.8 установлен, команда `unity --help` работает.
- VS Code 1.110.1 уже был установлен. Добавлены Unity 1.3.1, C# 2.140.9,
  C# Dev Kit 3.20.199, .NET Install Tool 3.1.0.
- Blender MCP 1.9.1 закреплён на commit
  `c5f35d9cc54451d785ac4c00c48bf9e98a2e8db9`, зависимости из его uv.lock.
  Add-on скопирован в пользовательскую папку Blender 5.2. При первом запуске
  его включает `tools/blender/start_mcp.py`.
- Проект создан из официального `com.unity.template.urp-blank` 17.1.0.
  Закреплён Unity 6000.3.23f1, URP 17.3.0, Input System 1.14.2,
  Visual Studio Editor 2.0.28, Test Framework 1.6.0 и Unity UI 2.0.0.
- Официальная команда `unity pipeline install` добавила
  `com.unity.pipeline` 0.6.0-exp.1. CLI/Pipeline экспериментальные;
  сам редактор выбран из LTS. Пакеты пока не прошли разрешение в редакторе.
- Проект зарегистрирован в Unity Hub. Настройки MCP находятся в
  `.codex/config.toml`: открыть именно `C:\Dev\metaxu` как проект Codex.
  В этой уже запущенной задаче новые MCP-инструменты автоматически не появились;
  их можно проверять через CLI/скрипты.

Старый Babylon-проект сохранён как архив. Отдельный GitHub-репозиторий пока
не нужен: новая реализация изолирована в `unity/Metaxu`, история и материалы
остаются рядом. GitHub-коннектор просит повторный вход, но локальный Git
успешно выполнил `push --dry-run` без запроса входа.

## Проверено

- Подлинная подпись Unity Technologies и MD5 установщика совпадают
  с официальным Unity Release API; файл полностью загружен (4 125 667 560 байт).
- SHA1 URP-шаблона совпадает с официальным каталогом шаблонов.
- Blender MCP: `initialize` и `tools/list` прошли, получено 28 инструментов.
  Результат: `artifacts/blender-mcp-check.json`.
- Синтаксис PowerShell, Python и TOML проверен. Справочные файлы обучения
  шаблона и его устаревший packages-lock сохранены вне проекта в
  `D:\MetaxDownloads\TemplateExtras`; актуальный lock создаст редактор.
- **Не проверено:** запуск Blender и экспорт FBX, запуск Unity, компиляция C#,
  загрузка пакетов, управление Unity через Pipeline, Play Mode, Windows exe.
  Сцена ещё не создана: для неё подготовлен Editor-скрипт.

## Завершение настройки

1. Завершить установку Blender 5.2.1 и .NET SDK 10.0.400, подтвердив UAC.
2. Повторить запуск проверенного установщика Unity с аргументами
   `/S /D=C:\Dev\Tools\Unity\6000.3.23f1`; подтвердить UAC.
3. Войти в Unity (`unity auth login`) и активировать Personal через
   `unity license activate --personal --accept-eula`, если этот тип лицензии
   подходит владельцу. Пароли и токены не сохранять в репозитории.
4. Зарегистрировать редактор:
   `unity editor add C:\Dev\Tools\Unity\6000.3.23f1\Editor\Unity.exe`.
5. Выполнить `tools/Metax.ps1 Export`, затем `tools/Metax.ps1 Scene`.
   Дождаться разрешения пакетов и сохранить созданный `packages-lock.json`.
6. Открыть проект (`tools/Metax.ps1 Open`), проверить `unity pipeline list`,
   коротко включить Play Mode и остановить его.
7. Закрыть Unity-проект, выполнить `tools/Metax.ps1 Build`, запустить exe.
   Аргумент `-metaxSmoke` перемещает объект и автоматически завершает exe
   с кодом 0 при успехе. Без аргумента: WASD и Esc.
8. `tools/Metax.ps1 Blender`, затем
   `C:\Dev\Tools\blender-mcp\.venv\Scripts\python.exe tools/check_mcp.py --live`.
   Проверка создаёт временный Empty, подтверждает его наличие и удаляет его.
9. Обновить этот статус фактическими результатами, сохранить изменения в Git.

Тестовый объект и сцена служат только проверкой окружения. Это не утверждённый
художественный образец, камера или реализация игровых механик.
Windows Mono достаточно для первой сборки: IL2CPP/C++ toolchain и дополнительные
платформы сейчас не устанавливаются. Модели экспортируются в FBX; `.blend`
лежит вне Assets, чтобы импорт не зависел от установленного Blender.

## Источники

- [Исходный перенос](https://github.com/amchercashin/metaxu/blob/main/docs/WINDOWS-HANDOFF.md).
- [Unity Release API](https://services.api.unity.com/unity/editor/release/v1/releases?version=6000.3&limit=1&platform=WINDOWS&architecture=X86_64).
- [Blender LTS](https://www.blender.org/download/lts/).
- [Unity CLI](https://docs.unity.com/en-us/unity-cli/use-unity-cli).
- [Замена старого Unity MCP](https://docs.unity.com/en-us/unity-cli/replace-mcp-server-unity-cli).
- [Unity Pipeline](https://docs.unity.com/en-us/unity-production-pipeline/local-tools-cli/unity-pipeline-package).
- [Blender MCP](https://github.com/ahujasid/blender-mcp).
- [Unity в VS Code](https://code.visualstudio.com/docs/other/unity).
- [MCP в Codex](https://learn.chatgpt.com/docs/extend/mcp?surface=cli).
