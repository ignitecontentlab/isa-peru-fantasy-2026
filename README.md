# ISA Peru 2026 Fantasy
1. Upload ALL files to the repo root (create .github/workflows/collect.yml and pages.yml by typing the full path in GitHub's "Create new file").
2. Delete old data/heats.json, data/waves.json if present (old round keys).
3. Settings > Pages > Source: GitHub Actions. Settings > Actions > Workflow permissions: read and write.
4. Actions > collect > Run workflow; check data/health.json.
Rounds show as B01, B02... until the live feed reveals the real name (data/round_names.json; you may edit it).
Not built yet: predictions, ISA placement points, draft board, photos.
Tests: pip install pytest requests beautifulsoup4; pytest tests
