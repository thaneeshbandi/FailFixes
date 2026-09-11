# Debugging runbook

Project-specific procedures. Every scenario names real files and real signals.

**Start here, always:**

1. **Status code** — tells you which layer refused.
2. **The `code` field** in the JSON body — tells you which check inside that
   layer refused.
3. **The `requestId`** — present in every error response as `requestId`, in the
   `X-Request-Id` response header, on the morgan access-log line, and in the
   server-side error log. It is how you join a user's report to a stack trace.

---

## Status code → meaning in this codebase

| Status | Means | Open |
|---|---|---|
| 400 | `errors[]` ⇒ express-validator · `FORBIDDEN_FIELDS` ⇒ non-allowlisted field · `INVALID_ID` · `INVALID_JSON` | `middleware/validation.js`, `utils/allowedUpdates.js` |
| 401 | Read `code`: `NO_TOKEN`, `TOKEN_EXPIRED`, `INVALID_TOKEN`, `USER_NOT_FOUND`, `TOKEN_REVOKED` | `middleware/auth.js`, `utils/token.js` |
| 403 | Authenticated but not permitted: not the author, not a participant, `ACCOUNT_DEACTIVATED`, or acting on an unpublished story | the controller's ownership check |
| 404 | No such route **or** no such resource **or** deliberately hiding a resource you may not see (drafts, chats) | route file, then controller |
| 409 | `DUPLICATE_KEY` — email or username taken | `errorhandler.js` |
| 413 | Body over that route's limit | `app.js` body-parser block |
| 429 | `RATE_LIMITED_AUTH` / `_AI` / `_WRITE` / `_SEARCH` / `RATE_LIMITED` | `middleware/rateLimit.js` |
| 500 | Body is deliberately generic — **the real message is in the server log** | error log, keyed by `requestId` |
| 503 | `DB_UNAVAILABLE` or `AI_UNAVAILABLE` / `AI_BUSY` | `utils/database.js`, `siController.js` |
| 502 / 504 | `AI_FAILED` / `AI_TIMEOUT` | `siController.js` |

---

## 1. The backend will not start

**Symptom** — process exits immediately, no startup banner.

1. **Read the last lines before exit.** `Invalid configuration — refusing to
   start` is `config/env.js`: `JWT_SECRET` missing, <32 chars, a known
   placeholder, or fewer than 8 distinct characters; or `MONGODB_URI` missing or
   not matching `mongodb(+srv)://`.
2. **`Max connection attempts reached`** — `utils/database.js` gave up after 5
   tries at 5s. Go to §3.
3. **`EADDRINUSE`** — `lsof -i :5000`.

**Prove without printing the secret:**
`node -e "console.log((process.env.JWT_SECRET||'').length)"`

---

## 2. The frontend will not start or renders blank

1. **Console first.** A render-time throw is now caught by `ErrorBoundary`
   (mounted in `App.js`), so you should see its fallback rather than a white
   page. A white page means the crash is above the boundary — in `ThemeProvider`,
   `AuthProvider` or `SocketProvider`.
2. **`useAuth must be used within an AuthProvider`** — a component escaped the
   provider tree in `App.js`.
3. **`npm ci` fails with "not in sync"** — Node/npm version. `engine-strict=true`
   in `frontend/.npmrc` requires Node 22.x with npm 10.9.x; npm 11 resolves
   optional peers differently and rewrites the lockfile. Check `node -v`.

---

## 3. MongoDB connection failure

**Symptom** — retry logs every 5s then exit; or live traffic returns 503
`DB_UNAVAILABLE`.

1. Is `MONGODB_URI` set and well-formed?
2. Is the host reachable — local `mongod` running, or Atlas IP allowlist current?
3. Credentials correct?
4. `mongoose.connection.readyState`: `0` disconnected, `1` connected,
   `2` connecting, `3` disconnecting. `utils/database.js` exports `healthCheck()`
   returning exactly this.

The driver message is **deliberately not** sent to clients (it can contain the
replica-set host), so you must read the server log.

---

## 4. Redis connection failure

**Symptom** — usually none. Redis is optional by design.

1. `GET /api/health` → `cache.status` is `disabled` (no `REDIS_URL`),
   `connected` (with a ping time), or `error`.
2. Per response: `X-Cache-Status` is **absent** when Redis is down, versus
   `BYPASS` when the request merely carried credentials.
3. Log lines: `Redis URL not provided`, `Redis connection failed`,
   `Max reconnection attempts reached` (after 10 tries).

**What degrades:** caching off; rate limits fall back to per-process; presence
falls back to per-process. **What breaks:** nothing — unless you are running more
than one instance, in which case see §16.

---

## 5. CORS error

**Symptom** — the browser console says the response is blocked, but the Network
tab shows the request **completed** (often 200).

