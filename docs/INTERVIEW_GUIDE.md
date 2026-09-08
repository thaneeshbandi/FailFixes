# Interview guide

Every answer here describes **this** repository as it now stands. Where the
honest answer is "not implemented", it says so — volunteering a limitation before
being asked is worth more than a confident half-truth that gets caught.

---

## 1. Thirty seconds

> "FailFixes is a MERN platform where people publish stories about setbacks
> they've recovered from, follow each other, and chat in real time. React and MUI
> on the front, Express and MongoDB behind, Socket.IO for chat, Redis for
> caching, rate limiting and multi-instance socket coordination, JWT auth with
> real token revocation, and a GitHub Actions pipeline that tests against real
> Mongo and Redis containers. The part I'd want to talk about is the hardening
> pass — I found an authorization bypass in my own cache layer."

---

## 2. One minute

> "A story-sharing and messaging platform. Users publish long-form posts, build a
> follow graph, and message each other.
>
> The backend is a single Node process: Express for REST and Socket.IO attached
> to the same HTTP server, with MongoDB through Mongoose. Auth is JWT — HS256,
> algorithm-pinned, with issuer and audience claims — and the same verification
> path serves HTTP requests and socket handshakes, so a revoked or deactivated
> account can't open a socket either.
>
> Redis does four things: it caches the anonymous story listing, backs the rate
> limiters so limits survive a restart and span instances, holds a shared
> presence counter, and carries the Socket.IO adapter's pub/sub so room
> broadcasts cross instances. All four are optional — without Redis the app runs
> correctly as a single instance.
>
> The frontend is CRA with two React Contexts, one for auth and one for the
> socket, and a single axios instance whose interceptors attach the token and
> handle 401s in one place.
>
> CI runs four parallel jobs on every push, plus CodeQL, with every action pinned
> to a commit SHA."

---

## 3. Three minutes

> **Problem and solution.** People learn more from other people's failures than
> their successes, but there's nowhere built for it. FailFixes is a platform for
> publishing recovery stories, following authors and messaging them.
>
> **Architecture.** Two deployables: a React SPA, and a Node process running
> Express and Socket.IO on one HTTP server, talking to MongoDB with Redis
> alongside. It's a modular monolith — route, middleware, controller, model. No
> service layer, deliberately, and I'd say so rather than dress it up.
>
> **Three decisions I'd defend.** First, my auth middleware does a database read
> on every request, which gives up the usual statelessness of JWTs. That's
> deliberate: it's what makes deactivation and revocation take effect
> immediately rather than at token expiry. Second, rate limits are tiered by
> cost rather than one global number — the AI endpoint gets 20 an hour because it
> proxies a paid model; login gets 10 per 15 minutes because each attempt runs a
> cost-12 bcrypt. Third, updates use a field allowlist rather than
> `$set: req.body`, which previously let any user write `role: admin`, or write
> `password` directly and bypass the hashing hook.
>
> **The bug I'm proudest of finding.** The Redis cache keyed on the URL alone, on
> a route that returns per-viewer fields *and* returns unpublished drafts to
> their author. So an author viewing their own draft populated the cache, and the
> next anonymous visitor got the draft. The cache layer created an access-control
> bypass. The fix was a rule — anonymous requests only, in both directions — plus
> `Vary: Authorization` set unconditionally so a CDN can't reintroduce it.
>
> **The most recent work.** I did a pass to make the code, the docs and the
> behaviour agree. The frontend was calling ten endpoints that didn't exist, and
> the backend shipped five that returned hardcoded empty data. I implemented the
> ones that were real features — user search, read receipts, logout — deleted the
> placeholders, and wrote a contract test that introspects the Express router and
> fails the build if the frontend ever calls something unregistered.
>
> **What I'd fix next.** Chat messages and story comments are unbounded embedded
> arrays, and MongoDB caps a document at 16MB, so that's a hard write failure
> waiting to happen. And the token is in localStorage, which means the control
> that actually matters is a CSP on the frontend origin — that isn't in the repo."

---

## 4. Architecture

**Q: What pattern is this?**
Modular monolith, `route → middleware → controller → model`. Not MVC (no view),
not controller–service (no service layer), not microservices. I'd add a service
layer if the controllers kept growing — `storyController.js` and
`userController.js` are around 1000 lines each, which is the pressure that
justifies it.

