# FareLedger

A mobile app for bus operators to record the **daily ticket collection**, deduct expenses, and settle the **driver's share, conductor's share and owner's cut**, with statements, reports, backup and an app lock. It works fully offline: all data is stored in SQLite on the phone.

Built with Expo (React Native) and TypeScript.

<p>
  <img src="assets/icon.png" alt="FareLedger icon" width="96" />
</p>

---

## Contents

- [Features](#features)
- [How the settlement works](#how-the-settlement-works)
- [Screens](#screens)
- [Tech stack](#tech-stack)
- [Getting started](#getting-started)
- [First run and defaults](#first-run-and-defaults)
- [Currency](#currency)
- [Project structure](#project-structure)
- [Data model](#data-model)
- [Backup and restore](#backup-and-restore)
- [Security](#security)
- [Theming](#theming)
- [Testing](#testing)
- [Building a release](#building-a-release)
- [Troubleshooting](#troubleshooting)
- [Roadmap](#roadmap)
- [License](#license)

---

## Features

**Daily entry (4-step wizard)**
- **Crew:** date and time (native calendar and clock pickers), plus bus, driver and conductor. Each is a type-to-search box on the same screen, with a "+ Create" option when there is no match. A bus shows its owner once selected.
- **Tickets:** every active ticket value (for example 10, 15, 18) starts with a bundle of 100 issued. Enter the returned count; sold and amount update live. The issued count can be edited per entry.
- **Expenses:** any number of rows, each with a head (Fine, Spot Fine, Return Tickets, Diesel and your own), an amount and a note. Adding a row puts the cursor straight into its Head field.
- **Settlement:** the Driver and Conductor shares appear as large coloured cards, followed by the owner's cut, entry details, tickets, expenses and the collection summary.
- Back and Next on every step, validation before moving on, and an early warning if the bus already has an entry for that date.
- One entry per bus per day. Saved entries can be edited or deleted.

**Home**
- Branded header with the logo, app name and today's date.
- Today's net and owner's cut at a glance, and today's entries as tiles with Gross, Expenses, Net and the Driver, Conductor and Owner shares.
- An eye icon on each tile opens a read-only settlement preview. A floating **+** button starts a new entry.

**Reports**
- Totals for Today, This month, All time or a custom range chosen on a calendar range picker.
- Breakdowns by bus, driver wages, conductor wages and expense head.

**Statements** (Bus, Driver, Conductor, each with its own colour)
- Pick a subject and a date range from a collapsible filter. Each tab starts blank and remembers its own selection.
- One tile per entry: the bus tile shows the date and the Owner, Driver and Conductor shares; driver and conductor tiles show the date and time, the bus and their own earning. Every tile has a preview button.
- A Total tile at the bottom.

**Settings**
- Appearance: System, Light or Dark.
- Currency: choose the symbol shown for all amounts (default USD, with INR, EUR, GBP and many more). It only changes how amounts are displayed; saved entries are not converted.
- Security: PIN lock with optional fingerprint or face unlock.
- People: list, add, rename and hide buses, drivers and conductors, and set a bus owner.
- Ticket values, expense heads, driver and conductor percentages, and the default issue count.
- Backup and restore as a JSON file.

---

## How the settlement works

```
per ticket value:  sold   = issued − returned          (issued defaults to 100)
                   amount = sold × price
gross       = sum of amounts
expenses    = deductions − additions                   (every head is a deduction by default)
net         = gross − expenses
driver      = net × driver %                           (default 15)
conductor   = net × conductor %                        (default 9)
owner's cut = net − driver − conductor
```

Amounts are rounded to 2 decimals. Each saved entry stores the prices, issued counts and percentages it was calculated with, so changing a price or percentage in Settings never alters past entries or reports.

Worked example (from the original paper sheet):

| Ticket | Returned | Sold | Amount |
|---|---|---|---|
| 10 | 20 | 80 | 800.00 |
| 15 | 10 | 90 | 1,350.00 |
| 18 | 10 | 90 | 1,620.00 |
| **Gross** | | | **3,770.00** |

With 220.00 of expenses: net 3,550.00, driver 532.50, conductor 319.50, owner 2,698.00.

The calculation lives in [`src/domain/calc.ts`](src/domain/calc.ts).

---

## Screens

| Tab / screen | Purpose |
|---|---|
| **Daily** | Today's entries, summary card, floating **+** button |
| **Reports** | Totals and breakdowns for a period or custom range |
| **Statements** | Bus, driver and conductor statements as tiles |
| **Settings** | Appearance, currency, security, people, prices, heads, rates, backup |
| New / edit entry | The 4-step wizard |
| Settlement preview | Read-only settlement for a saved entry |
| Manage people | Buses, drivers and conductors |

---

## Tech stack

| | |
|---|---|
| Framework | Expo SDK 58, React Native 0.88, React 19 |
| Language | TypeScript (strict) |
| Navigation | Expo Router (file-based routes, tabs and stack) |
| Database | `expo-sqlite` |
| Backup | `expo-file-system`, `expo-sharing`, `expo-document-picker` |
| Lock | `expo-local-authentication`, `expo-secure-store`, `expo-crypto` |
| Date pickers | `@react-native-community/datetimepicker`, plus an in-house calendar range picker |
| Icons | `@expo/vector-icons` |

There is no backend and no account. The app does not use the network.

---

## Getting started

Requirements: **Node 22.18 or newer** (the tests run TypeScript directly) and a phone with **Expo Go** (or an emulator or simulator). The Expo Go app must support the project's SDK (58).

```bash
npm install
npx expo start
```

Scan the QR code with Expo Go (the phone and computer must be on the same Wi-Fi). Use `npx expo start --tunnel` if they are not, and `npx expo start --clear` after changing dependencies.

All tools are installed inside the project folder. Do not install Expo or EAS globally; use `npx`.

Other scripts:

```bash
npm run typecheck   # TypeScript check
npm test            # unit tests for the calculation
```

`.npmrc` sets `legacy-peer-deps=true` for this project. Without it `npm install` fails on an optional React peer conflict.

Expo Go always shows its own icon and splash screen. To see FareLedger's icon, splash and Face ID, use a development build.

---

## First run and defaults

On first launch the database is created and seeded with:

| Setting | Default |
|---|---|
| Ticket values | 10, 15, 18 (change them in Settings) |
| Expense heads | Fine, Spot Fine, Return Tickets (fixed) and Diesel |
| Driver share | 15% |
| Conductor share | 9% |
| Default issue count | 100 per ticket value |
| Currency | USD |
| Theme | System |
| App lock | Off |

Typical flow: open **Settings** and set the currency, ticket values and percentages, then tap the floating **+** on the Daily tab. Buses, drivers and conductors are created while you fill in the first entry, and can be edited later under Settings → People.

Fixed expense heads cannot be removed. Your own heads can be hidden and shown again. Retiring a ticket value hides it from new entries only; old entries keep their prices.

---

## Currency

Settings → Currency sets the symbol used for every amount and ticket price. The default is **USD ($)**. Available: USD, EUR, GBP, INR, BDT, NPR, LKR, PKR, AED, SAR, AUD, CAD, SGD, MYR, IDR, PHP, THB, JPY, CNY, ZAR, NGN, KES, BRL and MXN.

- Amounts always show two decimals, with the sign in front of the symbol (`-$5.00`).
- INR, BDT, NPR, LKR and PKR group digits the South Asian way (1,00,000); the others use 1,000,000.
- The currency only changes how numbers are displayed. Nothing is converted, so switch it back if you chose the wrong one. The choice is saved with the other settings and included in backups.
- To add a currency, add an entry to `CURRENCIES` in [`src/theme.ts`](src/theme.ts).

---

## Project structure

```
app/                         Expo Router routes
  _layout.tsx                  Providers (SQLite, theme, lock) and the root stack
  (tabs)/                      Daily, Reports, Statements, Settings
  entry/new.tsx                New entry
  entry/[id].tsx               Edit entry
  entry/preview/[id].tsx       Read-only settlement preview
  manage.tsx                   Buses, drivers and conductors
src/
  domain/calc.ts               Settlement maths (pure, unit tested)
  db/schema.ts                 Migrations (SQLite user_version)
  db/repo.ts                   All queries
  db/backup.ts                 Export, import and restore
  components/                  EntryForm, SettlementView, ui, PinPad, DateRangePicker, HomeHeader
  ThemeContext.tsx             Light, dark and system theme
  LockContext.tsx              PIN and biometric lock
  hooks/useKeyboardHeight.ts   Lifts content above the keyboard
  theme.ts                     Colour palettes and formatting helpers
assets/                      Icon, adaptive icon, splash screens
assets/branding/             Original logo files
tests/calc.test.mts          Calculation tests
```

---

## Data model

SQLite database `tktcalc.db`. The schema is versioned with `PRAGMA user_version` and migrated on start (currently version 3).

```
buses            id, number (unique), owner, active
drivers          id, name (unique), active
conductors       id, name (unique), active
ticket_prices    id, value (unique), active
expense_heads    id, name (unique), type (deduction | addition), is_system, active
settings         key, value                                       -- see below

daily_entries    id, entry_date, entry_time, bus_id, driver_id, conductor_id,
                 driver_pct, conductor_pct,                       -- snapshot at save time
                 gross, total_expenses, net, driver_wage, conductor_wage, owner_cut
                 UNIQUE (bus_id, entry_date)
entry_tickets    entry_id, price, issued, returned, sold, amount  -- price is a snapshot
entry_expenses   entry_id, head_id, head_name, type, amount, note
```

Buses, drivers, conductors, prices and heads are hidden (not deleted) when retired, so past entries keep their references.

Keys used in `settings`:

| Key | Meaning |
|---|---|
| `driver_pct`, `conductor_pct` | Wage percentages for new entries |
| `default_issue_count` | Tickets issued per value for new entries |
| `currency` | Currency code, for example `USD` |
| `theme` | `system`, `light` or `dark` |
| `app_lock`, `lock_biometric` | Lock switches (kept on the device, never exported) |

The 4-digit PIN is not in the database. It lives in the phone's secure store.

---

## Backup and restore

All data lives only on the phone, so back it up regularly.

- **Export** (Settings → Backup and restore) writes `fareledger-backup-YYYYMMDD-HHmm.json` and opens the share sheet, so you can save it to Drive, email or WhatsApp.
- **Import** reads a backup, shows its entry count and date, and asks for confirmation. It then **replaces everything** in one transaction, so a failed restore changes nothing. Files from a newer app version or from another app are rejected.
- The file contains every table, including people, prices, heads, settings and all entries. It is **not encrypted**; store it somewhere private.
- Lock settings stay on the device and are never exported or overwritten by an import.

---

## Security

- **App lock:** a 4-digit PIN, with fingerprint or face unlock as an option. The PIN is stored only as a salted SHA-256 hash in the phone's secure store, never in the database.
- The app locks when it opens and after 30 seconds in the background. Five wrong PINs trigger a 30-second cooldown.
- **Forgot PIN:** the phone's own screen lock proves ownership and lets you choose a new PIN.
- Changing the PIN or turning the lock off requires the current PIN.

Limits: the lock stops casual access, but the SQLite file and exported backups are not encrypted, and the app switcher may show a snapshot of the last screen.

---

## Theming

System, Light and Dark. The choice is saved in the database. The palette is a single mutable object in [`src/theme.ts`](src/theme.ts); [`ThemeContext`](src/ThemeContext.tsx) updates it and rebuilds the shared styles, and screens subscribe with `useTheme()`. Any new screen that uses `colors` should call `useTheme()` so it re-renders when the theme changes.

---

## Testing

```bash
npm test
```

Covers the settlement maths: the worked example, additions, clamping of returns, custom issue counts, and that the shares plus the owner's cut always add back to the net. The UI has been checked by hand on a phone through Expo Go.

---

## Building a release

The app id is `com.fareledger.app` (Android package and iOS bundle identifier). Choose the final id before the first store release, because it cannot be changed afterwards. Use EAS Build through `npx`:

```bash
npx eas-cli build --platform android --profile production
```

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `npm install` fails with a peer dependency error | Make sure `.npmrc` (with `legacy-peer-deps=true`) is present, then reinstall |
| Expo Go says the project is incompatible | Expo Go and the project must use the same SDK. Update Expo Go, or run `npx expo install --fix` |
| "Port 8081 is running this app in another window" | An earlier server is still running. Stop it with `Ctrl+C` in its terminal, or accept the next port |
| Changes do not appear after updating dependencies | Restart with `npx expo start --clear` |
| The phone cannot connect | Use the same Wi-Fi as the computer, or run `npx expo start --tunnel` |
| Forgot the PIN | Use "Forgot PIN?" on the lock screen. The phone's own screen lock lets you set a new one |
| Moved to a new phone | Export a backup on the old phone, import it on the new one, then set the lock again. Lock settings are not exported |

---

## Roadmap

- Automatic backup reminders and CSV export of statements
- Encrypted backups
- Optional hide-on-app-switcher privacy screen
- Multi-device sync (would need a backend)

---

## License

No license has been chosen yet. Until one is added, all rights are reserved by the author.
