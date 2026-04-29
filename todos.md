# todos

## testing

### backend (`backend/tests/`)
- [ ] set up pytest + httpx async test client, conftest with test DB
- [ ] `test_bongs.py` — submit bong, list bongs, get bong, filter by submitter/subject
- [ ] `test_bongs.py` — submit with no mentions returns 400, unknown subject returns 404
- [ ] `test_bongs.py` — cosign, duplicate cosign returns 409, remove cosign
- [ ] `test_users.py` — create user, duplicate google_id/email/display_name returns 409
- [ ] `test_users.py` — update display name, taken display name returns 409
- [ ] `test_leaderboard.py` — leaderboard returns correct rankings, bong of the period
- [ ] `test_llm.py` — mock the Anthropic client, test judge_stream parses score/tier/verdict correctly from output

## refactors

### backend
- [ ] service layer — `backend/app/services/`
  - `bong_service.py` — extract submit logic, judge flow, bong_read mapping out of routes
  - `user_service.py` — extract user creation/update logic
- [ ] repository layer — `backend/app/repositories/`
  - `bong_repo.py` — consolidate repeated `selectinload` query pattern (used in 3 places), filter query building
- [ ] routes become thin HTTP handlers — only request/response, delegate everything to services

### frontend (verify manually — no automated tests)
- [ ] API client — `frontend/lib/api.ts` — typed functions for all fetch calls, no more inline fetch in components
- [ ] custom hook — `frontend/hooks/use-bong-feed.ts` — pull SSE management, filter state, cosign state, and data fetching out of `BongFeed`
- [ ] `BongFeed` becomes a dumb presentational component after hook extraction
- [ ] move `timeAgo` to `frontend/lib/utils.ts`
- [ ] consider splitting `renderTokens` into its own `OffenseText` component
