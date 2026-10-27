# Performa Training Tests

Pre-test, post-test and evaluation form for Performa trainings. No workbook, only the tests.
Static site (no build step) on Vercel, data in Supabase, source on GitHub.

## Links (per session)

| Who | Path |
| --- | --- |
| Participants (menu) | `/s/<slug>` |
| Pre-test | `/s/<slug>/pre` |
| Post-test | `/s/<slug>/post` |
| Evaluation | `/s/<slug>/evaluasi` |
| Facilitator dashboard | `/admin/<slug>` (needs the facilitator passcode) |

Current session: `canva-dasar-jr-batam` (Canva Dasar untuk Profesional, PT Jasa Raharja Kantor Batam).

## How a session runs

1. Before training: open the **Pre-test** switch in the dashboard (it is open by default), share the pre-test link.
2. After training: open **Post-test** and **Evaluasi**, share the menu link.
3. Dashboard shows pre vs post per participant (matched by name), per-question mastery, evaluation averages, NPS and comments. CSV export has a `sep=;` first line so Excel in Indonesian locale opens it in columns.

## Design notes

- The answer key never leaves the database. Tests are scored server side; the browser only gets the question text.
- All tables live in a private `tt` schema (RLS on, no API grants). The browser calls `public.tt_*` functions through `/rest/v1/rpc/`.
- The facilitator passcode is stored as a bcrypt hash. It is not in this repo.
- One submission per name per form per session. The facilitator can delete a row from the dashboard.
- Names are matched case-insensitively with extra spaces ignored.

## Add a new session

Copy `supabase/migrations/20261027_02_tt_seed_canva_dasar_jr_batam.sql`, change the slug, title, client and the questions, and apply it.
The post-test should be a parallel form: same topics, new questions, correct answers in different positions.

## Local preview

```
npx serve .
```

`vercel.json` holds the route rewrites and the Content-Security-Policy. `config.js` holds the public Supabase URL and publishable key.
