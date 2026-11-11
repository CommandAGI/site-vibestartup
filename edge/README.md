# the edge: every business at `<site slug>.vibestartup.pro`

`subdomains.js` is a Cloudflare Worker in the Cloudflare account that holds the vibestartup.pro zone (not
CommandAGI's account). For `<label>.vibestartup.pro` it asks CommandAGI whose site the label is
(`GET https://api.commandagi.com/sites/brand/<label>`, public) and proxies the request to
`https://<label>.commandagi.app` only when the answer is `{ slug: <label>, brand: "vibestartup" }`. Every other answer
(404, an error, a site of no brand) is the branded 404 page, "No business here yet — start yours", which links
https://vibestartup.pro/start/. The edge never proxies a label it has not verified.

Why a Worker here: CommandAGI serves every site at `<slug>.commandagi.app`, but the vibestartup.pro zone is in
another Cloudflare account, and a wildcard custom hostname (Cloudflare for SaaS) is an Enterprise plan. A site made
through VibeStartup's sign-in is VibeStartup's (`sites.brand`, CommandAGI's `docs/site-hosting.md` § a brand's
address), and its view carries `brandUrl`, which the console shows.

- One label only. `www` redirects to the apex. `api`, `dev`, `dev-api`, `send`, any `_` name and any deeper name
  are the 404 page and are never looked up.
- The lookup's answer is kept in the Cache API for 5 minutes, a "no" too; an error is not kept.
- The proxy sends the method, path, query, body and headers (not the hop-by-hop headers, not Cloudflare's `cf-*`;
  `x-forwarded-host`, `x-forwarded-proto` and `x-forwarded-for` are added), streams the body back with the
  origin's status, moves a `Location` on `<label>.commandagi.app` to the vibestartup.pro host, and scopes a
  `Set-Cookie` with the origin's `Domain` to the vibestartup.pro host.

Test: `node edge/subdomains.test.mjs` (fetch faked at the lookup and at the origin).

## deploy (Cloudflare dashboard, the account that holds vibestartup.pro)

1. **Workers & Pages → Create → Worker.** Name it `vibestartup-subdomains`. Deploy the starter, then **Edit code**:
   replace the whole file with `edge/subdomains.js` (it is an ES module with `export default { fetch }`) and
   **Deploy**. It needs no binding, no variable and no secret. The Cache API is `caches.default`, which every Worker
   has on a zone route.
2. **The Worker → Settings → Domains & Routes → Add → Route.** Zone `vibestartup.pro`, route `*.vibestartup.pro/*`,
   failure mode **Fail closed (block)**. Turn off the Worker's `workers.dev` address and its preview URLs there
   too: the Worker is for the route.
3. **Remove the route of the Worker that answers today** ("no startup here yet", `X-Vibestartup-Request-Id`):
   Workers Routes in the vibestartup.pro zone list it. Two Workers cannot share the route; the more specific
   pattern would win.
4. **Keep the apex and www out.** The route `*.vibestartup.pro/*` does not match `vibestartup.pro`. `vibestartup.pro`
   and `www.vibestartup.pro` stay **DNS only** CNAMEs to `cname.commandagi.app` (custom hostnames of the
   `vibestartup` site), so no Worker runs for them; do not proxy them. The `*` CNAME stays **Proxied**, and the MX
   records (Email Routing) do not change.
5. **Check:** `curl -sI https://nobody-here.vibestartup.pro/` is a 404 with the page above. After CommandAGI's next
   production deploy, `curl -s https://api.commandagi.com/sites/brand/<a business's slug>` names `vibestartup`, and
   `https://<that slug>.vibestartup.pro/` serves the storefront.

Until that deploy, the lookup is 404 for every label, so every name is the 404 page: safe to deploy first.