**Q: Why are Express and Socket.IO in the same process?**
`http.createServer(app)` then `socketIo(server)` — one port, one deploy, shared
models, and the socket handshake reuses the exact same token verification as
HTTP. The cost is that the process is no longer stateless, which is why the
Redis adapter matters.

**Q: What's the biggest weakness?**
The data model. Unbounded embedded arrays in `Chat.messages` and
`Story.comments`, and two non-atomic writes (`likeStory`, `followUser`).

---

## 5. JWT and authentication

**Q: Walk me from the login form to `req.user`.**
Form → `AuthContext.login` → `POST /api/auth/login` → CORS, 16kb JSON parser,
`authLimiter`, `validateLogin` → controller finds by email or username with
`.select('+password')`, checks `isActive`, `bcrypt.compare` → `signAuthToken`
(HS256, `iss: failfixes`, `aud: failfixes-api`, 2d, plus `tv`) → token to
localStorage. On each later request, `protect` extracts the bearer token, calls
`verifyAuthToken`, loads the user from MongoDB, and runs `checkAccountState`.

**Q: You hit the database on every request. Why bother with a JWT?**
Fair challenge, and the honest answer is that in a single-service app a session
cookie would give the same revocation with less machinery. What the JWT buys is
that the socket handshake and HTTP share one stateless verification, and that a
second service could verify tokens without reaching my user store. The DB read is
the price of immediate revocation, which I decided mattered more than
statelessness.

**Q: A user's laptop is stolen. What happens?**
They log out from another device. `POST /api/auth/logout` increments
`tokenVersion`, which invalidates every token for the account — including on
sockets, since both paths share `checkAccountState`. Changing the password does
the same and returns a fresh token so the acting device stays signed in.

**Q: Doesn't that log out all their other devices?**
Yes, deliberately. Tokens carry no per-session identity — no `jti`, no session
record — so I can't revoke one device without the others. The alternative was a
logout that revokes nothing, which is a control in name only. If I needed
per-device logout I'd add a `jti` and a Redis denylist keyed to the token's
remaining lifetime, or move to refresh tokens.

**Q: Why `algorithms: ['HS256']` on verify?**
Without pinning, a token claiming `alg: none` or a different algorithm could be
accepted — that's the classic algorithm-confusion attack.
`tests/security.test.js` asserts an unsigned token is rejected.

**Q: Is this vulnerable to CSRF?**
No, and the reason matters: the credential is in an `Authorization` header, which
a cross-site form or image tag cannot set, and any cross-origin XHR that tries is
gated by a CORS preflight against the allowlist. `withCredentials` in the axios
instance is vestigial.

**Q: So what *is* the threat?**
XSS. The token is in `localStorage`, so an injected script reads it. The control
that matters is a CSP on the origin serving the SPA — and that's **not in this
repo**. The CSP in `app.js` governs a JSON API that renders no HTML.

---

## 6. Redis

**Q: What is Redis actually used for here?**
Four things, all optional: the anonymous response cache on `/api/stories`
(`cache:anon:*`, 300s TTL); rate-limit counters (`rl:*`); a shared presence and
connection counter (`presence:conn:*`); and the Socket.IO adapter's pub/sub. Not
sessions, not queues — there are none.

**Q: What happens if Redis goes down?**
Nothing fails. Cache reads fall through to MongoDB; the rate-limit store
transparently falls back to an in-memory counter, so limits become per-process
but a request is never rejected because the store is unavailable; presence falls
back to a local map. The one thing that genuinely breaks is multi-instance
broadcasting — which is why that failure is logged as an error, not a warning.

**Q: Explain the cache bug.**
The key was `cache:${req.originalUrl}` with no identity component, on a route
using `optionalAuth` that returns `isLiked`/`isFollowing` per viewer and returns
unpublished drafts to their author. An author opening their draft populated the
cache, and the next anonymous request got it. The fix: cache only fully anonymous
GETs, in both directions, decided on the raw request because the cache runs
before `optionalAuth` populates `req.user`. Plus `Vary: Authorization`
unconditionally.

**Q: Why not cache per user?**
I could key on user id, but cardinality explodes and invalidation gets much
harder. Anonymous traffic dominates a public story site, so the conservative rule
keeps most of the benefit with none of the risk.

