# Qwen Core — explicit owner durability

Статус: дефект воспроизведён; применяемый bundle подготовлен и red-team усилен.

## Единственный актуальный bundle

Применять последовательно на свежие exact blobs:

1. `autonomy/v3/candidates/QWEN_CORE_EXPLICIT_OWNER_DURABILITY_V2_20260822.patch`
2. `autonomy/v3/candidates/QWEN_CORE_EXPLICIT_OWNER_DURABILITY_V3_RECOVERY_DELTA_20260822.patch`

V1 удалён. V2 без V3 больше НЕ считать финальным.

## Зачем нужен V3

Red-team V2 нашёл два незакрытых класса:

1. V2 восстанавливал durable owner prompt только для literal short continuation (`continue`/`продолжи`). Но prompt authority принадлежит сессии целиком: обычный следующий запрос вроде `do the next task` тоже не должен незаметно падать обратно в engineer mode.
2. Fallback `.bak` может содержать stale out-of-band `systemPromptMode`/`ownerSystemPrompt`. История умеет проходить explicit full-history reconciliation, но detached owner field в этой истории отсутствует. Поэтому backup owner metadata нельзя автоматически принимать как текущую authority.

## Финальный целевой контракт V2+V3

- durable record отдельно хранит `systemPromptMode` + exact `ownerSystemPrompt`;
- owner authority наследуется на любом следующем ходе той же сессии, а не только на magic word `continue`;
- свежие `Instructions from:` / project system blocks не демотируют durable explicit owner prompt; downstream owner-mode сам отделяет их как neutral project context;
- explicit `owner` mode без повторной передачи detached текста наследует durable exact owner text;
- новый explicit owner field побеждает старый;
- explicit `engineer` — намеренный authority transition, старый owner не воскресает и очищается на durable commit;
- oversized explicit owner => `QWEN_SYSTEM_CHECKPOINT_REJECTED` до request governor / Qwen traffic;
- одинаковая prompt metadata проходит через primary/retry non-stream и все streaming persistence paths;
- fallback-backup record с V2 prompt metadata требует текущего явного подтверждения authority до того, как history reconciliation сможет очистить recovery marker;
- backup reconciliation удаляет stale `systemPromptMode`/`ownerSystemPrompt` из нового canonical record; текущая authority будет записана только из текущего запроса после accepted response;
- owner field без redundant mode flag во время recovery может быть принят как явная текущая owner authority; bare stale `mode=owner` без нового owner/system материала не воскресит backup prompt.

Перед применением обязательно перечитать fresh `server.js` и `src/session-store.js`: параллельно пишет Reliability. Если простой `QWEN_CORE_SYSTEM_CHECKPOINT_PREFLIGHT_20260821.patch` уже применён, не накладывать его второй раз — V2 содержит его семантику.

После V2+V3: targeted tests -> `node --check` -> session/restart cluster -> только затем новые regressions в свежий exact `npm test`.