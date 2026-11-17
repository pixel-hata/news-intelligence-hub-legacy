# Submission

## Event Metadata

- Event: AI-Skills prompt engineering competition
- Project: UA-Skills News Intelligence Hub
- Start date: 25 травня 2026
- End date: 12 червня 2026
- Prize pool: 5 000 USD

## Submission Format

The local event page allows a private Git repository on GitHub, GitLab, or Bitbucket. The visible final submission form asks for a GitHub link and reviewer access for `https://github.com/skills-reviewer`.

Use this repository as the private GitHub submission target. Keep a meaningful commit history and avoid rewriting it into one final state.

## Final Checklist

- Private GitHub repository exists.
- All source code is pushed.
- `.env` is created from `.env.example`.
- `docker compose up -d --build` starts the full stack.
- Frontend is reachable.
- Must features pass the acceptance walkthrough.
- Optional Flutter Android app builds from `apps/mobile`.
- Demo data is loaded automatically by the Compose `seed` service.
- Queue monitor opens at `/admin/queues` with credentials from `.env`.
- `.env.example` documents all required variables.
- README contains run instructions and ADR.
- `skills-reviewer` has read access.
- Repository URL is submitted through the event form.

## Pre-Submit Commands

```bash
git status --short
git log --oneline -5
git remote -v
npm run lint
npm run typecheck
npm test
npm run build
cd apps/mobile
flutter analyze
flutter test
flutter build apk --debug
git push origin main
```

Before sending the form, verify that the repository is private, add
`skills-reviewer` with read access, and submit the final GitHub URL.
