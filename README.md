# ISA Peru 2026 Fantasy Surf
## Install
1. Upload ALL files to the repo root. Create each workflow file by typing its full path in GitHub "Create new file" (e.g. .github/workflows/collect.yml).
2. Settings > Pages > Source: GitHub Actions. Settings > Actions > General > Workflow permissions: Read and write.
3. Actions > collect > Run workflow. Then Actions > photos > Run workflow (finds free-licence headshots).
## Manual refresh / full rebuild
- Page button "Refresh now": reloads all data and the live feed immediately.
- Actions > rebuild > Run workflow: re-collects data and photos and redeploys. Tick "reset_history" ONLY to wipe saved heat/wave history.
- Optional outside timer: cron-job.org POST to /repos/OWNER/REPO/actions/workflows/collect.yml/dispatches with body {"ref":"main"} (fine-grained token, Actions: write).
## Notes
Prize pool $300: Top Man $180, Top Woman $75, Top Team $45 (official ISA placements). Rounds show as B01.. until the live feed names them.
Not built: official ISA placement points, predicted prize leaderboards beyond heat averages.
Tests: pip install pytest requests beautifulsoup4; pytest tests
