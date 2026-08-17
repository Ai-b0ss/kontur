# КОНТУР — гейт интеграции перед PREVIEW

**Дата:** 2026-08-14  
**Статус:** `PATCH_READY_AWAITING_EXACT_SOURCE`  
**Официальный следующий этап:** STEP F — одна безопасная Worker Version без переключения трафика

## 1. Что уже утверждено

- hook `Какая ты птица в IT?` и большое яйцо;
- то же яйцо уменьшается и переезжает в первый вопрос;
- восемь вопросов и восемь последовательных состояний трещины;
- вылупление через внутренний свет и разрыв скорлупы;
- отдельный экран результата, затем объяснение `/worm`, затем Home;
- шесть визуальных результатов: сорока, дятел, сойка, журавль, сова и Котосов;
- Котосов — отдельный вайбкодер, а не замена совы;
- правило `vibe + coder как единственный сильнейший secondary score → kotosov`.

Текущая трещина принята как прототип с известным визуальным долгом. Она не блокирует preview integration.

## 2. Граница исходника

Recovery gate 2026-08-12 уже дал `RECOVERY_NOT_PROVABLE`.

Доказаны:

- frontend snapshot `KONTUR_FRONTEND_FOR_SOL_20260808-180244.zip`, SHA-256 `14a0cf36edf8e3cd1bcc7fe78d887b2769e9e87321dc5664249074b9a494b0eb`;
- frontend support package `KONTUR_FRONTEND_SUPPORT_PACKAGE_20260812.zip`, SHA-256 `a2be682b37889848959ad32e55eaf2f618a45dafee21680349e774977eb5a9cf`;
- Night Build `KONTUR_NIGHT_BUILD_PATCH.zip`, SHA-256 `a0edcae1b2593f875f2f80e1dc4f503387e4e3de0d087603f9c111f9b9a32720`;
- release harness, SHA-256 `47c16cc3f34f8c4ed8c33e997507b2e2ab2cbb327af941548e1bbcecd672e1a4`.

Не доказан один объект: post-integration full worktree с фактическим Worker/control set. Поэтому старый full repo и неполные архивы нельзя склеивать в новый baseline.

## 3. Точный план изменения исходника

После PASS source gate меняется только first-time frontend funnel.

| Область | Изменение |
|---|---|
| `LocalKontur.tsx` | default entry сразу в hook; восемь ответов; progressive egg; hatch transition; отдельный `/worm` screen; выбор visual result |
| `local-kontur.css` | принятая композиция 430×1000 и 320×568; motion; reduced-motion fallback; нормализованный размер птиц |
| bird visual components | шесть принятых assets; `kotosov` как visual variant роли `vibe` |
| local result helper | pure selector после canonical `resolveRole`; безопасный fallback на сову |
| local storage | сохраняется только `owl/kotosov` presentation-вариант для `player.userId` |
| tests | старые пять ролей, сова/Котосов, reload fallback, точные восемь вопросов, default routing |

## 4. Инварианты

Не менять:

- `QUESTIONS`, option indexes и weights;
- canonical `resolveRole()`;
- backend hatch mechanics;
- API contracts и D1;
- `/worm`, стоимость яйца и гарантированно новый окрас;
- Telegram config;
- live deployment.

Котосов не записывается в `PlayerState.role`. Для backend это всё ещё `vibe`.

## 5. Правило интеграции Котосова

1. Frontend отправляет прежние восемь answer indexes в прежний `/local/hatch`.
2. Сервер возвращает canonical `result.role`.
3. Frontend вызывает существующий `resolveRole(finalAnswers)` из `@kontur/core` только для получения того же score vector.
4. Котосов разрешён лишь когда сервер вернул `vibe`, локальный resolved role тоже `vibe`, а `coder` строго выше `designer`, `creative` и `manager`.
5. Ничья, расхождение, неполные данные или отсутствие сохранённого варианта дают сову.

Так frontend не копирует веса и не меняет победителя.

## 6. Обязательная проверка перед preview

- targeted LocalKontur tests;
- полный доступный test suite;
- typecheck;
- build с утверждёнными bird assets;
- 430×1000 smoke;
- 320×568 smoke;
- reduced motion;
- broken images = 0;
- collisions = 0;
- новый пользователь начинает с hook, а не с community 01–03;
- community screens сохранены как отдельная ветка;
- scoring и personalized description детерминированы;
- после reload сова не превращается в Котосова и Котосов не превращается в сову в том же клиенте.

## 7. Единственный текущий source gate на ПК

Распаковать неизменённый `KONTUR_RELEASE_HARNESS.zip` в Downloads и запустить default `SafeDryRun`:

```powershell
$h=@(Get-ChildItem -LiteralPath (Join-Path $env:USERPROFILE 'Downloads') -Filter 'RUN_KONTUR_TEST_RELEASE.ps1' -File -Recurse -ErrorAction SilentlyContinue | Where-Object { $_.Directory.Name -like 'KONTUR_RELEASE_HARNESS*' }); if($h.Count -ne 1){Write-Output ('SAFE_STOP: expected exactly one extracted KONTUR_RELEASE_HARNESS, found ' + $h.Count); exit 20}; & $h[0].FullName; exit $LASTEXITCODE
```

Это не deploy. Дополнительные параметры `RealTestRelease` и `AllowRealTestRelease` запрещены на этом гейте.

- `PASS` доказывает пригодное расположение исходника;
- `SAFE_STOP` требует только созданный `evidence.json`;
- до одного из этих результатов production patch не применяется.

## 8. Честный статус

Архитектура изменения, assets, motion mock и selector готовы. Production integration, build, browser smoke и Worker Version ещё не выполнены, потому что exact full source отсутствует в текущей среде.