That distinction is the diagnosis: `config/cors.js` calls `callback(null, false)`,
which omits the CORS headers rather than rejecting. The server ran the handler;
the browser blocked the read.

1. Compare the exact `Origin` against `PROD_ORIGINS` + `FRONTEND_URL` +
   `CORS_ORIGIN` in `config/cors.js`. Scheme and port count.
2. In production, `DEV_ORIGINS` are excluded — a localhost frontend against the
   deployed API is expected to fail.
3. Outside production the server logs `CORS: refused origin <x>`. **No such line
   means your problem is not CORS.**

---

## 6. Login fails

1. **Did the request leave, and to where?** `REACT_APP_API_URL` is inlined at
   build time. Note `services/api.js` defaults to port 10000 while
   `AuthContext.js` defaults to 5000 — with the variable unset the two disagree.
2. **429** — the auth limiter (10 / 15 min). With Redis, restarting no longer
   clears it; `redis-cli DEL "rl:auth:ip:<addr>"`.
3. **400** — validation. The body must be `{ identifier, password }`;
   `identifier` is email *or* username, not `email`.
4. **401** — credentials. The server log line `Failed login for account: <x>`
   means the account **was** found and the password did not match.
5. **403** — `isActive: false`.
6. **On success** — confirm `ff_token` in Application → Local Storage, then that
   the next request carries `Authorization`.

---

## 7. Signup fails

- **400 with `errors[]`** — name 2–50, valid email, username 3–20
  `[a-zA-Z0-9_]`, password ≥6.
- **400 "Email already registered" / "Username already taken"** — the explicit
  pre-checks in `authController.register`.
- **409 `DUPLICATE_KEY`** — a request that raced past those checks into the
  unique index.
- Registration returns **no token** by design. The UI must send the user to
  `/login`.

---

## 8. A request returns 401 that used to work

1. `code: TOKEN_REVOKED` — **someone logged out or changed the password.** That
   bumps `tokenVersion` and invalidates every token for the account. This is
   expected behaviour, not a bug (see ARCHITECTURE §4).
2. `code: TOKEN_EXPIRED` — older than `JWT_EXPIRE` (2d), or server clock skew.
3. `code: INVALID_TOKEN` — `JWT_SECRET` changed on the server (a redeploy with a
   different value invalidates everything), or wrong `iss`/`aud`.
4. `code: USER_NOT_FOUND` — the account was deleted.
5. Decode the payload at jwt.io — **it is not secret** — and compare `exp`,
   `iss`, `aud` and `tv` against `user.tokenVersion` in the database.

---

## 9. A request returns 403

- Story write → you are not `story.author`.
- Chat read → you are not in `chat.participants`.
- Like/comment → the story is not `published`.
- `ACCOUNT_DEACTIVATED` → `isActive: false`.

Note that **drafts and chats answer 404, not 403**, deliberately. A 404 where you
expected 403 is usually this, not a missing route.

---

## 10. A request returns 404

1. **Is it the route or the resource?** The catch-all handler returns
   `code: NOT_FOUND` and, in development, the full endpoint catalogue. A
   controller-generated 404 has a specific message (`Story not found`).
2. `backend/tests/routes.contract.test.js` asserts every URL the frontend can
   call is a registered route. If you added a client call and it 404s, that test
   should be failing — run it.
3. Route **order** is load-bearing: `/author/:authorUsername` and `/:id/view` are
   declared before `/:id`; `/me/*` and `/search` before `/:username/*`.

---

## 11. A request returns 400 you did not expect

- `code: FORBIDDEN_FIELDS` — you sent a field outside the allowlist in
  `utils/allowedUpdates.js`. The whole request is rejected; nothing partial
  applies. The `fields` array names the offenders (capped at 20).
- `code: EMPTY_UPDATE` — every field you sent was allowlisted away.
- `errors[]` — express-validator. Note `value` is **omitted** for
  password-family fields by design.

---

## 12. A request returns 500

The client body is intentionally generic. **The real message is server-side.**

1. Take the `requestId` from the response body.
2. Find `❌ Server error { requestId: ... }` in the log — it carries method, url,
   status, error name, `userId`, and the stack.
3. Outside production the response also carries a `debug` field with the message
   (never a stack — stacks disclose filesystem paths).

---

## 13. The socket will not connect

**Symptom** — console shows `Socket connection error: <message>` from the
`connect_error` handler in `SocketContexts.js`.

1. **`Authentication error`** — deliberately one message for every cause (bad
   token, expired, revoked, deactivated, deleted). Check the token exists in
   localStorage *at the moment the effect runs*; then test it over HTTP against
   `GET /api/auth/me`, which gives you a specific `code`.
