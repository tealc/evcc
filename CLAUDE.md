# tealc/evcc: private fork of evcc-io/evcc

Read @AGENTS.md for the project itself. This file only covers the fork.

The owner does not write Vue or Go. Explain changes in plain German, keep the fork small, and verify everything yourself (lint, type check, tests, build) before pushing.

## Branches

- `master` mirrors `evcc-io/evcc` master. Never commit to it.
- `custom` = upstream master + the fork commits below. This is what gets built and deployed.

## Fork commits on `custom`

1. `Optimizer: synced zoom for charging plan and SoC charts`
   - ECharts `dataZoom` on the Charging Plan and all SoC charts, one shared range in `assets/js/views/Optimize.vue` stored as `{start, end}` epoch ms, clamped to each new plan's horizon.
   - Ctrl + wheel or trackpad pinch zooms, drag or Shift + wheel pans, slider under the Charging Plan, double-click or the header button resets.
   - The Charging Plan uses the same time x axis as the SoC charts, so equal times line up in all charts.
   - No zoom on touch devices: `attachTouchTooltipGate` in `assets/js/utils/swipe.ts` swallows touch events before ECharts sees them.
   - Main files: `assets/js/components/Optimize/{zoom.ts,ChargeChart.vue,SocChart.vue,chart.ts}`, `assets/js/mixins/formatter.ts` (`fmtSlotTitle`, `fmtPointTitle`).
2. `Vehicle absences: per-vehicle absence windows for the optimizer`
   - Absence windows per vehicle (`api/absence.go`), stored with the vehicle settings, API `POST /api/vehicles/{name}/absences`.
   - `core/site_optimizer_request.go` `applyAbsences` turns them into per-slot `c_avail` (0/1) and `e_away` (Wh) for the vehicle's battery entry.
   - The upstream Go optimizer client has no such fields. `core/site_optimizer_body.go` `optimizerRequestBody` marshals the request and injects them into `batteries[i]`. Without absences the body is byte-identical to upstream.
   - Requires the self-hosted optimizer fork (`tealc/optimizer`, branch `custom`) via `OPTIMIZER_URI`. The hosted optimizer does not know the fields.
3. `Vehicle absences: UI for per-vehicle absence windows`: `assets/js/components/ChargingPlans/*Absence*`, `absences.ts`, the absence section in the charging plan modal, vehicle selector when no vehicle is connected.
4. `Vehicle absences: show away slots on the optimizer page`: hatched away bands (`markArea`) in the Charging Plan, tooltip row, legend entry and away rows in the timeline table, read from `details.batteryDetails[].cAvail/eAway`.
5. `Fork: image build and agent notes`: `.github/workflows/fork-image.yml` and this file.
6. `Optimizer: explain button with a self-hosted optimizer`
   - `PlanExplanation.vue` shows the explain button for a self-hosted optimizer too (`hosted` prop, from `evopt.hosted`), no sponsorship needed. The request already goes to `OPTIMIZER_URI` without the sponsor token, keep it that way.
   - Feedback (thumbs, `/optimize/explain/feedback`), privacy link and the evcc-io issue link are hidden when self-hosted. Errors from the optimizer (e.g. no API key) show as `optimize.explainFailed` in the card.
   - Frontend only.

Keep fork commits few and focused, so rebasing stays cheap. New fork work gets its own commit. Fixes to an existing fork feature are folded into that commit: `git commit --fixup=<sha>`, then `GIT_SEQUENCE_EDITOR=true git rebase -i --autosquash upstream/master`.

## Syncing with upstream

```
git remote add upstream https://github.com/evcc-io/evcc   # once
git fetch upstream master
git push origin upstream/master:master                     # update the mirror
git rebase upstream/master custom
make lint-ui && make test-ui && make ui                     # frontend
go build ./... && go test ./core/... ./api/... ./server/...  # backend, needs the Go version from go.mod
git push --force-with-lease origin custom
```

- Sync the optimizer fork first, its fields must stay compatible with what `optimizerRequestBody` sends.
- Conflicts usually come from upstream changes to the optimizer charts. Keep upstream's intent and re-apply the fork feature on top, then check the charts in Storybook (`Optimize/ZoomedCharts`).
- If this sandbox has no matching Go toolchain, push and let the fork workflow run the Go checks. Watch the run until it is green: a red run builds no image.

## Build and deploy

- A push to `custom` runs `.github/workflows/fork-image.yml`: Go vet and tests, UI lint and tests, then it publishes `ghcr.io/tealc/evcc:custom` (linux/amd64). No image is published when a check fails.
- NAS stacks: `evcc-custom` is production (same data as the former official `evcc` stack, which is down but kept), `evcc-dev` is a demo-mode test instance on dev-evcc.guhgel.com. Update either by redeploying it with pull.
- The NAS runs it together with `ghcr.io/tealc/optimizer:custom`, `OPTIMIZER_URI` points evcc to that optimizer.
