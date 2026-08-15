# CPInsight Regression Matrix

| Area | Runtime evidence | Result |
| --- | --- | --- |
| Health/readiness | `/health` and `/ready` returned 200 | PASS |
| Register/login | Temporary real user registered (201) and logged in (200) | PASS |
| Token rotation | Refresh returned 200; reused/revoked tokens returned 401; protected profile returned 200 | PASS |
| Codeforces sync | Real resync completed; 177 submissions, 12 contests persisted | PASS |
| CodeChef connection | Account/profile/rating load; 240 submissions and 7 contests persisted | PASS |
| CodeChef latest full sync | Final sync completed profile, contest, submission, and activity stages | PASS |
| LeetCode | Synced account/API exposes 101 accepted and 101 solved rows | PASS |
| Analytics contract | Combined: 518 submissions, 338 accepted, 327 solved, 19 contests | PASS |
| Analytics cache | Sync removed affected cache rows; next response recomputed version 5 | PASS |
| Dashboard rating data | 19 points retained with `codeforces` and `codechef` identities | PASS |
| Dashboard filtering transform | Real CF+CC API payload merged to 417 submissions and both rating series | PASS |
| Calendar API | Live calendar endpoint returned 200 with contest data | PASS |
| Contest data | Combined contest history and review-job listing returned 200 | PASS |
| Completed contest review | No completed review exists for the account; endpoint truthfully returns 404 | N/A |
| AI runtime | Health 200; two Gemini requests completed | PASS |
| General AI question | Real response generated and persisted | PASS |
| Personal AI question | Real response used 82 retrieved evidence items and persisted | PASS |
| Conversation persistence | Create/write/get/list/search passed; zero duplicate message orders | PASS |
| Study planner | Built from live analytics with completed status, five daily and seven weekly items | PASS |
| Avatar persistence | Uploaded image remained available across API recreation | PASS |
| Frontend static resources | Dashboard, analytics, calendar, contests, AI page and bundles returned 200 | PASS |
| Frontend build | `npm run build:frontend` completed | PASS |
| Backend tests | Syntax plus five contract tests passed | PASS |
| Real browser UI | Browser control cannot navigate/reload localhost; Chrome extension is unavailable | FAIL (environment) |

No UI-only item is promoted to PASS from build or API evidence. Dashboard/analytics visual rendering, browser refresh, conversation switching by click, keyboard interaction, and streaming presentation require a reachable real browser session.