**Q: Why `SCAN` and not `KEYS`?**
`KEYS` is O(N) over the whole keyspace and blocks Redis's single-threaded event
loop — a self-inflicted outage on a busy instance.

---

## 7. Socket.IO

**Q: Why Socket.IO rather than REST?**
Chat needs server-initiated delivery. Over REST that's polling — latency I can't
fix and load proportional to users × poll rate regardless of activity. I chose
Socket.IO over a raw WebSocket for reconnection with backoff, the polling
fallback, and rooms, which turn fan-out into `io.to('chat_<id>')`. I kept chat
*reads* on HTTP, where pagination is natural — sockets carry the live delta, HTTP
carries the backlog.

**Q: What stops me joining someone else's chat?**
`authorizeChat` in `utils/socketSecurity.js`. This was a real bug: the handshake
authenticated *who* you were and `sendMessage` checked participation, but
`joinChat` didn't — so any authenticated user could emit `joinChat` with any id
and receive that conversation's messages. A room is a subscription to private
data, so joining one has to be authorized exactly like reading it over REST. Note
it returns the same error for "no such chat" and "not a participant", so it can't
be used to probe which ids exist.

**Q: Can this run on more than one instance?**
Yes, with `REDIS_URL` set. The official Redis adapter carries broadcasts between
processes, and presence plus the per-account connection cap use one shared Redis
counter, so both are cluster-wide rather than per process. It needs sticky
sessions at the load balancer for the polling-to-WebSocket upgrade. Without
Redis it falls back to the in-memory adapter and is correct on one instance only
— and that fallback is logged loudly, because silently running two instances
without it means messages just don't arrive.

**Q: How do you know it actually works?**
`tests/socket.multiinstance.test.js` starts two Socket.IO servers on one Redis,
connects a client to each, and asserts a message sent on one arrives on the
other — plus that the connection cap is cluster-wide and `userOnline` fires once
per account rather than once per connection. It also asserts the adapter is
actually attached, so the suite can't pass by silently testing a single-instance
fallback.

**Q: What about duplicate or lost messages?**
There are no delivery guarantees today: I persist then broadcast, and a crash
between the two loses the notification. For at-least-once I'd have the client
generate a UUID per message, use acknowledgements for retry, make the write
idempotent on that UUID with a unique index, and dedupe on the client. The client
already dedupes on the persisted `_id`, and it re-joins its rooms on reconnect —
that second one was a real bug: a reconnected socket has no room memberships, so
a network blip used to silently stop delivery until a reload.

---

## 8. MongoDB

**Q: Why MongoDB?**
A story is a document with variable metadata and embedded comments that reads and
writes as a unit, and the schema moved a lot during development. Honestly, the
social graph argues the other way: follows are many-to-many maintained as arrays
on both sides *without transactions*, and my counters can drift because of it. In
Postgres that's a join table and one transaction. If I rebuilt it I'd keep
stories in a document store and put the graph in a relational table.

**Q: Embedded or referenced — where did you get it wrong?**
`Chat.messages` and `Story.comments` are embedded and unbounded. MongoDB caps a
document at 16MB, so a very active chat eventually hits a hard write failure, and
before that every operation carries the whole array. The read paths already avoid
that — the chat list projects `messages` away and computes unread counts with an
aggregation, and message and comment pagination use `$slice` inside MongoDB — but
the correct fix is separate collections.

**Q: Two users like the same story simultaneously.**
`likeStory` is a read-modify-write: it loads the document, splices the array in
JavaScript, and saves. Both read the old array and the second write wins — a lost
update, and `stats.likes` drifts from `likes.length`. The fix is one atomic
`$addToSet`/`$pull` with `$inc`. Contrast `trackStoryView`, which is already
atomic, and the read-receipt update I added, which is a single `arrayFilters`
update that's atomic *and* idempotent.

**Q: Show me an index doing real work.**
`{ status: 1, 'stats.likes': -1, 'stats.views': -1 }`. `?sortBy=popular` sorts on
two fields; a two-field index only serves the `likes` prefix and leaves MongoDB
sorting ties in memory — measured at 1800 documents examined for a 9-document
page on a 2000-document set. I check with `.explain('executionStats')`:
`totalDocsExamined` close to `nReturned`, an `IXSCAN` not a `COLLSCAN`, and no
in-memory `SORT` stage.

