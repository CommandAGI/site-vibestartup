# Meta App Review: VibeStartup Ads

What Meta's App Review asks for the app "VibeStartup Ads" (App ID 1338102101689302, business portfolio of
CommandAGI Inc), ready to paste: the app's purpose, one use-case description per permission, the screencast's steps
and the reviewer's instructions. The code is the Ads tab (`app/tabs/ads.js`, `app/connected/index.html`) and
CommandAGI's Meta Ads acts (CommandAGI `docs/meta-ads.md`).

## what the app does (the "App details" text)

VibeStartup (https://vibestartup.pro) helps a person start and run a small online business with an AI co-founder.
The co-founder builds the storefront, writes the posts and, when the founder wants to advertise, runs one ad
campaign on the founder's own Meta ad account. The founder connects their ad account with Facebook Login for
Business. The founder sets a daily budget in their plan, and nothing spends until the founder approves going live at
that budget. The campaign is billed by Meta to the founder's own ad account and payment method. VibeStartup never
holds or pays the founder's ad spend, and never sells or shares the data it reads.

## ads_management

> VibeStartup uses ads_management to create and manage one advertising campaign on the ad account the person
> connects and chooses. When the person presses Launch in the Ads tab, we create a campaign (objective: traffic), one
> ad set with the daily budget from the person's saved plan, the ad's image (uploaded to the ad account's image
> library from the person's own pictures) and one ad that links to the person's storefront, all with status PAUSED.
> Nothing is set ACTIVE until the person presses "Approve going live" and confirms the daily amount. After that the
> person (or the co-founder acting for them) may pause the campaign, lower its budget, or delete it; a budget is
> never raised above the amount the person approved, and our server refuses any change that would. We do not manage
> any ad account the person did not choose, and we make no change the person did not ask for or approve.

## ads_read

> VibeStartup uses ads_read to show the person what their campaign did: spend, impressions, reach, clicks,
> click-through rate and cost per click from the campaign's insights, and its delivery status. These numbers are shown
> on the Ads tab and in the co-founder's daily briefing, so the person can decide whether to keep, pause or change
> the campaign. We read insights only for campaigns created through VibeStartup on the ad account the person chose,
> and we keep no copy beyond what the page shows.

## business_management

> VibeStartup uses business_management to list the ad accounts and Facebook Pages the person can use through their
> business portfolios, so the person can choose which ad account the campaign runs in and which Page the ad speaks
> as. We read the person's businesses, their owned Pages and the ad accounts the person has access to. We do not
> create, change or remove businesses, assets, people or permissions in the person's Business Manager.

## the screencast (about 2 minutes, at 1440 px)

Record it once the app is Live, so the ad step completes (in development mode Meta refuses the ad's creative, error
1885183). The steps, each a click a reviewer can follow:

1. Sign in to VibeStartup and open a business's **Ads** tab. Show the plan: the daily budget ($1.00 for the
   recording) and the readiness list.
2. Under **Ad account**, press **Connect your ad account**. Facebook's dialog opens in a window: show the app name,
   the three permissions, and **Continue**. The window closes and the tab says "Ad account connected."
3. Choose the ad account and the Page, press **Use these**. The readiness list's **Ad account** turns green.
4. Press **Launch**. Show the dialog: the picture from the Studio, the caption, the storefront link, the daily
   budget (at most the plan's). Press **Make it, paused**. The campaign card appears, status **paused**.
5. Open Meta Ads Manager in a second tab and show the same campaign, ad set and ad, all paused, at $1.00 a day.
6. Back in VibeStartup, press **Approve going live at $1.00 a day** and confirm. The card says **live**; Ads Manager
   shows it active (in review).
7. Show the insights on the card (spend, impressions, reach, clicks).
8. Press **Pause**, then **Delete campaign** and confirm. Ads Manager shows the campaign deleted.

`test/meta-ads-walkthrough.mjs` takes the same states as screenshots at 1440 px (steps 1, 3, 4, 7 and 8; the
Facebook dialog is recorded by hand). The run of 2026-11-11 on the owner's test ad account, in development mode, is in
CommandAGI's `docs/verification.md`; its screenshots are kept out of this public repository.

## the reviewer's instructions

- URL: https://vibestartup.pro. Sign in with the test account named in the submission's notes (made for review,
  with a business that has a Studio picture and a saved plan).
- The reviewer connects their own Facebook test user's ad account, or the test ad account we name in the notes.
- Nothing spends until **Approve going live**. A reviewer who approves sees a $1.00 a day campaign; delete it after.

## data handling (the "Data use" answers)

- The Facebook access token is kept encrypted by CommandAGI's platform (AES-256-GCM), never in a file, a log or the
  browser. It ends after about 60 days; the person connects again.
- Every create, approval, status change and budget change is recorded with who made it, before it is sent to Meta.
- **Disconnect** on the Ads tab removes the token. The person can also remove the app in Facebook's settings.
- Data deletion: write to hello@vibestartup.pro, or delete the account in Profile; the connection goes with it.
