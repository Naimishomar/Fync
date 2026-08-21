# What the app actually does

Extracted from `client/components/**` — the source of truth for every mockup in `screens/`.
Written down because the first cut of these mockups invented features that do not exist
(a Google sign-in, a 12-tool utility hub, per-subject attendance), and inventing UI for
functionality nobody built is worse than no mockup at all.

**Rule for this folder: if a control is not in this file, it does not go in a screen.**

---

## Auth

| Screen | Reality |
|---|---|
| **Login** | Fields: *Email or username*, *Password* (with eye toggle). `Forgot Password?` link. `Login` button. "Don't have an account? Signup". Then a separate **"Other ways to join"** block: `Join as Alumni`, `Join as Recruiter`. |
| **Signup** | Fields: *Email*, *Username*, *Phone Number*, *Password*. Terms checkbox → `TermsAndCondition`. Button is **`Send OTP`** → `/user/send-email-otp`. An OTP field (*Enter OTP (Check your email)*) then appears, verify → `ProfileSetup1`. |
| **Profile setup 1** | *Full Name*, *Birthday* (date), then four dropdowns: **Gender, College Name, Your Major, Passout Year**. College picker has its own search sheet ("Search college…"). `Continue`. |
| **Profile setup 2** | *Upload Profile Photo*. |

**There is no Google, GitHub or any OAuth anywhere in the app.** There is no magic-link
"send me a code to your college email" flow — the code is an OTP, and it is sent *after*
a password has already been chosen.

Three account types exist: **student**, **alumni**, **recruiter** (`AlumniSignup.tsx`,
`RecruiterSignup.tsx`, `RecruiterTabLayout.tsx`).

---

## Shell

**Bottom tabs (5):** Home · Shorts · **[+ FAB]** · Explore · You.
The FAB expands to exactly three: **Add Post**, **Add Shorts**, **Add Startup**.

**Home header:** avatar → profile · `Hi, {firstName}` (no college/year line) · streak pill
(flame + count, opens the streak leaderboard modal) · **search** · **heart** (notifications,
orange badge, caps at `9+`) · **chat** (pink badge, caps at `9+`).

**Home tabs: `For You` / `Following` only.** Two, split full width, half-width underline.
There is no "My college" tab.

**Home body:** a 4-wide **feature quick-grid** with `View More` / `Show Less`, an ad carousel,
then the feed.

**Post card:** author + `·` + time, `…` menu (→ *Delete Post* / *Report Post*), body, image,
then a Reddit-style action row: a **vote pill** (up arrow / score / down arrow — the score
reads **`Vote`** when it is 0), a **comment pill** with count, and a **`Share`** pill that
carries the word. Comments open in a sheet with reply-to-user and *Add a comment…*.

---

## Feature vocabulary (real labels, verbatim)

The shipped app speaks in a systems/telemetry register — *Protocol, Intel, Registry,
Transmission, Signal, Archive, Hub*. Screens use those words.

