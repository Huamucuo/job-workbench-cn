# Cross-page application assistance implementation plan

> **For agentic workers:** Use superpowers:executing-plans for integration, with independent test/observer tasks delegated under superpowers:dispatching-parallel-agents. Keep disjoint file ownership and one final independent review.

**Goal:** In the existing Beta, unlock once in a persistent Edge/Chrome side panel and automatically prepare a fresh preview after each same-application page/step, while the person explicitly approves each page's writes.

**Architecture:** Keep the existing popup, canonical encrypted archive and engine. A new trusted side panel owns decrypted memory and an origin/tab-limited SessionScope; a read-only isolated-world watcher describes visible form changes. Scripting documentId, form fingerprints and current active-tab checks reject stale writes. Worker stores only opening-target metadata.

**Tech Stack:** Existing vanilla JS, MV3 sidePanel/activeTab/scripting/storage, Node tests, real isolated Edge MV3 Playwright/CDP. No new third-party dependency or cloud service.

**Spec:** ../research/网申完整流程与减少操作方案-2026-10-13.html, accepted by the user's instruction to finish cross-page support before making the videos. Existing instructions authorize autonomous choices and continuous delivery; no additional routine design-approval pause.

## Global Constraints

- Keep original 37 independent assertions and Beta archive/search/salary/favorites/labels/application records.
- Source public/autofill is canonical; generate extension/autofill with the existing build.
- Decrypted profile stays only in trusted side-panel memory; never worker/session/local/sync plaintext, website whole-profile transfer, logs or public data.
- Only HTTPS or loopback HTTP; no all_urls, no host_permissions, no iframe/Shadow DOM expansion. Add sidePanel permission only.
- Default automatic detection/preview, explicit page write. Login, verification, declarations, uploads, site next/save and final submission stay manual.
- Keep occupied fields, preserve manual corrections, reject expired/document-changed/control-changed requests and separate failure/pending from success.
- New package version 0.4.1-beta.1 / extension 0.4.1, separate release directory, never overwrite RC1 frozen artifacts.

## Review Focus

1. Same URL refresh and same document new step must invalidate old preview (Task 2/3).
2. Origin/tab/application-key change, permissions revoked, idle/absolute expiry or archive revision must stop stale writes (Task 1/2/3).
3. Our own fills and irrelevant DOM animations must not create a scanning loop or repeat writes (Task 1/2/3).
4. Async scan response racing with navigation/manual field edits must not become current or overwrite inputs (Task 2/3).
5. Side-panel persistence/callbacks must work in actual Edge, with worker restart and no fake plaintext service/extension mock (Task 3/4).

### Task 1: Read-only observer and pure session boundary

**Files:** Create public/autofill/page-watch.js, extension/session-policy.mjs, tests/session-policy.test.mjs, tests/page-watch.browser.mjs.

**Interfaces:** `globalThis.JobAutofillPageWatcher.read()` async -> `{fingerprint,contextKey,fieldCount,url,applicationLabel}`. fingerprint includes visible controls, labels/group/order/choices/occupied-value changes, but never exports field values; contextKey hashes observed explicit data-job/application/requisition IDs or known URL identifiers, empty if unidentifiable. It never calls scan/apply, clicks controls, stores data or sends network. Export `SessionScope` constructor `{tabId,origin,startedAt,maxAgeMs=1800000,idleMs=300000}`, `touch(now)`, `bindContext(key)`, `inspect({tabId,activeTabId,url,contextKey,now})` -> `{allowed,reason,lock,pause}`, `end()`. inspect never grants another origin/tab; an explicit changed nonempty known key pauses. Unknown context must remain visibly unconfirmed, with each-page user review.

- [ ] Write/watch RED tests for expiry/no revival, wrong tab/source/active tab/context, same URL new state, DOM async/choice/visible/value changes and no action/network.
- [ ] Implement exact interfaces; do not edit engine, manifest, background, panel or packaging.
- [ ] Run focused tests GREEN; preserve evidence and report to coordinator. No subagents or shared Git operations.

### Task 2: Persistent trusted side-panel integration (coordinator)

