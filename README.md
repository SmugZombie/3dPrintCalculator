# 3D Print Cost Calculator (Free & Open Source)

A free, open-source, no-signup 3D print cost calculator inspired by commercial
tools in this space. Every "pro" feature is unlocked and free:

- Unlimited saved quotes, stored locally in your browser
- Custom filament/resin library from any supplier
- Custom printer profiles (power draw, purchase cost, expected lifetime)
- Multi-material quotes (multiple filaments/resins per part)
- Batch production with a one-time setup time, auto-amortized across the batch
- Hardware & packaging stock tracking (quotes can deduct from inventory)

There is no account, no backend, no telemetry. All data (filaments, printers,
inventory, quotes, settings) lives in your browser's `localStorage`. Use the
Settings tab to export/import a full JSON backup at any time.

## How the numbers are calculated

- **Material cost** = weight (g) ÷ 1000 × cost per kg, summed across every
  material line for multi-material prints.
- **Machine hourly rate** = (printer purchase cost ÷ expected lifetime hours)
  + (printer power in kW × electricity price per kWh).
- **Machine cost** = total print hours × machine hourly rate.
- **Labor cost** = total labor minutes ÷ 60 × labor hourly rate.
- **Batch production**: one-time setup time is added once per batch; print
  and labor time per unit are multiplied by quantity.
- **Total landed cost** = material + hardware + packaging + labor + machine.
- **Suggested pricing** applies four preset margins (Competitive +25%,
  Standard +40%, Premium +60%, Luxury +80%) plus a custom margin, each shown
  before and after VAT.

## Running it

No build step, no dependencies — it's plain HTML/CSS/JS.

### Option 1: Open directly

Just open `index.html` in your browser.

### Option 2: Local static server

```bash
python3 -m http.server 8080
# then visit http://localhost:8080
```

### Option 3: Docker

```bash
docker compose up -d
# then visit http://localhost:8080
```

or without Compose:

```bash
docker build -t 3dprintcalculator .
docker run -d -p 8080:80 3dprintcalculator
```

## Data & privacy

Everything is stored in your browser's `localStorage` under keys prefixed
`3dpcc.*`. Nothing is sent to any server. Clearing your browser data will
erase it — use **Settings → Backup & Restore** to export a JSON backup
regularly or to move your data to another browser/machine.

## License

MIT — see [LICENSE](LICENSE).