| Feature | What it actually is |
|---|---|
| **Focus Mode** | A **Forest**, not a Pomodoro. *Minutes to Focus* → `Plant a Tree` → *Lockdown Active* → `Claim Tree` / `Give Up`. Stats: **Trees Grown, Total Mins, Withered**. Modes: Working / Studying / Creating. |
| **BunkOMeter** | Three inputs — *Attended*, *Total Held*, *Target Percentage (%)* — then `Execute Analysis`. Output is one **Attendance Score** against a 75 threshold. No per-subject list. |
| **Utility Hub** | **Exactly three tools**: Image to PDF, Image Compressor, QR Generator. |
| **Study Assistant** | Query box (*Query the intelligence…*), *Analyzing Intel…*, cited **Source** chips, `Generate Protocol Guide`. |
| **Study Material** | Google-Drive browser: *Current Path* breadcrumb, filters **All / Folders / PDFs**, search. |
| **Fync Academy** | *The Infinite Tech Protocol*. Fync Search, **PDF Only** toggle, `Start Learning`. Tracks: Interview Prep, FAANG Prep, DSA Prep. |
| **Internships / Jobs** | *Professional Opportunity Archive*. Tabs **Market Registry / Shortlisted**. Detail = *Protocol Details*, *Monthly Stipend* (internships) or *Capital Package* (jobs). Apply flow: **Review Application → Candidate Verification (Master Resume + Fync Portfolio Sync) → Confirm Application**. |
| **Workshops** | *Industry Masterclass Archive*. *Registration Ends*, `Access Portal`. |
| **Paid Gigs** | *Freelance Work Protocol*. Tabs **College / Global / Mine**. Fields: Requirement Heading, Transmission Intel, **Stipend Allocation**, Visible Radius (Campus Only / Global Unit). `Initiate Contact`. |
| **Placement Hub** | *Corporate Intelligence Unit*. Four tools: **Predictor, AI Resume Scan, Mock Sync, Strategic Targets**. Plus a crowd-sourced **interview intel ledger** filed by company (Google, Amazon, Microsoft, Meta, Apple, Netflix), role and round. |
| **Placement Predictor** | Inputs CGPA + resume PDF → `Generate Prediction`. Report: **Placement Probability, ATS Friendliness, Est. Market Value (INR), Suggested Roles, Target Companies, Strengths, Areas to Improve, Roadmap**. |
| **Profile Builder** | Tabs **Overview / Projects / Work / Certs**. *Profile Completeness*, *Max Streak*, *Coding Profiles*, `Boost Score`, Resume/CV (PDF), Core Skills & Stack. |
| **Hackathons** | Hub: tabs **Discover / My Hackathons**, filters **All / Live / Upcoming / Judging / Ended / Draft**, `Host a hackathon`. Detail: My Team, Organiser, Prize Pool, Rules, Colleges, Team size, Judges, Announcements, Discord. Also **Team screen** (Create/Request to Join, Open/Closed), **Submission** (Tagline, Tech Stack, GitHub, Demo, Attachments, Save Draft / Submit), **Judge Panel** (Weighted Total), **Leaderboard**, **Organizer Console**. |
| **Bootcamps** | *Intelligence Archive*. Multi-day with a **QR Ticket Scanner**, attendance tracker, `My Passes`, Student Limit, Fee (INR). |
| **Speaker Sessions** | *Intelligence Archive*. Add Speaker, Start/End Phase, Capacity Protocol, Monetization, Network Hub. |
| **Contests** | *Arena*. Problem view with **Input/Output** samples, `Run Code`, `Submit`, timer, Global Leaderboard. |
| **1v1 Battle** | *Arena — select your combat domain*: **DSA, Frontend, Backend, System Design, DevOps, Cyber Security**. `Locate Rival`, Global Aces, Abort Protocol. |
| **Create Quiz Room** | *Initialize Custom Node*: Select Specialization, **Capacity (Members)**, **Duration (Minutes)**, Execution Time, `Finalize Node`. |
| **Join Quiz Room** | A **6-digit** room code (`000000`), `Initialize`. |
| **Coding Leaderboard** | **LeetCode only**, and it is gated: *Verification Required* → `Link Profile & Enter` with a LeetCode username. Ranks, `Load Fresh`, *Next Sync*. Profile sheet: Total / Easy / Med / Hard, Contest Rating, Activity Snapshot, Recently Mastered. |
| **Shadow Rival** | **One** anonymous match, *revealed at semester end*. Race on three metrics: **Problems Solved, Commits Pushed, Day Streak**. `Reroll Shadow`, `Opt Out`. No notifications. |
| **Campus Alumni** | *Professional Alumni Registry*. Filter sheet by **Batches**, `Wipe Filter` / `Apply Filter`. |
| **Alumni Connect** | Batch-only chat: *Batch Members*, "Message your batch…". Alumni access only. |
| **Professional Hub** | *STUDENT-ALUMNI* room, "Ask alumni anything…", mentorship file upload (limit 5 MB). |
| **Find Teammate** | *Build your dream team today*. Tabs **Global / Campus**. Search by skill. `Chat`. |
| **Community Hubs** | Paid hubs. Tabs **All / Joined / Created**. Tiers **Spark (₹99) / Eternal (₹999)**, Monthly / Yearly. Roles: **Guardian**, Subscribed. Sub-rooms ("Linked Sectors"), feed sorted **Hot / New / Top**. |
| **College Clubs** | *Secure Community Network*. Join by **6-digit code** or request clearance. Sub-rooms, polls in room chat, announcement-only mode, admin control panel. |
| **Startup Feed** | *Innovation Hub*. `Connect`, community discussion thread. Created from the FAB (**Add Startup**). |
| **Fync Media** | *Broadcast Archive & News*. Video + thumbnail + tags, comments with replies. |
| **College Chat** | Campus-wide room, **vanishes every 24h** — "Vanish every 24h • Keep it real", with an *Expires In* counter. |
| **Notice Board** | *Announcement Protocol*. Tabs **Campus / Global**. Official posts with attachments and a discussion log. |
| **Campus OLX** | *Campus Asset exchange*. Listings ("artifacts") with Valuation (INR), condition, **In Stock**, Seller Information, `Chat with Seller`. |
| **Lost & Found** | *Asset Recovery Protocol*. Tabs **Lost Assets / Found Units**. Report with Identification, Location Coordinates, Visual Evidence. `Contact Owner`, `Update Status` → Resolved. |
| **Rewards Store** | *Spend Your Fync Coins*. **Balance**, Stock Out state, Checkout: Shipping Destination, Mobile Comms, Zip Code, Delivery Node, `Authorize Redemption`. |
| **Fync Store** (affiliate) | Curated affiliate products, category search, `Buy Now` → secure webview checkout → `I've Purchased`. |
| **Party Pool** | *Campus Social Hub*. **Eight** games: Trivia Survival, Bottle Spin, Fync Chess, Antakshari, Coin Toss, Reaction Master, Flappy Bird, Draw & Guess. |
| **12 AM Club** | **Random 1-to-1 stranger chat**, not a feed. *Doors Open At Midnight* / `LOCKED` until then. "Searching for souls…", *Unknown Soul* / *Stranger*, `Next ➔`. |
| **Confessions** | Anonymous confession feed + encrypted comment threads. Separate from the 12 AM Club. |
| **Audio / Video Rooms** | One shared lobby: **Rooms**, *Online now* / *Nobody online*, incoming call = *Ringing…* with `Accept` / `Decline`. |
| **Entertainment** | TMDB-backed. Trending, category rows, Movie detail (`Play Trailer`, Overview, More Like This), **Trailer Reels**, **Watchlist**. |
| **Fync AI Interview** | Target Role / Domain, Years of Experience, **Duration & Price**, Resume (PDF) → `Start Interview` → paid checkout. Interviewer is **"Laura AI"**. Result: Technical / Soft Skills scores, Detailed Summary, `Download Report PDF`. |
| **Notifications** | *System & Social Logs*, "Recent transmissions", empty = "No active signals found in the registry." |
| **Chat list** | **Dedicated Channels** (Student-Alumni Chat → Professional Hub, marked **PRO**) above *Recent transmissions*. |
| **Search** | *Global Campus Directory* — people only. Recent Registry Lookups with `Wipe Data`. |
| **Profile** | Posts / Followers / Following. **Score**, **Portfolio**, **Education**. Coding stats are entered manually: LeetCode problems + rating, GFG problems + score, CodeChef username + problems + rating. GitHub + LinkedIn links. Subscription state (**Plan Expired**, `Renew`, `Extend`), Payments, Clear Cache, Logout. |
| **Subscription** | **Fync Premium / Pro** — "Full Access Pass". |
| **Admin Portal** | Password gate. Pending Reports, Total Redemptions, System Health, **Global Price Engine** (Enable Subscriptions, Configure New Rate INR), **Global Broadcast** (title, body, image, preview), redemption history. |
| **Recruiter Portal** | Applicant tracking: Active Posts, New Applicants, tabs Internships / Jobs / My Posts. Per-applicant: **GitHub Stats Preview** (Verified, Commits, Stars, Streak), Note/Pitch, Resume, Portfolio, `Shortlist` / `Approve` / `Remove`, Copy / Gmail / Notify. |
| **Contact Us** | Operator Identity, Signal Frequency (Phone), Digital Ledger (Email), Transmission Content, Visual Evidence (max 3), `Deploy Transmission`. HQ: **KIET Deemed University, UP**. |
| **Meet Our Team** | Four people: Naimish Omar, Anand Kumar Singh, Pranjali Nagpal, Meghna Chaudhary. |

---

## Things the first cut of these mockups invented — now removed

- Google / GitHub OAuth on the auth screen, and a magic-link "send me a code" flow
- A third `My college` home tab
- A campus-stats ticker strip on Home
- A 12-tool Utility Hub (there are three tools)
- Per-subject attendance in BunkOMeter (it is one calculator)
- 12 AM Club as an anonymous feed (it is random 1-to-1 stranger chat)
- Codeforces on the coding leaderboard (LeetCode only)
- Bookmarks / save on post cards
- Escrow badges, proposal counts and gig ratings that no screen renders