2. **`Too many connections`** — 8 sockets already open for this account,
   **across all instances**. Leftover tabs, or an effect re-running without
   cleanup. Check `redis-cli GET presence:conn:<userId>`.
3. **Anything else** — transport. `SocketContexts.js` derives the socket URL by
   stripping a trailing `/api` from `REACT_APP_API_URL`, so a malformed value
   produces a wrong host silently. The origin must also be in the **same**
   allowlist the REST API uses.
4. In the Network tab, filter **WS**: expect a `/socket.io/?EIO=4` polling
   request followed by **101 Switching Protocols**.

---

## 14. The socket connects but events do not arrive

Connection and subscription are different failures.

1. **Did you actually join?** `joinChat` replies `chatJoined`; `joinChats`
   replies `chatsJoined` listing **only the ids you were authorized for**. A
   missing id means you are not a participant.
2. **Did an `error` event arrive?** The server reports `RATE_LIMITED`,
   `INVALID_PAYLOAD`, `CHAT_NOT_FOUND`, `FORBIDDEN`. `SocketContexts.js` logs
   these — check the console.
3. **Did the socket reconnect?** Compare `socket.id` before and after. Rooms are
   re-joined automatically now (`joinedChatsRef` in `SocketContexts.js`); if that
   re-join is failing you will see no `chatsJoined` after the reconnect.
4. **Are you running more than one instance without `REDIS_URL`?** See §16.

---

## 15. Messages appear twice

1. **Duplicate listeners.** In the console: `socket.listeners('newMessage').length`
   should be small and constant. If it grows on every chat switch, an effect is
   registering without cleaning up.
2. **The historical cause** was `socket.off("newMessage")` with **no handler
   reference**, which removes *every* listener for the event — ChatWindow's
   cleanup destroyed ChatPage's sidebar listener. Both now use named handlers
   (`handleNewMessage`, `handleSidebarUpdate`) and pass them to `off`. If you add
   a listener, follow that pattern.
3. **Rendering** is de-duplicated on `message._id` in `ChatWindow`, so a genuine
   duplicate delivery does not produce a duplicate bubble.

---

## 16. Two instances, messages not delivered

**Symptom** — chat works for two users sometimes and not others, depending on
which instance each landed on.

1. Check the startup log. `Socket.IO: Redis adapter attached` means multi-instance
   broadcasting is on. `no REDIS_URL — running single-instance` or
   `Redis adapter unavailable` means **it is not**, and rooms are process-local.
2. Confirm the load balancer has **sticky sessions**. Without them the
   polling→WebSocket upgrade can land on a different process and the handshake
   fails intermittently.
3. `backend/tests/socket.multiinstance.test.js` reproduces the working case
   locally with two servers on one Redis.

---

## 17. The unread badge is wrong

1. The count comes from an aggregation in `chatController.getChats`: messages not
   sent by you and whose `readBy` lacks your id.
2. The write side is `PUT /api/chats/:chatId/read`
   (`chatController.markChatRead`). If the badge never clears, check that call in
   the Network tab — it previously 404'd because the route did not exist.
3. It is idempotent — a second call adds no duplicate receipt.
4. It deliberately does **not** touch `updatedAt`, because `getChats` sorts by
   it. If opening a chat starts reordering your sidebar, someone removed
   `timestamps: false` from that update.

---

## 18. The cache is stale

1. **Confirm it is the cache:** `X-Cache-Status: HIT`.
2. Did the invalidation wrapper run? It fires only on a **2xx** whose
   `originalUrl` contains `/stories` or `/users`, and it is fire-and-forget.
3. In development: `GET /api/cache/stats`, `DELETE /api/cache/clear`.
4. The TTL bounds it at 300s. A stale entry outliving that means the bug is in
   the TTL, not invalidation.
5. Entries are per **exact URL including query string** — `?page=2` is a separate
   key.
6. If a *logged-in* user sees another user's data, that is far more serious than
   staleness — `cache.security.test.js` covers it; run it.

---

## 19. Rate limiting fires when it should not

1. The `code` says which limiter: `RATE_LIMITED_AUTH`, `_AI`, `_WRITE`,
   `_SEARCH`, `RATE_LIMITED`.
2. `RateLimit-*` response headers show the remaining budget and reset.
3. Keys are `rl:<prefix>:<ip:addr|u:userId>`. Inspect with
   `redis-cli KEYS 'rl:*'`, clear one with `redis-cli DEL 'rl:auth:ip:1.2.3.4'`.
4. **Everyone limited at once?** `trust proxy` is probably not taking effect, so
   every request looks like it comes from the proxy's IP. Check
   `app.set("trust proxy", 1)` and that the platform sets `X-Forwarded-For`.
