# Launch checklist — Cloudflare

The whole site is static: no build command, no build output directory.

**Deploy engine, corrected:** connecting the GitHub repo did not create a
classic "Pages" project — Cloudflare's git integration detected a static site
and deploys it as a **Worker with static assets**, via `npx wrangler deploy`.
That engine has two consequences this checklist accounts for:

- Its `_redirects` parser only accepts relative paths and plain integer status
  codes (200/301/302/303/307/308) — no host-to-host rules, no Pages-style `!`
  force suffix. `_redirects` in this repo is now deliberately empty of rules;
  see the comment in that file.
- It does **not** auto-exclude `.git`, `.wrangler`, etc. from the asset upload
  the way classic Pages does. `.assetsignore` (gitignore syntax) handles that —
  without it, the upload log will show `.git/config` and similar going out as
  public files, which is a real information-disclosure risk, not a cosmetic one.

## 1. Host canonicalisation (do this first)

Every `<link rel="canonical">`, `og:url` and `sitemap.xml` entry points at
**`https://www.peacemakerbrewster.com`**. The served host has to match, or Google
sees two hosts serving identical pages and picks a canonical itself.

1. **Workers & Pages → (this Worker) → Settings → Domains & Routes → Add
   Custom Domain:** add **only** `www.peacemakerbrewster.com`. Adding a Custom
   Domain here provisions its DNS record automatically — no manual CNAME needed.
   Do not also add the apex here — that would serve the site on both hosts and
   create the exact duplication we are avoiding.

2. The apex (`peacemakerbrewster.com`, no `www`) needs to resolve *through*
   Cloudflare's proxy for the redirect rule below to fire at all, but nothing
   should serve content from it directly. Add one DNS record for it:
   - `A  @  192.0.2.1` — proxied (orange cloud)

   That address is a placeholder from the reserved range in RFC 5737. Nothing
   listens on it; the redirect rule intercepts every request to this host
   before it would ever reach that non-existent origin.

3. **Rules → Redirect Rules → Create:**
   - If: `hostname equals peacemakerbrewster.com`
   - Then: dynamic redirect, status **301**, preserve query string,
     expression: `concat("https://www.peacemakerbrewster.com", http.request.uri.path)`

4. **SSL/TLS:** encryption mode **Full (strict)**, and **Always Use HTTPS** on.

### Verify before announcing

```bash
curl -sSI http://peacemakerbrewster.com/      | grep -i '^location'
curl -sSI https://peacemakerbrewster.com/menu | grep -i '^location'
curl -sSI https://www.peacemakerbrewster.com/ | grep -iE '^(HTTP|cache-control)'
```

Expect a single 301 to the `www` https equivalent, path preserved, and `200` on
the canonical host. A redirect *chain* (two or more hops) leaks link equity —
if you see one, fix it now rather than after indexing.

## 2. Search Console

1. Verify the **`https://www.peacemakerbrewster.com`** property (the domain
   property covers both hosts, which is what you want).
2. Submit `https://www.peacemakerbrewster.com/sitemap.xml`.
3. Request indexing for `/` and `/menu/`.
4. Run both URLs through the Rich Results Test — expect
   `CafeOrCoffeeShop` on both, plus `Menu` and `BreadcrumbList` on `/menu/`.

## 3. Google Business Profile

Local ranking is won here far more than on this site.

- Hours **must** match the site exactly: daily 7:00am–2:00pm.
- Website field → `https://www.peacemakerbrewster.com/`
- Primary category: Sandwich Shop or Breakfast Restaurant. Secondary: Coffee Shop.
- Load the menu, current photos, and the attributes already claimed in our
  schema: outdoor seating, takeout, dine-in, free parking, wheelchair
  accessible, dogs welcome outside.

## Notes

- **Check that `404.html` actually serves on a bad URL** (e.g.
  `/this-does-not-exist`) once deployed, and that it returns HTTP 404, not 200.
  Classic Pages auto-detects a root `404.html`; this Worker-assets engine may
  need it declared explicitly via `not_found_handling: "404-page"` in a
  `wrangler.jsonc` if it doesn't pick it up on its own. Untested until live.
- `.nojekyll` is a GitHub Pages artifact and a no-op here. Harmless; delete if
  you like.
- `sitemap.xml` has hardcoded `lastmod` dates. Bump them when content changes —
  a `lastmod` that never moves gets ignored.
- Do **not** add `Review` or `aggregateRating` schema for the Google reviews on
  the homepage. Google prohibits marking up reviews sourced from third-party
  sites as your own; it risks a manual action. Stars require first-party reviews.
