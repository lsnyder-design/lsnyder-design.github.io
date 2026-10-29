/* 401(k) fund exchange prototype
 * Plain JavaScript, no dependencies. All money is handled in cents to avoid rounding errors.
 * Sample data only — fund names, balances and expense ratios are made up.
 */
(function () {
  "use strict";

  // ---------- Sample data ----------
  const FUNDS = [
    { id: "tr2050", name: "Target Retirement 2050 Fund", category: "Target date", er: "0.08%", balance: 8421055 },
    { id: "sp500", name: "S&P 500 Index Fund", category: "Large-cap stock", er: "0.02%", balance: 5230000 },
    { id: "intl", name: "International Stock Index Fund", category: "International stock", er: "0.05%", balance: 1845020 },
    { id: "stb", name: "Short-Term Bond Fund", category: "Short-term bond", er: "0.07%", balance: 980000 },
    { id: "sv", name: "Stable Value Fund", category: "Stable value", er: "0.29%", balance: 1204000 },
    { id: "mid", name: "Mid-Cap Index Fund", category: "Mid-cap stock", er: "0.04%", balance: 0 },
    { id: "small", name: "Small-Cap Index Fund", category: "Small-cap stock", er: "0.05%", balance: 0 },
    { id: "bond", name: "Total Bond Market Index Fund", category: "Bond", er: "0.05%", balance: 0 },
  ];
  const HOLDINGS = FUNDS.filter((f) => f.balance > 0);
  const byId = Object.fromEntries(FUNDS.map((f) => [f.id, f]));
  const STEPS = ["Sell", "Buy", "Review", "Confirm"];
  const CUTOFF_HOUR_ET = 16;

  // ---------- State ----------
  const freshState = () => ({
    step: 1,
    sells: Object.fromEntries(HOLDINGS.map((h) => [h.id, { selected: false, method: "percent", value: "", touched: false }])),
    buys: Object.fromEntries(FUNDS.map((f) => [f.id, ""])),
    showSellErrors: false,
    showBuyErrors: false,
    submission: null,
  });
  let state = freshState();

  // ---------- Helpers ----------
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
  const money = (cents) => usd.format(cents / 100);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const announce = (msg) => { const a = $("#announcer"); a.textContent = ""; setTimeout(() => (a.textContent = msg), 50); };

  const ICONS = {
    info: '<svg class="infobar__icon" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="8" fill="currentColor"/><rect x="7.25" y="7" width="1.5" height="5" rx=".75" fill="#fff"/><circle cx="8" cy="4.75" r="1" fill="#fff"/></svg>',
    success: '<svg class="infobar__icon" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="8" fill="currentColor"/><path d="M4.75 8.25l2.25 2.25 4.25-4.5" fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    warning: '<svg class="infobar__icon" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="8" fill="currentColor"/><rect x="7.25" y="3.75" width="1.5" height="5.5" rx=".75" fill="#fff"/><circle cx="8" cy="11.5" r="1" fill="#fff"/></svg>',
    critical: '<svg class="infobar__icon" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="8" fill="currentColor"/><path d="M5.5 5.5l5 5m0-5l-5 5" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/></svg>',
  };
  const infobar = (severity, title, body, id = "") =>
    `<div class="infobar infobar--${severity}" ${id ? `id="${id}"` : ""} role="${severity === "critical" ? "alert" : "status"}">
      ${ICONS[severity]}
      <div><p class="infobar__title">${esc(title)}</p>${body ? `<p class="infobar__body">${esc(body)}</p>` : ""}</div>
    </div>`;

  // Parse "12.5" / "12.5%" → basis points of a percent (hundredths), or null
  function parsePercent(raw) {
    const s = String(raw).replace(/[%\s]/g, "");
    if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
    return Math.round(parseFloat(s) * 100); // 25% → 2500
  }
  // Parse "$10,000.00" → cents, or null
  function parseDollars(raw) {
    const s = String(raw).replace(/[$,\s]/g, "");
    if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
    return Math.round(parseFloat(s) * 100);
  }

  // ---------- Sell logic ----------
  function sellLine(id) {
    const h = byId[id];
    const s = state.sells[id];
    if (!s.selected) return { selected: false, cents: 0, error: null };
    if (s.method === "all") return { selected: true, cents: h.balance, error: null };
    if (s.value.trim() === "") return { selected: true, cents: 0, error: s.method === "percent" ? "Enter a percent." : "Enter a dollar amount." };
    if (s.method === "percent") {
      const bp = parsePercent(s.value);
      if (bp === null || bp <= 0 || bp > 10000) return { selected: true, cents: 0, error: "Enter a percent from 0.01 to 100." };
      return { selected: true, cents: Math.round((h.balance * bp) / 10000), error: null };
    }
    const cents = parseDollars(s.value);
    if (cents === null || cents <= 0) return { selected: true, cents: 0, error: "Enter a dollar amount greater than $0." };
    if (cents > h.balance) return { selected: true, cents: 0, error: `Can't be more than ${money(h.balance)}.` };
    return { selected: true, cents, error: null };
  }
  const sellLines = () => HOLDINGS.map((h) => ({ fund: h, ...sellLine(h.id) }));
  const sellTotal = () => sellLines().reduce((sum, l) => sum + (l.error ? 0 : l.cents), 0);
  const soldIds = () => HOLDINGS.filter((h) => state.sells[h.id].selected).map((h) => h.id);

  function sellDescription(id) {
    const s = state.sells[id];
    if (s.method === "all") return "Entire balance";
    if (s.method === "percent") return `${(parsePercent(s.value) / 100).toString()}% of balance`;
    return "Dollar amount";
  }

  // ---------- Buy logic ----------
  const buyFunds = () => FUNDS.filter((f) => !soldIds().includes(f.id));
  function buyLines() {
    const total = sellTotal();
    const lines = buyFunds().map((f) => {
      const raw = state.buys[f.id];
      const bp = raw.trim() === "" ? 0 : parsePercent(raw);
      const invalid = raw.trim() !== "" && (bp === null || bp > 10000);
      return { fund: f, bp: invalid ? 0 : bp, invalid, cents: 0 };
    });
    // Split the total in cents; give any rounding remainder to the largest allocation so lines add up exactly.
    const totalBp = lines.reduce((s, l) => s + l.bp, 0);
    if (totalBp === 10000) {
      let assigned = 0;
      lines.forEach((l) => { l.cents = Math.floor((total * l.bp) / 10000); assigned += l.cents; });
      const largest = lines.reduce((a, b) => (b.bp > a.bp ? b : a), lines[0]);
      largest.cents += total - assigned;
    } else {
      lines.forEach((l) => { l.cents = Math.round((total * l.bp) / 10000); });
    }
    return { lines, totalBp };
  }

  // ---------- Trade timing (America/New_York) ----------
  function etNow(date = new Date()) {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", hourCycle: "h23", weekday: "short",
      }).formatToParts(date).map((p) => [p.type, p.value])
    );
    return { y: +parts.year, m: +parts.month, d: +parts.day, hour: +parts.hour, minute: +parts.minute };
  }
  // Business days only; market holidays are not modeled in this prototype.
  function tradeDate(date = new Date()) {
    const now = etNow(date);
    const d = new Date(Date.UTC(now.y, now.m - 1, now.d, 12));
    const isWeekend = (x) => x.getUTCDay() === 0 || x.getUTCDay() === 6;
    if (isWeekend(d) || now.hour >= CUTOFF_HOUR_ET) {
      do { d.setUTCDate(d.getUTCDate() + 1); } while (isWeekend(d));
    }
    return d;
  }
  const fmtDate = (d, opts = { weekday: "short", month: "short", day: "numeric", year: "numeric" }) =>
    d.toLocaleDateString("en-US", { ...opts, timeZone: "UTC" });
  const fmtTimestamp = (date) =>
    date.toLocaleString("en-US", { timeZone: "America/New_York", weekday: "short", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })
      .replace(/ AM$/, " a.m.").replace(/ PM$/, " p.m.") + " ET";

  // ---------- Shell ----------
  function renderSteps() {
    $("#steps").innerHTML = STEPS.map((label, i) => {
      const n = i + 1;
      const cls = n === state.step ? "is-current" : n < state.step ? "is-complete" : "";
      const badge = n < state.step ? '<svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M2 5.25l2 2 4-4.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>' : n;
      const status = n < state.step ? "completed" : n === state.step ? "current step" : "not started";
      return `<li class="steps__item ${cls}" ${n === state.step ? 'aria-current="step"' : ""}>
        <span class="steps__badge" aria-hidden="true">${badge}</span>
        <span>${label}<span class="visually-hidden">, ${status}</span></span>
      </li>`;
    }).join("");
  }

  function go(step) {
    state.step = step;
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
    const h = $(".screen__title");
    if (h) h.focus({ preventScroll: true });
  }

  function render() {
    $("#total-balance").textContent = money(HOLDINGS.reduce((s, h) => s + h.balance, 0));
    renderSteps();
    const screens = { 1: renderSell, 2: renderBuy, 3: renderReview, 4: renderConfirm };
    screens[state.step]();
  }

  // ---------- Step 1: Sell ----------
  function sellControls(h) {
    const s = state.sells[h.id];
    const methods = [["percent", "Percent"], ["dollars", "Dollars"], ["all", "All"]];
    const radios = methods.map(([val, label]) => `
      <label class="radio-option">
        <input class="radio" type="radio" name="method-${h.id}" value="${val}" data-id="${h.id}" data-role="method" ${s.method === val ? "checked" : ""}>
        ${label}
      </label>`).join("");
    let amount;
    if (s.method === "all") {
      amount = `<span class="muted">Entire balance</span>`;
    } else {
      const isPct = s.method === "percent";
      amount = `
        <div class="field">
          <span class="text-input text-input--amount">
            ${isPct ? "" : '<span class="text-input__affix text-input__affix--before" aria-hidden="true">$</span>'}
            <input type="text" inputmode="decimal" autocomplete="off" data-id="${h.id}" data-role="amount"
              id="amount-${h.id}" value="${esc(s.value)}" placeholder="${isPct ? "0" : "0.00"}"
              aria-label="${isPct ? "Percent" : "Dollar amount"} to sell from ${esc(h.name)}"
              aria-describedby="err-${h.id}">
            ${isPct ? '<span class="text-input__affix text-input__affix--after" aria-hidden="true">%</span>' : ""}
          </span>
          <span class="field__error" id="err-${h.id}"></span>
        </div>`;
    }
    return {
      sellBy: `<fieldset class="radio-group"><legend class="visually-hidden">How to sell ${esc(h.name)}</legend>${radios}</fieldset>`,
      amount,
    };
  }

  function sellRow(h) {
    const s = state.sells[h.id];
    const c = s.selected ? sellControls(h) : null;
    return `<tr data-row="${h.id}" class="${s.selected ? "is-selected" : ""}">
      <td>
        <div class="fund-cell">
          <input class="checkbox" type="checkbox" id="sel-${h.id}" data-id="${h.id}" data-role="select" ${s.selected ? "checked" : ""}>
          <label class="fund-name" for="sel-${h.id}">${esc(h.name)}</label>
        </div>
      </td>
      <td data-label="Current balance" class="num">${money(h.balance)}</td>
      <td data-label="Sell by" class="${s.selected ? "" : "is-empty-mobile"}">${c ? c.sellBy : '<span class="dash" aria-hidden="true">—</span>'}</td>
      <td data-label="Amount" class="${s.selected ? "" : "is-empty-mobile"}">${c ? c.amount : '<span class="dash" aria-hidden="true">—</span>'}</td>
      <td data-label="Estimated sale" class="num ${s.selected ? "strong" : "is-empty-mobile"}" data-est="${h.id}">—</td>
    </tr>`;
  }

  function renderSell() {
    $("#screen").innerHTML = `
      <h2 class="screen__title" tabindex="-1">Choose what to sell</h2>
      <p class="screen__intro">Select funds and how much to sell from each. The money stays in your plan and is reinvested in the funds you choose next.</p>
      <form id="sell-form" novalidate>
        <div class="stack">
          <div id="sell-alert"></div>
          <div class="card">
            <table class="data-table">
              <caption class="visually-hidden">Your current holdings</caption>
              <thead><tr>
                <th scope="col">Fund</th><th scope="col" class="num">Current balance</th><th scope="col">Sell by</th><th scope="col">Amount</th><th scope="col" class="num">Estimated sale</th>
              </tr></thead>
              <tbody>${HOLDINGS.map(sellRow).join("")}</tbody>
            </table>
          </div>
        </div>
        <div class="screen-footer">
          <div aria-live="polite">
            <div class="screen-footer__total" id="sell-total"></div>
            <p class="screen-footer__note">Final amounts use each fund’s closing price on the trade date.</p>
          </div>
          <div class="actions">
            <button type="button" class="btn" data-action="reset">Cancel</button>
            <button type="submit" class="btn btn--accent">Next: Choose funds to buy</button>
          </div>
        </div>
      </form>`;
    updateSell();
  }

  function rerenderSellRow(id, focusRole) {
    const row = $(`tr[data-row="${id}"]`);
    const tmp = document.createElement("tbody");
    tmp.innerHTML = sellRow(byId[id]);
    row.replaceWith(tmp.firstElementChild);
    updateSell();
    if (focusRole === "select") $(`#sel-${id}`).focus();
    if (focusRole === "method") { const r = $(`input[name="method-${id}"]:checked`); if (r) r.focus(); }
  }

  function updateSell() {
    sellLines().forEach((l) => {
      const est = $(`[data-est="${l.fund.id}"]`);
      if (est) est.textContent = l.selected && !l.error ? money(l.cents) : "—";
      const err = $(`#err-${l.fund.id}`);
      const input = $(`#amount-${l.fund.id}`);
      const show = l.error && (state.sells[l.fund.id].touched || state.showSellErrors);
      if (err) err.textContent = show ? l.error : "";
      if (input) {
        input.closest(".text-input").classList.toggle("has-error", !!show);
        input.setAttribute("aria-invalid", show ? "true" : "false");
      }
    });
    const total = sellTotal();
    const lines = sellLines().filter((l) => l.selected);
    if (lines.length && lines.every((l) => !l.error)) $("#sell-alert").innerHTML = "";
    $("#sell-total").textContent = soldIds().length ? `Estimated total to sell: ${money(total)}` : "Select at least one fund to sell.";
  }

  function submitSell() {
    const lines = sellLines().filter((l) => l.selected);
    const alert = $("#sell-alert");
    state.showSellErrors = true;
    if (!lines.length) {
      alert.innerHTML = infobar("critical", "Select at least one fund to sell", "");
      $(`#sel-${HOLDINGS[0].id}`).focus();
      return;
    }
    const bad = lines.filter((l) => l.error);
    updateSell();
    if (bad.length) {
      alert.innerHTML = infobar("critical", `Fix ${bad.length === 1 ? "1 amount" : bad.length + " amounts"} to continue`, "");
      const first = $(`#amount-${bad[0].fund.id}`);
      if (first) first.focus();
      return;
    }
    alert.innerHTML = "";
    // Drop buy allocations for funds that are now being sold
    soldIds().forEach((id) => (state.buys[id] = ""));
    go(2);
  }

  // ---------- Step 2: Buy ----------
  function renderBuy() {
    const total = sellTotal();
    const rows = buyFunds().map((f) => `
      <tr data-row="${f.id}">
        <th scope="row" class="fund-name" style="font-weight:400;text-align:left">${esc(f.name)}</th>
        <td data-label="Category" class="muted">${esc(f.category)}</td>
        <td data-label="Expense ratio" class="muted num">${f.er}</td>
        <td data-label="Allocation">
          <div class="field">
            <span class="text-input text-input--short">
              <input type="text" inputmode="decimal" autocomplete="off" data-id="${f.id}" data-role="alloc"
                id="alloc-${f.id}" value="${esc(state.buys[f.id])}" placeholder="0" aria-label="Percent to invest in ${esc(f.name)}" aria-describedby="aerr-${f.id}">
              <span class="text-input__affix text-input__affix--after" aria-hidden="true">%</span>
            </span>
            <span class="field__error" id="aerr-${f.id}"></span>
          </div>
        </td>
        <td data-label="Estimated amount" class="num" data-buy-est="${f.id}">—</td>
      </tr>`).join("");

    $("#screen").innerHTML = `
      <h2 class="screen__title" tabindex="-1">Choose where to invest</h2>
      <p class="screen__intro">Split your estimated ${money(total)} across one or more funds. Allocations must total 100%. Funds you’re selling from aren’t listed.</p>
      <form id="buy-form" novalidate>
        <div class="stack">
          ${infobar("info", "This changes your current balance only", "Future contributions still follow your current elections. To change them, update your contribution elections.")}
          <div id="buy-alert"></div>
          <div class="card">
            <table class="data-table">
              <caption class="visually-hidden">Funds available in your plan</caption>
              <thead><tr>
                <th scope="col">Fund</th><th scope="col">Category</th><th scope="col" class="num">Expense ratio</th><th scope="col">Allocation</th><th scope="col" class="num">Estimated amount</th>
              </tr></thead>
              <tbody>${rows}</tbody>
              <tfoot><tr>
                <td>Total</td><td class="is-empty-mobile"></td><td class="is-empty-mobile"></td>
                <td data-label="Allocation" id="alloc-total"></td>
                <td data-label="Estimated amount" class="num" id="alloc-amount"></td>
              </tr></tfoot>
            </table>
          </div>
        </div>
        <div class="screen-footer">
          <div class="alloc-status" id="alloc-status" aria-live="polite"></div>
          <div class="actions">
            <button type="button" class="btn" data-action="back">Back</button>
            <button type="submit" class="btn btn--accent">Next: Review</button>
          </div>
        </div>
      </form>`;
    updateBuy();
  }

  function updateBuy() {
    const { lines, totalBp } = buyLines();
    lines.forEach((l) => {
      const est = $(`[data-buy-est="${l.fund.id}"]`);
      if (est) {
        est.textContent = l.bp > 0 ? money(l.cents) : "—";
        est.classList.toggle("strong", l.bp > 0);
      }
      const row = $(`tr[data-row="${l.fund.id}"] .fund-name`);
      if (row) row.style.fontWeight = l.bp > 0 ? "500" : "400";
      const err = $(`#aerr-${l.fund.id}`);
      const input = $(`#alloc-${l.fund.id}`);
      if (err) err.textContent = l.invalid ? "Enter 0 to 100." : "";
      if (input) {
        input.closest(".text-input").classList.toggle("has-error", l.invalid);
        input.setAttribute("aria-invalid", l.invalid ? "true" : "false");
      }
    });
    const pct = (bp) => `${(bp / 100).toString()}%`;
    $("#alloc-total").textContent = pct(totalBp);
    $("#alloc-amount").textContent = money(lines.reduce((s, l) => s + l.cents, 0));
    const status = $("#alloc-status");
    status.classList.remove("is-ok", "is-off");
    if (totalBp === 10000 && lines.every((l) => !l.invalid)) $("#buy-alert").innerHTML = "";
    if (totalBp === 10000) {
      status.textContent = "Allocations total 100%. Ready to review.";
      status.classList.add("is-ok");
    } else if (totalBp < 10000) {
      status.textContent = `${pct(10000 - totalBp)} left to allocate`;
      if (state.showBuyErrors) status.classList.add("is-off");
    } else {
      status.textContent = `Over by ${pct(totalBp - 10000)}. Reduce an allocation.`;
      status.classList.add("is-off");
    }
  }

  function submitBuy() {
    const { lines, totalBp } = buyLines();
    state.showBuyErrors = true;
    const alert = $("#buy-alert");
    const bad = lines.find((l) => l.invalid);
    if (bad) {
      alert.innerHTML = infobar("critical", "Fix the highlighted allocation", "");
      $(`#alloc-${bad.fund.id}`).focus();
      updateBuy();
      return;
    }
    if (totalBp !== 10000) {
      alert.innerHTML = infobar("critical", "Allocations must total 100%", `They currently total ${(totalBp / 100).toString()}%.`);
      updateBuy();
      const first = lines[0];
      if (first) $(`#alloc-${first.fund.id}`).focus();
      return;
    }
    alert.innerHTML = "";
    go(3);
  }

  // ---------- Step 3: Review ----------
  function renderReview() {
    const sells = sellLines().filter((l) => l.selected);
    const total = sellTotal();
    const buys = buyLines().lines.filter((l) => l.bp > 0);
    const td = tradeDate();
    const line = (name, sub, value) =>
      `<li class="line"><span>${esc(name)}<span class="line__sub">${esc(sub)}</span></span><span class="line__value">${value}</span></li>`;

    $("#screen").innerHTML = `
      <h2 class="screen__title" tabindex="-1">Review your exchange</h2>
      <p class="screen__intro">Check the details before you submit. Amounts are estimates until the trade is processed.</p>
      <div class="stack">
        <div class="columns">
          <section class="card card--padded" aria-labelledby="sell-h">
            <div class="card__head"><h3 class="card__title" id="sell-h">Selling</h3><button type="button" class="link-btn" data-action="edit-sell">Edit<span class="visually-hidden"> funds to sell</span></button></div>
            <ul class="line-list">
              ${sells.map((l) => line(l.fund.name, sellDescription(l.fund.id), money(l.cents))).join("")}
              <li class="line line--total"><span>Estimated total</span><span class="line__value">${money(total)}</span></li>
            </ul>
          </section>
          <section class="card card--padded" aria-labelledby="buy-h">
            <div class="card__head"><h3 class="card__title" id="buy-h">Buying</h3><button type="button" class="link-btn" data-action="edit-buy">Edit<span class="visually-hidden"> funds to buy</span></button></div>
            <ul class="line-list">
              ${buys.map((l) => line(l.fund.name, `${(l.bp / 100).toString()}%`, money(l.cents))).join("")}
              <li class="line line--total"><span>Estimated total</span><span class="line__value">${money(total)}</span></li>
            </ul>
          </section>
        </div>
        <section class="card card--padded" aria-labelledby="timing-h">
          <h3 class="card__title" id="timing-h">Trade timing</h3>
          <ul class="line-list">
            ${line("Estimated trade date", "Requests submitted after 4:00 p.m. ET are processed at the next business day’s closing prices.", fmtDate(td))}
          </ul>
        </section>
        ${infobar("warning", "Plan trading rules may apply", "Your plan may limit how soon you can buy back into a fund you sell. Check your plan’s trading policy before you submit.")}
      </div>
      <div class="screen-footer screen-footer--end">
        <div class="actions">
          <button type="button" class="btn" data-action="back">Back</button>
          <button type="button" class="btn btn--accent" data-action="submit">Submit exchange</button>
        </div>
      </div>`;
  }

  function submitExchange() {
    const now = new Date();
    const td = tradeDate(now);
    const num = "EX-" + String(Math.floor(100000 + Math.random() * 900000));
    state.submission = { number: num, submittedAt: now, tradeDate: td, cancelled: false };
    go(4);
    announce(`Exchange submitted. Confirmation number ${num}.`);
  }

  // ---------- Step 4: Confirmation ----------
  function renderConfirm() {
    const sub = state.submission;
    const sells = sellLines().filter((l) => l.selected);
    const buys = buyLines().lines.filter((l) => l.bp > 0);
    const total = sellTotal();
    const shortName = (n) => n.replace(/ Fund$/, "");
    const tdShort = fmtDate(sub.tradeDate, { weekday: "short", month: "short", day: "numeric" });
    const line = (name, subtext, value) =>
      `<li class="line"><span>${esc(name)}<span class="line__sub">${esc(subtext)}</span></span><span class="line__value">${value}</span></li>`;

    const banner = sub.cancelled
      ? infobar("info", "Exchange cancelled", `Confirmation number ${sub.number}. No trades will be placed.`)
      : infobar("success", "Exchange submitted", `Confirmation number ${sub.number}. It will be processed at the close on ${fmtDate(sub.tradeDate)}.`);

    $("#screen").innerHTML = `
      <h2 class="screen__title visually-hidden" tabindex="-1">Confirmation</h2>
      <div class="stack">
        ${banner}
        <div id="confirm-note"></div>
        <div class="columns">
          <section class="card card--padded" aria-labelledby="sum-h">
            <h3 class="card__title" id="sum-h">Summary</h3>
            <ul class="line-list">
              ${line(`Selling from ${sells.length} ${sells.length === 1 ? "fund" : "funds"}`, sells.map((l) => shortName(l.fund.name)).join(", "), money(total))}
              ${line(`Buying into ${buys.length} ${buys.length === 1 ? "fund" : "funds"}`, buys.map((l) => `${shortName(l.fund.name)} ${(l.bp / 100).toString()}%`).join(", "), money(total))}
              ${line("Status", `Submitted ${fmtTimestamp(sub.submittedAt)}`, sub.cancelled ? "Cancelled" : "Pending")}
            </ul>
          </section>
          <section class="card card--padded" aria-labelledby="next-h">
            <h3 class="card__title" id="next-h">What happens next</h3>
            ${sub.cancelled
              ? `<ul class="next-steps"><li>Your balances won’t change. You can start a new exchange at any time.</li></ul>`
              : `<ul class="next-steps">
                  <li>You can cancel this exchange until 4:00 p.m. ET on ${tdShort}.</li>
                  <li>Updated balances appear the business day after the trade is processed.</li>
                  <li>We’ll send a confirmation to the email on your account.</li>
                </ul>
                <p style="margin:12px 0 0"><button type="button" class="link-btn" data-action="cancel-exchange">Cancel this exchange</button></p>`}
          </section>
        </div>
      </div>
      <div class="screen-footer screen-footer--end">
        <div class="actions">
          <button type="button" class="btn" data-action="pending">View pending transactions</button>
          <button type="button" class="btn btn--accent" data-action="done">Done</button>
        </div>
      </div>`;
  }

  // ---------- Events (delegated) ----------
  document.addEventListener("change", (e) => {
    const t = e.target;
    const id = t.dataset.id;
    if (t.dataset.role === "select") {
      state.sells[id].selected = t.checked;
      if (!t.checked) Object.assign(state.sells[id], { method: "percent", value: "", touched: false });
      rerenderSellRow(id, "select");
      const alert = $("#sell-alert"); if (alert && t.checked) alert.innerHTML = "";
    } else if (t.dataset.role === "method") {
      Object.assign(state.sells[id], { method: t.value, value: "", touched: false });
      rerenderSellRow(id, "method");
    }
  });

  document.addEventListener("input", (e) => {
    const t = e.target;
    if (t.dataset.role === "amount") { state.sells[t.dataset.id].value = t.value; updateSell(); }
    if (t.dataset.role === "alloc") { state.buys[t.dataset.id] = t.value; updateBuy(); }
  });

  document.addEventListener("focusout", (e) => {
    const t = e.target;
    if (t.dataset.role === "amount") {
      const s = state.sells[t.dataset.id];
      s.touched = s.value.trim() !== "" || s.touched;
      // Tidy dollar formatting on blur: "10000" → "10,000.00"
      if (s.method === "dollars") {
        const c = parseDollars(s.value);
        if (c !== null) { s.value = (c / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); t.value = s.value; }
      }
      updateSell();
    }
  });

  document.addEventListener("submit", (e) => {
    e.preventDefault();
    if (e.target.id === "sell-form") submitSell();
    if (e.target.id === "buy-form") submitBuy();
  });

  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const a = btn.dataset.action;
    if (a === "back") go(state.step - 1);
    if (a === "edit-sell") go(1);
    if (a === "edit-buy") go(2);
    if (a === "submit") submitExchange();
    if (a === "cancel-exchange") {
      state.submission.cancelled = true;
      renderConfirm();
      announce("Exchange cancelled. No trades will be placed.");
      $(".screen__title").focus();
    }
    if (a === "pending") $("#confirm-note").innerHTML = infobar("info", "Not in this prototype", "Pending transactions would open here.");
    if (a === "done" || a === "reset") { state = freshState(); go(1); }
  });

  render();
})();
