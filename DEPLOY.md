# Launch checklist — Cloudflare Pages

The whole site is static. No build command, no build output directory.

## 1. Host canonicalisation (do this first)

Every `<link rel="canonical">`, `og:url` and `sitemap.xml` entry points at
**`https://www.peacemakerbrewster.com`**. The served host has to match, or Google
sees two hosts serving identical pages and picks a canonical itself.

1. **Pages → Custom domains:** add **only** `www.peacemakerbrewster.com`.
   Do not add the apex as a second custom domain — that would serve the site on
   both hosts and create the exact duplication we are avoiding.

2. **DNS:**
   - `CNAME  www  <project>.pages.dev`  — proxied (orange cloud)
   - `A      @    192.0.2.1`            — proxied (orange cloud)

   That apex A record is a placeholder from the reserved range in RFC 5737.
   Nothing listens on it; it exists so the apex resolves *through* Cloudflare,
   which is what lets the redirect rule below fire without an origin server.

3. **Rules → Redirect Rules → Create:**
   - If: `hostname equals peacemakerbrewster.com`
   - Then: dynamic redirect, status **301**, preserve query string,
     expression: `concat("https://www.peacemakerbrewster.com", http.request.uri.path)`

4. **SSL/TLS:** encryption mode **Full (strict)**, and **Always Use HTTPS** on.

`_redirects` in this repo covers the same apex→www hop, but it only runs for
requests that already reached the Pages project. The rule above is the one that
does the real work; treat `_redirects` as the fallback.

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

- `.nojekyll` is a GitHub Pages artifact and a no-op here. Harmless; delete if
  you like.
- `sitemap.xml` has hardcoded `lastmod` dates. Bump them when content changes —
  a `lastmod` that never moves gets ignored.
- Do **not** add `Review` or `aggregateRating` schema for the Google reviews on
  the homepage. Google prohibits marking up reviews sourced from third-party
  sites as your own; it risks a manual action. Stars require first-party reviews.
