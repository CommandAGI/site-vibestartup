# site-vibestartup

The site of VibeStartup (vibestartup.pro), a company of CommandAGI (`org-vibestartup`) that starts vibestartups: real
small businesses made and run with an AI co-founder. A static folder served by CommandAGI's site hosting; mounted in
the CommandAGI repository at `seed/drive/platform/org-vibestartup/sites/vibestartup`.

- `index.html`, `style.css`, `mark.svg`: the landing page. What a vibestartup is, how it works, what you get and what
  you do not, and the plans (prices are set at launch, by the owner).
- `console/`: the founder's console as a demo. One sample business made from what the visitor types; the co-founder
  is a script and every reply says so. State is in the browser's `localStorage` (`vibestartup-demo`) and the page sends
  nothing (`connect-src 'none'`). A secret's value is never kept: only its name. A test buy is a simulated checkout
  with the test card; no payment is taken.
- The product spec is `companies/vibestartup/` in CommandAGI's Drive. The browser journey is
  `tests/workbench/browser_vibestartup.mjs` in the CommandAGI repository.