---

## 9. Node and Express

**Q: What blocks your event loop?**
Two things. `bcryptjs` is pure JavaScript, so unlike native bcrypt it does *not*
use the thread pool — a cost-12 hash blocks. And the regex search over story
content. That's exactly why `/api/auth` has a 16kb body limit and the tightest
rate limit.

**Q: Where does middleware order matter?**
Three concrete places. Body parsers — Express applies the first match, so the
tight route-specific limits are registered before the general one. The
cache-invalidation wrapper — it wraps `res.json`, so it had to move *before* the
routers; mounted after them it never ran at all, and the story cache was only
ever cleared by its TTL. And route declaration order — `/me/*` before
`/:username/*`, so a user named "me" can't shadow the dashboard routes.

**Q: How does Express know your error handler is one?**
Arity — four parameters. That's why there's an `eslint-disable` for the unused
`next` above it.

---

## 10. React

**Q: Tell me about a frontend bug you fixed.**
The chat page called `socket.off("newMessage")` with no handler reference.
`off` with one argument removes *every* listener for that event, so when
ChatWindow's effect re-ran on a chat switch it silently deleted ChatPage's
sidebar listener — the unread badge and last-message preview just stopped
updating for the rest of the session. Both now use named handlers and pass them
to `off`.

**Q: Why is `SocketProvider` inside `AuthProvider`?**
It calls `useAuth()`, and its effect is keyed on `[isAuthenticated, user]` — the
socket opens when a user appears and closes when they leave. Both are outside
`Router`, so the connection survives navigation.

**Q: What would you change about the frontend?**
Introduce React Query. There's no client cache today, so two pages needing the
same stories both hit the network. I'd also memoize the context values — both
providers build a fresh object every render, so every consumer re-renders with
them.

---

## 11. Security

**Q: Explain your mass-assignment defence.**
Allowlist, not blocklist — a field is writable because it's named, never because
it isn't blocked. A blocklist fails open every time the schema grows. It flattens
to dotted `$set` paths, because `$set: { preferences: {...} }` replaces the whole
subdocument and wipes sibling fields. And it rejects any key starting with `$`,
containing a dot, or equal to `__proto__`.

**Q: Is NoSQL injection real?**
Yes, in two forms here. Express parses `?category[$ne]=x` into an object, and
those were being assigned straight into query filters — `asString()` now drops
anything that isn't a plain string. And regex injection: controllers built
`new RegExp('^' + username + '$')`, so `.%2A` matched an arbitrary user and a
backtracking pattern evaluated against every story's content could pin a
database core, unauthenticated.

**Q: What's still wrong, security-wise?**
Three things. The token is in localStorage with no CSP on the frontend origin —
that's the one that actually matters. The password minimum is six characters with
no breach check. And `POST /api/stories/:id/view` is unauthenticated, so view
counts can be inflated within the rate limit.

---

## 12. CI/CD

**Q: What runs on push?**
Four parallel jobs — backend tests against real Mongo and Redis service
containers, ESLint, a frontend test-and-build with a credential scan of the
bundle, and a dependency audit — plus CodeQL on `main` and weekly.

**Q: Why pin actions to SHAs?**
A tag is mutable. Whoever controls the action repository can repoint `@v4` at new
code, which then runs with my workflow's token. A commit SHA can't be repointed.

**Q: How do you stop a secret reaching the browser?**
A build step greps `build/static/js/` for `mongodb+srv://`, Groq and Resend key
shapes, and PEM headers, and fails the job on a match. The underlying rule is that
anything with a `REACT_APP_` prefix is inlined at build time and is public.

**Q: How does code get to production?**
Render's GitHub integration on a push to `main`. **There is no deploy job and no
deployment manifest in the repository** — build command, start command and
environment variables live in the Render dashboard. That's a real limitation and
I document it rather than imply it's automated from the repo.

---

## 13. Testing

**Q: What do you test?**
Mostly security and regression: mass assignment, IDOR, JWT verification and
revocation, injection, cache isolation, socket room authorization, rate limiting,
read receipts, and multi-instance socket propagation. 278 tests across 13 suites.

