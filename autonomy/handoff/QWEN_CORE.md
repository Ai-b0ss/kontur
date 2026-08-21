# Qwen — агентное ядро

Обновлено: 2026-08-21 06:52Z.

## Текущее состояние

`qwen-free-api`: ветка `autopilot/qwen-runtime-preflight-20260818`, PR #6, текущий head после этого прохода `d41bc71ac7875c8bb4a625e128f20d01c2d885c6`.

В этом проходе закрыт следующий слой ошибок streaming/OpenCode на границе клиента и Qwen:

- успешный разбор SSE и уже подтверждённый checkpoint больше не могут вылететь из callback только потому, что клиент исчез перед финальными `res.write(finalChunk)`, `[DONE]` или `res.end()`;
- разрыв клиентского соединения считается локальной downstream-проблемой и не вызывает `onError`, поэтому здоровый Qwen-аккаунт не получает ложный cooldown/failure;
- тот же принцип распространён на обычные промежуточные SSE-данные и на выдачу ранее удержанных tool-call deltas: ошибка `res.write()` больше не выбрасывается из parser/EventEmitter callback, дальнейший upstream-поток можно корректно дочитать;
- для stream-first race исправлен старый противоречивый тест: upstream transport error по контракту должен классифицироваться через provider observer ровно один раз, а не ноль раз.

Продуктовые коммиты этого прохода:

- `134954fefb4dc26fdc95f4dbcfa49e6be0be85d6` — безопасное успешное завершение SSE при исчезнувшем клиенте;
- `a7357f2b3b0a3eee67e57914ee8dbfa1d1eed72d` — изоляция mid-stream downstream disconnect;
- тестовые коммиты `00f3b359d494748b3177184d9b5b4095ab15fb11`, `a95e3fa365d62b4bce959f0508a82d99ec531679`, `d41bc71ac7875c8bb4a625e128f20d01c2d885c6`.

Hosted-проверки без Qwen и без внешнего CI:

- `QWEN_STREAM_SUCCESS_DISCONNECT_PASS provider_health_untouched=1 callback_survived=1 end_attempted=1`;
- `QWEN_STREAM_MIDSTREAM_DISCONNECT_TARGET_PASS provider_health_untouched=1 parser_completion_survived=1`;
- локальный связанный race-harness после выравнивания provider-error контракта: `QWEN_STREAM_LIFECYCLE_RACE_PASS ... successful_disconnect_isolated=1`.

Полный exact-tree `npm test` не объявлять зелёным: весь приватный репозиторий на hosted-машине ещё не материализован. GitHub Actions, CircleCI, Cloudflare, live Qwen, реальные аккаунты и production в этом проходе не использовались.

## Постоянная память

Нормативный протокол: `autonomy/v3/CAPSULE_RUNTIME_PROTOCOL_V2.json`, реализация `autonomy/v3/tools/capsule_runtime_v4.py`.

На старте был прочитан `autonomy/v3/workspaces/QWEN_CORE/LATEST.json`; его exact Git blob SHA: `0a26b34f066d9baf08317d9ee5aa5fb82fd15a57`. Он указывает на capsule `20260821T055653Z-ce3cad6218`, archive SHA-256 `2beb0e63444f642b113dbd74d0845f0f56b7ec82189f5781eb3d50cddcb164d3`.

Manifest и обе части этой capsule были получены отдельно из GitHub. Точный исходник `capsule_runtime_v4.py` также был прочитан из Git blob `6557f906870c8f3eb866c1e8b2f2a0aadd79c96f`, но доступный путь переноса байтов из connector в hosted filesystem не позволил получить локальный файл с тем же Git blob SHA. Поэтому ручная реконструкция не использовалась для `restore/pack`, `LATEST/PREVIOUS` не трогались и псевдо-v4 capsule не создавалась. Это соответствует failure-policy: exact GitHub source остаётся recovery floor, неизвестные байты не реконструируются из памяти.

Перед завершением `LATEST` перечитан: blob SHA всё ещё `0a26b34f066d9baf08317d9ee5aa5fb82fd15a57`; CAS-конфликта с другим писателем не было, но публикация новой capsule намеренно не выполнялась без exact локального runtime.

## Следующее

1. Материализовать exact `src/stream-session-guard.js` + `scripts/stream-session-lifecycle-race-test.js` текущего PR-head на hosted-машине и прогнать реальный файл теста, а не только целевые harness-проверки.
2. Затем проверить disconnect во время flush уже принятого multi-tool-call: checkpoint должен оставаться fail-closed, provider health не должен меняться, а после restart pending ids должны оставаться согласованными.
3. После этого перейти к следующему воспроизводимому Core-дефекту в session/restart/subagent/prompt/skills; механику cooldown/account selection не расширять без пересекающегося дефекта.
4. При следующем существенном checkpoint снова выполнить только exact v4 `restore → pack → immutable upload → reread/verify → CAS LATEST`; force-write запрещён.

История предыдущих подробных записей сохранена в Git history этого файла; этот handoff намеренно сведён к актуальной рабочей точке, чтобы следующие запуски не тащили десятки устаревших промежуточных состояний.
