# Рабочее окружение Windows — 5 сентября 2026

**Готово для первого этапа разработки.** Unity и Blender запускаются, тестовая
модель импортируется, Play Mode работает, Windows exe собран и проверен.

## Расположение

- Репозиторий: `C:\Dev\metaxu`, ветка `codex/windows-unity`.
- Unity-проект: `C:\Dev\metaxu\unity\Metaxu`.
- VS Code: `C:\Dev\metaxu\Metax.code-workspace`.
- Unity: `C:\Dev\Tools\Unity\6000.3.23f1\Editor\Unity.exe`.
- Blender: `C:\Program Files\Blender Foundation\Blender 5.2\blender.exe`.
- Blender MCP: `C:\Dev\Tools\blender-mcp`, отдельная Python 3.12.12 `.venv`.
- Сборка: `C:\Dev\metaxu\artifacts\Windows\MetaxSmoke.exe`.
- Установщики и архив исходного URP-шаблона: `D:\MetaxDownloads`.

Рабочие файлы и приложения размещены на быстром C, большие загрузки на D.
Старый Babylon-прототип сохранён. Новый репозиторий пока не нужен: Unity
изолирован в `unity/Metaxu`, концепция и история остаются рядом.

## Версии и интеграции

| Компонент | Версия |
| --- | --- |
| Unity Editor LTS | 6000.3.23f1 |
| URP | 17.3.0 |
| Blender LTS | 5.2.1 |
| Unity Hub | 3.21.1 |
| Unity CLI | 1.0.0-beta.8 |
| Unity Pipeline | 0.6.0-exp.1 |
| VS Code | 1.110.1 |
| VS Code Unity / C# / C# Dev Kit | 1.3.1 / 2.140.9 / 3.20.199 |
| .NET SDK | 10.0.400 |
| Git / LFS | 2.53.0 / 3.7.1 |
| Blender MCP | 1.9.1 |

В Unity закреплены Input System 1.14.2, Visual Studio Editor 2.0.28,
Test Framework 1.6.0 и Unity UI 2.0.0. Разрешённый `packages-lock.json`
сохранён в Git. VS Code выбран внешним редактором, решение и C#-проекты
генерируются Unity; добавлена конфигурация Attach to Unity.

Blender MCP закреплён на commit `c5f35d9cc54451d785ac4c00c48bf9e98a2e8db9`.
Аддон включён, сервер слушает localhost:9876, телеметрия аддона отключена.
Официальный Unity Pipeline отвечает через localhost:7800. CLI и Pipeline
имеют beta/experimental статус; редактор и Blender выбраны из LTS.
Старый Unity AI Assistant MCP не устанавливался.

`.codex/config.toml` содержит два MCP-сервера для этого проекта. Для следующих
задач в Codex открыть **C:\Dev\metaxu** как проект: конфигурация привязана к
этому корню. В текущей задаче, запущенной из C:\, подключения проверены
отдельными MCP-клиентами и CLI. Это не требует переустановки программ.

Unity Hub уже авторизован; редактор получил Unity Personal и успешно собрал
игру. Blender для локальной работы аккаунта не требует. У MSIX-версий Hub
и CLI отдельные каталоги профиля: `unity auth status` может показывать выход,
хотя редактор лицензирован. Повторный вход CLI для обычной работы не нужен.

## Ежедневный запуск

Из PowerShell в `C:\Dev\metaxu`:

```powershell
.\tools\Metax.ps1 Open     # открыть Unity-проект
.\tools\Metax.ps1 Code     # открыть рабочее пространство VS Code
.\tools\Metax.ps1 Blender  # открыть Blender с локальным MCP
.\tools\Metax.ps1 Doctor   # версии и доступность Unity Pipeline
.\tools\Metax.ps1 Run      # открыть тестовую Windows-сборку
```

В Unity открыть `Assets/Metax/Smoke/EnvironmentCheck.unity` и нажать Play.
WASD перемещает тестовый объект; Esc закрывает отдельную Windows-сборку.
Перед пакетными операциями ниже закрыть этот Unity-проект:

```powershell
.\tools\Metax.ps1 Export   # создать .blend и экспортировать FBX
.\tools\Metax.ps1 Scene    # пересоздать только тестовую сцену
.\tools\Metax.ps1 Build    # собрать Windows x64 Mono
```

Export и Scene перезаписывают тестовые материалы: это команды проверки
окружения, не обработка будущих игровых ассетов. Исходники Blender хранятся
в `art/source`, экспорт FBX в Assets. Windows Mono достаточно для первого
этапа; IL2CPP/C++ toolchain и дополнительные платформы пока не нужны.

## Короткие проверки — выполнены

- Подпись и MD5 установщика Unity проверены по официальному Release API;
  SHA1 URP-шаблона проверен по каталогу Unity.
- Blender создал `.blend` и экспортировал FBX; Unity импортировал геометрию.
- C# скомпилирован, URP-сцена создана; в консоли редактора 0 ошибок.
- Play Mode включён и остановлен через официальный CLI. Кадр проверен:
  объект, материалы и освещение отображаются. `artifacts/metax-play.png`.
- Windows x64 exe собран. Запуск с `-metaxSmoke` проверил перемещение объекта
  и завершился с кодом 0 (`METAX_RUNTIME_SMOKE_OK`). Обычное окно игры также
  открыто и осмотрено. Логи: `artifacts/Build.log`, `artifacts/Player.log`.
- Blender MCP: handshake, 28 инструментов, создание и удаление временного
  Empty через реальный Blender. `artifacts/blender-mcp-check.json`.
- Unity MCP: handshake, 149 инструментов, чтение живого `editor_status`.
  `artifacts/unity-mcp-check.json`.
- VS Code подключён, Unity сгенерировал `Metaxu.slnx` и C#-проекты.
- Git LFS настроен для `.blend`, `.fbx` и будущих крупных бинарных ассетов.
  Library, сборки, логи и локальные файлы IDE исключены из Git.

Повторная проверка MCP при открытых приложениях:

```powershell
C:\Dev\Tools\blender-mcp\.venv\Scripts\python.exe tools/check_mcp.py --live
C:\Dev\Tools\blender-mcp\.venv\Scripts\python.exe tools/check_unity_mcp.py
unity command --project-path C:\Dev\metaxu\unity\Metaxu editor_status --json
```

Тестовая сцена — только проверка окружения. Художественный стиль, камера,
механики игры и окончательное название этим этапом не утверждаются.

## Источники

- [Исходный перенос](https://github.com/amchercashin/metaxu/blob/main/docs/WINDOWS-HANDOFF.md).
- [Unity CLI](https://docs.unity.com/en-us/unity-cli/use-unity-cli).
- [Замена старого Unity MCP](https://docs.unity.com/en-us/unity-cli/replace-mcp-server-unity-cli).
- [Unity Pipeline](https://docs.unity.com/en-us/unity-production-pipeline/local-tools-cli/unity-pipeline-package).
- [Blender LTS](https://www.blender.org/download/lts/).
- [Blender MCP](https://github.com/ahujasid/blender-mcp).
- [Unity в VS Code](https://code.visualstudio.com/docs/other/unity).
