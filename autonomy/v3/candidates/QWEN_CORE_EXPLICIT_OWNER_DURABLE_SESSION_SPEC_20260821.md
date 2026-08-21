# Qwen Core — explicit owner durability

Статус: дефект воспроизведён; спецификация превращена в применяемый кандидат.

Использовать только:

`autonomy/v3/candidates/QWEN_CORE_EXPLICIT_OWNER_DURABILITY_V2_20260822.patch`

V1 superseded и не должен применяться.

V2 включает:
- отдельное durable хранение `systemPromptMode` + exact `ownerSystemPrompt`;
- короткий continuation без новой authority наследует сохранённый owner prompt;
- явный `owner` mode без повторной передачи текста тоже наследует durable exact owner text;
- новый explicit owner/system authority побеждает старый;
- явный `engineer` не допускает resurrection старого owner prompt и очищает его при следующем успешном durable commit;
- hard fail-closed bound для explicit owner prompt с `QWEN_SYSTEM_CHECKPOINT_REJECTED` до provider traffic;
- одна и та же prompt metadata проходит через primary/retry non-stream и три streaming persistence paths;
- regression для restart/replacement/engineer-clear/oversized pre-provider rejection.

Перед применением обязательно перечитать свежие blobs `server.js` и `src/session-store.js`: параллельный writer может сдвинуть PR #6. Если простой `QWEN_CORE_SYSTEM_CHECKPOINT_PREFLIGHT_20260821.patch` уже применён, не накладывать его второй раз: V2 содержит тот же message-based pre-provider `checkpointMessages()` gate в составе более полного решения.

После применения: targeted tests -> `node --check server.js` -> ближайший session/restart cluster -> только затем подключить новые regressions в свежий exact `npm test` отдельной маленькой правкой.