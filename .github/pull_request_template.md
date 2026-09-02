<!--
  Guidelines: CONTRIBUTING.md
  Delete any section that genuinely does not apply — do not delete all of them.
-->

## Ticket

SCRUM-

## What changed, and why

<!-- The why is the half nobody can reconstruct from the diff. If you weighed
     a trade-off or rejected an alternative, say so here. -->

## How it was tested

<!-- Which suites, and anything you exercised by hand. Name the case that
     would have failed before this change. -->

## Checklist

- [ ] Branch is named `<type>/SCRUM-<number>`
- [ ] Tests written **before** the code, and watched fail first
- [ ] `npm run typecheck && npm test` passes
- [ ] `cd frontend && npm test && npx tsc --noEmit && npx expo lint` passes
- [ ] No test file added under `frontend/app/`
- [ ] Docs updated if behaviour or a documented rule changed
- [ ] No `.env`, `terraform.tfvars`, plan archive, or other secret committed

## Anything a reviewer should know

<!-- Migrations, follow-up work, parts you are unsure about, or anything that
     needs a second opinion. Delete if there is nothing. -->
