# CAPSULE v3 — перенос рабочей машины через GitHub

Статус: рабочий механизм подтверждён локально и отдельным восстановлением из GitHub chunks. Использовать как долговечную рабочую память между исчезающими ChatGPT containers.

## Что сохраняем

Только то, что дорого заново получать/собирать: локальный workspace exact source, применённые но ещё не опубликованные изменения, build/test caches если они реально полезны, screenshots/traces, незавершённый checkpoint, локальные SQLite/служебные данные теста.

Не класть в capsule секреты: токены, cookies, auth-state, `.env`, ключи, пароли, browser profiles с логином. Секреты должны приходить отдельно из разрешённого secret channel.

## Формат

Использовать `autonomy/v3/tools/capsule_v3.py`.

1. `pack <workspace> <outdir> --chunk-size 32768` создаёт tar.gz, manifest и chunks.
2. Для GitHub transport каждый binary chunk кодировать base64 ОТДЕЛЬНО в один небольшой UTF-8 файл. Не складывать весь archive в один огромный base64 файл.
3. Каждый chunk обязан иметь: index, decoded size, decoded SHA-256. Дополнительно проверять SHA-256 точного base64-текста, если transport его предоставляет.
4. Capsule immutable: каждый save получает уникальный путь `autonomy/v3/worker-capsules/<WORKER>/<capsule-id>/...`.
5. После полной записи всех chunks и manifest можно обновить маленький `LATEST.json`. Никогда не публиковать LATEST раньше полного capsule.

## Восстановление

1. Если `LATEST.json` есть — прочитать manifest.
2. Скачать каждый chunk отдельно через GitHub connector.
3. Проверить base64 text при наличии его SHA, затем decode и проверить decoded size/SHA.
4. Собрать archive строго по index.
5. Проверить общий archive SHA.
6. Распаковать безопасно через `capsule_v3.py restore`.
7. Сверить workspace manifest. При первом несовпадении прекратить restore; ничего не реконструировать по памяти модели.
8. Продолжить работу из checkpoint.

Если capsule отсутствует или повреждён, агент не должен останавливаться: восстановить source из GitHub обычным способом и продолжить; capsule — ускоритель и память незавершённой локальной работы, а не единственная копия исходного кода.

## Когда сохранять

Перед завершением scheduled run сохранять capsule, если существует полезная локальная работа, которую следующий run иначе будет вынужден повторить. Если весь полезный результат уже надёжно записан в обычные GitHub commits/files и локальный workspace легко восстановим — capsule можно не создавать.

## Доказательства

- `autonomy/v3/evidence/CAPSULE_V3_LOCAL_PASS_20260820.json` — pack/restore и checkpoint continuation локально.
- `autonomy/v3/evidence/CAPSULE_V3_GITHUB_RESTORE_PASS_20260820.json` — восстановление из набора маленьких GitHub chunks.
- `autonomy/v3/evidence/E8_VERDICT.json` — локальный `/mnt/data` между scheduled runs не сохраняется; на него нельзя полагаться.