5. In tests, limiting is skipped unless `ENABLE_RATE_LIMIT_TESTS=true`.

---

## 20. A query is slow

1. Measure: `X-Response-Time` is the server-side figure.
2. In `mongosh`, re-run with `.explain('executionStats')`:
   - `totalDocsExamined` vs `nReturned` — should be close.
   - Winning stage `IXSCAN`, not `COLLSCAN`.
   - **No in-memory `SORT` stage** — its presence means the index does not cover
     the sort, which is what the three compound Story indexes were added to fix.
3. Known slow paths: regex search over `content` (unindexed by nature), deep
   `skip` pagination, and any endpoint that `populate`s.

---

## 21. The frontend does not update after a successful write

There is no client-side cache, so the cause is one of:

1. The component never re-fetched after the mutation.
2. State was set from a stale closure — use `setX(prev => …)`, especially inside
   socket callbacks.
3. The response shape differs from what the component reads. Keys are **not**
   uniform: `{ stories }`, `{ story }`, `{ profile }`, `{ chats }`, `{ users }`.
   This is exactly what the old benchmark script got wrong.

---

## 22. Works locally, fails in production

In likelihood order:

1. **Environment variables.** `REACT_APP_*` are inlined at **build** time —
   changing one requires a rebuild, not a restart.
2. **CORS.** `DEV_ORIGINS` are excluded when `NODE_ENV=production`.
3. **The CRA dev proxy.** `"proxy"` in `frontend/package.json` works only in the
   dev server; a relative URL that works locally 404s in production.
4. **Mixed content.** An `http://` URL from an `https://` page is blocked.
5. **A different `JWT_SECRET`** between environments.
6. **Redis present locally, absent in production** — or vice versa. Check
   `GET /api/health`.

---

## 23. GitHub Actions fails

- **`backend-lint`** — run `npm run lint` locally; it is blocking by design.
- **`backend-test`** — CI uses a fresh `failfixes_test` database and a Redis
  service container. Note `--maxWorkers=1`: the suites share one database, so a
  test that leaks state breaks its neighbours. Redis-dependent suites self-skip
  when no Redis is reachable — if they skipped in CI, the service container did
  not come up.
- **`frontend-build`** — either a genuine compile error, a failing frontend test
  (these now run), or the **credential scan** matched a credential-shaped string
  in the bundle. The last one is not a false alarm to wave through.
- **`npm ci` "not in sync"** — Node/npm version; see §2.
- **`dependency-audit`** — the backend job is blocking; the frontend job ends in
  `|| true` on purpose.

---

## 24. Deployment fails

**Not fully diagnosable from this repository** — there is no deployment
configuration here (see ARCHITECTURE §11). Check Render's build and deploy logs.

Predictable causes:

1. **A missing environment variable.** `config/env.js` prints
   `Invalid configuration — refusing to start` and exits 1; the platform reports
   this as a crash loop.
2. **Node version** on the build host.
3. **Health check path** — both `/health` and `/api/health` return 200 without
   auth.
4. **SIGTERM handling** — the server closes the HTTP listener, then the socket
   layer's Redis connections, then Mongo. Sockets are disconnected **before**
   those Redis connections close, so presence counters are decremented; reversing
   that order leaves accounts stuck "online" until their 12h TTL.

---

## 25. Memory grows over time

Three in-process maps, two already bounded:

1. `userViewCounts` (`storyController.js`) — swept every 500 writes, 1h expiry,
   10,000-entry cap. Internals exported as `__viewCountsInternals` for tests.
2. Presence counters — in Redis, with a TTL, when `REDIS_URL` is set.
3. Socket listeners that are never removed — see §15.

Measure rather than guess: `GET /api/health` returns `process.memoryUsage()`.
Watch `heapUsed` across a load test; take snapshots with `node --inspect` if it
climbs monotonically.

---

## 26. High CPU

Two candidates, and they are the two things that block the event loop:

1. **bcrypt at cost 12** under a login flood. `bcryptjs` is pure JS, so unlike
   native bcrypt it does **not** use the thread pool. Mitigated by `authLimiter`
   and the 16kb body limit on `/api/auth`.
2. **Regex search** over story content — escaped and length-capped, so not
   ReDoS, but still a full scan.

Profile with `node --cpu-prof`; correlate with the morgan access log.

---

## 27. Suspected race condition

The three known ones (all documented as limitations):

1. **Concurrent likes** — `likeStory` is read-modify-write.
2. **Concurrent follows** — check-then-act plus two updates, no transaction.
3. **Double view counts** — both `POST /:id/view` and `getStoryById` increment.

Reproduce with `Promise.all` over ~20 identical requests, then assert the
invariant: `stats.likes === likes.length`,
`stats.followersCount === followers.length`. Divergence proves it.
