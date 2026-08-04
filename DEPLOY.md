# Launch checklist — Cloudflare

The whole site is static: no build command, no build output directory.

**Deploy engine, corrected:** connecting the GitHub repo did not create a
classic "Pages" project — Cloudflare's git integration detected a static site
and deploys it as a **Worker with static assets**, via `npx wrangler deploy`.
That engine has four consequences this checklist accounts for:

- Its `_redirects` parser only accepts relative paths and plain integer status
  codes (200/301/302/303/307/308) — no host-to-host rules, no Pages-style `!`
  force suffix. `_redirects` in this repo is now deliberately empty of rules;
  see the comment in that file.
- It does **not** auto-exclude `.git`, `.wrangler`, etc. from the asset upload
  the way classic Pages does. `.assetsignore` (gitignore syntax) handles that —
  without it, the upload log will show `.git/config` and similar going out as
  public files, which is a real information-disclosure risk, not a cosmetic one.
- Its `_headers` parser **applies every matching rule and concatenates the
  values**; it does not let the most specific rule win the way classic Pages
  did. A `Cache-Control` on `/*` therefore rode along on every asset response
  as `max-age=0, must-revalidate, max-age=31536000, immutable`, and the
  `max-age=0` won — so the image cache silently did nothing. `Cache-Control` is
  now set per HTML route and `/*` carries only security headers. Add a route to
  `_headers` when a new HTML page is added.
- Asset behaviour that is not expressible in `_headers` lives in
  `wrangler.jsonc` — currently just `not_found_handling` (see the note below).
  The Worker `name` in that file must keep matching the deployed Worker, or a
  deploy creates a second Worker and leaves the Custom Domain on the old one.

## 1. Host canonicalisation — DONE, apex is canonical

**The canonical host is the bare apex: `https://thepeacemakerbrewster.com`** (no
`www`). Every `<link rel="canonical">`, `og:url`, JSON-LD `@id`, `sitemap.xml`
entry and `robots.txt`/`llms.txt` reference uses it.

This was originally planned as www-canonical, and that was wrong in practice:
the Worker's Custom Domain was attached to the apex, so `www` never got a DNS
record and did not resolve at all (`curl` → "Could not resolve host"). Meanwhile
every canonical pointed at that non-existent `www` host, which is exactly the
kind of mismatch that stalls indexing. Rather than add DNS for a hostname
nobody was using, the site was switched to match what actually serves.

Current state, verified live:

- `https://thepeacemakerbrewster.com/` → `200`, serves the site
- `www.thepeacemakerbrewster.com` → does not resolve (no DNS record)

### Optional hardening

`www` not resolving is harmless — there is no duplicate-content risk, because
nothing is served there. But visitors who type `www.` by habit get a DNS error
rather than the site. To cover that:

1. **DNS:** add `CNAME  www  thepeacemakerbrewster.com` — proxied (orange cloud).
   Do **not** add `www` as a second Custom Domain on the Worker; that would serve
   the site on both hosts and create the duplication we are avoiding.
2. **Rules → Redirect Rules → Create:**
   - If: `hostname equals www.thepeacemakerbrewster.com`
   - Then: dynamic redirect, status **301**, preserve query string,
     expression: `concat("https://thepeacemakerbrewster.com", http.request.uri.path)`

Note the direction: `www` → apex, the reverse of the original plan.

3. **SSL/TLS:** encryption mode **Full (strict)**, and **Always Use HTTPS** on.

### Verify

```bash
curl -sSI https://thepeacemakerbrewster.com/ | grep -iE '^(HTTP|cache-control)'
curl -sS https://thepeacemakerbrewster.com/ | grep -i 'rel="canonical"'
```

Expect `200` on the apex and a canonical that matches the host being requested.
If the `www` redirect above is added, also confirm it is a single 301 hop — a
redirect *chain* leaks link equity.

## 2. Search Console

1. Verify the **`https://thepeacemakerbrewster.com`** property (the domain
   property covers both hosts, which is what you want).
2. Submit `https://thepeacemakerbrewster.com/sitemap.xml`.
3. Request indexing for `/` and `/menu/`.
4. Run both URLs through the Rich Results Test — expect
   `CafeOrCoffeeShop` on both, plus `Menu` and `BreadcrumbList` on `/menu/`.

## 3. Google Business Profile

Local ranking is won here far more than on this site.

- Hours **must** match the site exactly: daily 7:00am–2:00pm.
- Website field → `https://thepeacemakerbrewster.com/`
- Primary category: Sandwich Shop or Breakfast Restaurant. Secondary: Coffee Shop.
- Load the menu, current photos, and the attributes already claimed in our
  schema: outdoor seating, takeout, dine-in, free parking, wheelchair
  accessible, dogs welcome outside.

## Notes

- **Corrected:** an earlier version of this note claimed the engine picks up the
  root `404.html` on its own and that no `not_found_handling` setting was needed.
  Only half of that was true. The status code was right, but the body was
  **zero bytes** — the default `not_found_handling` is `"none"`, so visitors on a
  bad URL got a blank white page and `404.html` was reachable only at its own
  path. `wrangler.jsonc` now sets `not_found_handling: "404-page"`. **Verified
  live:** a bad URL returns `404` with the styled 8.6KB page.
  Never set this to `single-page-application` — that answers every missing URL
  with `200` + `index.html`, which is exactly the soft-404 flood that was
  suppressing indexing on this domain while it was served from the old repo.
- **Verified live:** `.assetsignore` works. `/.git/config` and `/DEPLOY.md` both
  return `404`, and `/llms.txt` returns `200`. Git history is not exposed.
- `.nojekyll` is a GitHub Pages artifact and a no-op here. Harmless; delete if
  you like.
- `sitemap.xml` has hardcoded `lastmod` dates. Bump them when content changes —
  a `lastmod` that never moves gets ignored.
- Do **not** add `Review` or `aggregateRating` schema for the Google reviews on
  the homepage. Google prohibits marking up reviews sourced from third-party
  sites as your own; it risks a manual action. Stars require first-party reviews.