**Q: Tell me about the test-database guard.**
`.env` and `.env.test` once held a byte-identical `MONGODB_URI` pointing at the
production Atlas cluster, while the suites run `deleteMany()` in `beforeAll`.
Every `npm test` was issuing destructive writes against live data. The guard runs
via Jest `setupFiles` — before any test module loads, so an individual file can't
skip it — and refuses to run unless `NODE_ENV=test`, the host is local, and the
database name contains "test". `mongodb+srv://` is rejected outright, and the
escape hatch is deliberately awkward.

**Q: Anything unusual in the test suite?**
Two things I'd point at. The multi-instance socket test asserts the Redis adapter
is genuinely attached before testing anything else, so it can't pass by
accidentally testing a single-instance fallback. And the route contract test
introspects the Express router stack and includes a self-check that a fake URL
*is* reported missing — otherwise a bug in the matcher would make it pass for
every input and protect nothing.

---

## 14. Scaling

**Q: A million users. What breaks first?**
Nothing in the socket layer any more — that was the first thing, and it's solved
with the Redis adapter and shared presence. After that: `skip` pagination, which
walks and discards every skipped document; the 16MB document cap on embedded
arrays; `readPreference: 'primary'` with a pool of 10; and the feed, which is
fan-out-on-read by username today and would become fan-out-on-write with a
read-time exception for high-follower accounts.

**Q: Would you split this into microservices?**
No, not at this size. The natural seams are the route groups, and chat is the
most separable — it's the only stateful part and scales on a different axis. But
the modules share the User document heavily, so splitting means distributed
transactions for follow, or an eventually-consistent event bus. A modular
monolith is the right answer here — and that's the point at which the JWT would
finally earn its keep, since each service could verify tokens without touching
the user database.

---

## 15. Debugging

**Q: A user says chat stopped working. Go.**
First, is the socket connected? `connect_error` gives one of three messages, and
`Authentication error` is deliberately generic — I'd test the same token against
`GET /api/auth/me`, which returns a specific `code` like `TOKEN_REVOKED`. If it's
connected, did they actually join the room? `joinChats` replies with only the ids
they were authorized for. If they reconnected, rooms are re-joined automatically
now. And if we're running more than one instance, I'd check the startup log says
the Redis adapter attached — without it, rooms are process-local and delivery
depends on which instance each user landed on.

**Q: A 500 in production. What do you do?**
Take the `requestId` from the response — every error body carries one — and find
the matching line in the error log, which has method, url, error name, `userId`
and the stack. The client body is intentionally generic, so the log is the only
place the real message exists.

**Q: Login works locally, fails in production.**
Five causes in likelihood order: `REACT_APP_*` are inlined at build time so a
changed API URL needs a rebuild not a restart; CORS, since localhost origins are
excluded in production; the CRA dev proxy, which only exists in the dev server;
mixed content from an `http://` URL on an `https://` page; and a different
`JWT_SECRET` between environments.

---

## 16. Traps to expect

Things an interviewer may probe. Have the honest answer ready.

| Challenge | Answer |
|---|---|
| "Your README says X" | It doesn't any more — it was rewritten to match the code, and the limitations section is deliberately long. |
| "57% faster?" | Replaced. The old script read the wrong response key and reported zero stories. The current script takes 40 samples, reports median and p95, and verifies `X-Cache-Status: HIT`. Local numbers only, stated as such. |
| "You claim horizontal scaling" | For sockets, rate limits and presence — with `REDIS_URL`, and there's a test proving cross-instance delivery. Not for the database, and sticky sessions are still required. |
| "Do you have a service layer?" | No, and the README says so. Controllers call Mongoose directly. |
| "Docker?" | No Dockerfile in the repo. Docker appears only as CI service containers. |
| "Where's your deploy pipeline?" | There isn't one in the repo. Render deploys on push; its config isn't version-controlled. That's a limitation, not a feature. |
| "Is anything in your API client dead?" | No — and a contract test enforces it by introspecting the Express router. |
| "Role-based access control?" | The `role` field exists and is in the token, but **no route reads it**. There is no RBAC. |
| "What about bookmarks / analytics / email?" | Not implemented. The bookmark field exists with no endpoint; the analytics endpoints were deleted because they returned hardcoded empty objects; email is dead code. |
