# VibeStartup: the audit before the 2027 redesign

What the site is, what works, what is a demo and what it claims, read from the repository at `cfea236` (2026-10-26).
The redesign keeps every row of the first two tables working.

## routes and what works

| route | what | state |
|---|---|---|
| `/` | the landing (en) | static; sign-up and sign-in forms post to the app's routes |
| `/es/`, `/zh/` | the landing in Spanish and Simplified Chinese | static, same forms |
| `/startups/` | the account's businesses, a new business from an idea, delete the account | works, needs a session |
| `/app/?s=<id>` | the console of one business: sixteen tabs (chat, dashboard, tasks, files, products, orders …) | works; the chat calls a real model server-side |
| `/api/*` | `app.mjs`: signup, signin, signout, me, startups and the console's routes, on D1 | works |

## forms, controls and hooks the journey (`test/journey.mjs`) depends on

`#signup` (name, email, password, idea), `#signin` (email, password), `[data-error]`, the footer's `[data-lang]`
button and `#lang-dialog`, an `h1` that says "business", `#start`, `#signin-link`. On `/startups/`: `#list a.card`,
`#create` (idea, name, cofounder), `#signout`, `#delete-account`. The console's own markup is `app/app.js`'s.

## what is a demo

- Nothing on the landing is live data. The redesign's "first page" sketch is made in the visitor's browser from what
  they type, by a script; it says so, and it sends nothing.
- The console's test checkout is a sandbox (test card, no charge). Providers that need money or a third-party account
  stop at "connect your provider".

## claims, checked

| claim | verdict |
|---|---|
| "Have an idea on Monday. Have a business by Sunday." | kept: day one plus the seven-day launch week is the product's plan, not a guarantee of sales |
| "Free credits to start. No card. Prices are set at launch." | kept, true of the app |
| "Growth — Most chosen" | **removed**: no plan has been chosen by anyone yet; a popularity tag is an invented claim (brief §3) |
| "only completed sales are counted" | kept, true of the app |
| the six capabilities | kept; each one ends at the provider call where it needs the person's own account, and the page says so |

## what the redesign adds

- Four generated films between chapters (fal; hands at work in small crafts). Each is captioned as generated, and none
  poses as a customer.
- The first-page sketch (the signature), the contents popover, a scroll-driven bookmark ribbon.
- A wordmark, favicon, touch icon and a 1200×630 OG image.