**Files:** New extension/sidepanel.{html,mjs,css}, extension/session-controller.mjs; update popup.{html,mjs}, background.mjs, manifest.json, public/autofill/panel.mjs, scripts/build-extension.mjs.

**Interfaces:** popup #open-session opens actual sidePanel under toolbar gesture. New protocol job-session-v1 `session:request` accepts numeric tabId only from popup and records target metadata; sidepanel reads applicationTarget trusted session metadata. Existing job-beta-v1 archive/bridge behavior stays unchanged. Side-panel selectors #session-password, #session-unlock, #session-status, #session-target, #session-lock, #session-end, #continuous-panel, #session-history. Existing mountPanel adds option continuous=false and methods invalidate(reason), isBusy(); true mode uses one button “核对并填写本页” without visible #af-confirm checkbox. scan remains callable, results classification unchanged. Automatic previews never auto-write or add groups; “准备经历分组” remains explicit when necessary.

- [ ] Verify current API baseline and actual SidePanel target under Edge gesture before relying on it.
- [ ] Add transport: current tab/origin/application/expiry guards, scan/apply bound to exact returned documentId and watcher fingerprint. Calls serialized; navigation or newer generation invalidates old response.
- [ ] Auto-poll read-only observer, debounce meaningful changes, reinject after new document; preserve last result/history and avoid own-fill scan loop. Clear previews on off-target, permissions failure, lock and archive change.
- [ ] Keep short idle and absolute deadlines checked on every operation, not just timers. Close/lock/end clear decrypted memory; worker restart never supplies plaintext.
- [ ] Run focused side-panel and original default-panel regression tests.

### Task 3: Independent full-flow fixtures and browser acceptance

**Files:** New public/autofill/lab/flow/{contact,education,work,questions,attachments,review}.html, flow.mjs/style.css; tests/crosspage-browser.mjs and its independent helper if required. Do not change old fixture truth or production code.

**Interfaces:** Actual six URL pages contain a stable explicit application ID, normal Chinese/English fields mapped to Lin sample, >=2 education/internship/project groups, protected prefill, conditional/async fields, no-URL stage change and final submit counters. `window.FlowEvidence.snapshot()` reads DOM/controlled-model/saved-fixture states. Side panel opened via actual popup #open-session, never standalone page claimed as actual sidePanel. Import actual DOCX in options, confirm/save once, unlock sidepanel once, use the same unchanged archive for six pages.

- [ ] Write tests first and record initial RED (missing side-panel feature, not infra errors).
- [ ] Cover six pages, next/back/refresh, async insertion/choices, existing/manual changes, duplicate record protection, known application change, cross-origin/new-tab permission refusal, worker idle, expired/ended/locked scope and old requests.
- [ ] Count actual user unlock/scan/write/next operations; automatic scan clicks must be 0. Key misfill and formal submits 0; show skipped/failed/unknown distinctly. No input-setting by runner on target fields except explicitly measured manual corrections.
- [ ] Re-run original 37 and applicable Beta import/bridge/workbench/controlled-input checks; export real screenshots + JSON/HAR locally and concise public summaries without profiles.

### Task 4: Review, new Windows/extension package and user delivery

**Files:** Update version metadata and package scripts to derive fresh release labels, Windows launcher expected version, build asset allowlist; new docs/crosspage guide/report/handoff. Keep RC1 package immutable.

- [ ] Fresh independent whole-branch correctness/security review; fix material issues and rerun affected checks.
- [ ] Package extension and bundled-runtime Windows Beta 0.4.1 separately, validate byte-for-byte ZIP roundtrip/installed startup and owned stop behavior.
- [ ] User guide: one-time install/update/backup, main cross-page entry, ordinary-page one write confirmation, dynamic-group extra prepare where needed, visible pauses and unsupported contexts. No daily Edge-installed claim from isolated tests.
- [ ] Copy scoped verified new release to user project and provide clickable launcher/extension/guide/evidence, rollback to preserved RC1.
- [ ] Only after cross-page acceptance continue the authorized videos: portrait Douyin + landscape Bilibili, MP4/SRT/voice script, user's installed logged-in 剪映 and AI voice; never auto-post.
