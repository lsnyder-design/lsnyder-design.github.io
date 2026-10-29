# 401(k) Fund Exchange Prototype

An interactive prototype of a 401(k) fund exchange: sell from current holdings, reinvest in other plan funds, review, and confirm. Styled after the Windows 11 (Fluent) UI kit.

Built with plain HTML, CSS, and JavaScript. No framework or build step.

## Run it

Open `index.html` in a browser, or view it on GitHub Pages.

## Publish with GitHub Pages

1. In the repo, go to **Settings → Pages**.
2. Under **Build and deployment**, set Source to **Deploy from a branch**.
3. Choose branch `main` and folder `/ (root)`, then **Save**.
4. The site appears at `https://<your-username>.github.io/<repo-name>/` after a minute or two.

## What works

- **Sell:** select funds; sell by percent, dollar amount, or entire balance; live estimated totals; validation (empty, over 100%, over balance).
- **Buy:** allocate by percent across plan funds not being sold; running total; must equal 100% to continue.
- **Review:** summary of both sides, edit links, estimated trade date based on the 4:00 p.m. ET cutoff.
- **Confirm:** confirmation number, cancel the exchange, start over.
- Keyboard and screen reader support: labeled fields, grouped radio buttons, error messages tied to fields, step progress announced.
- Responsive layout down to phone width.

## Limitations

- Sample data only. Fund names, balances, and expense ratios are made up.
- Nothing is saved; refreshing the page starts over.
- Trade dates skip weekends but not market holidays.
- Typography uses Segoe UI Variable when installed, otherwise the system font.

## Files

- `index.html` – page shell
- `styles.css` – Fluent-style tokens and components
- `app.js` – flow, state, calculations, validation
