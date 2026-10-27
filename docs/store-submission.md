# Store submission (App Store and Google Play)

Everything needed in the App Store Connect and Play Console forms, in one place.
Keep it up to date when any of these change.

## Demo account for reviewers

Apple and Google reviewers cannot receive our sign-in emails, so a dedicated
account signs in with a code instead of a magic link.

| Field | Value |
|---|---|
| Email / username | `review@padmakara.pt` |
| Code / password | the value of `REVIEW_ACCOUNT_CODE` in the production API `.env` (not stored in git) |

Read the code with:

```bash
ssh padmakara@admin.padmakara.pt 'grep ^REVIEW_ACCOUNT_CODE= ~/padmakara-api/.env'
```

Notes for the reviewer (App Store "Notes", Play Console "Instructions"):

> Members normally sign in with a link sent by email. This demo account signs in
> with a code instead, so you don't need access to a mailbox: enter the email
> above, then the code when asked.

How it works:
- The API (`POST /api/auth/request-magic-link`) answers `code_required` for this
  email only, then `POST /api/auth/review-login` checks the code. Everything after
  sign-in is the same as for any member.
- The account is "App Review" (user id 6 on prod), a plain member of the retreat
  groups Mind Training 1 and 2 (ids 17 and 18), with an admin-granted membership
  so it can open their retreats. The admin shows it with a "Review account" chip:
  do not delete it or remove it from its groups — Apple and Google re-review every
  update.
- Changing the code: edit `REVIEW_ACCOUNT_CODE` in the prod `.env`, restart
  `padmakara-api`, and update the code in both store consoles. An empty value
  turns the feature off.
- Re-creating the account: `bun run src/scripts/create-review-account.ts --groups 17,18`
  in `padmakara-api` on the server (idempotent), then grant the membership again
  in the admin (status active, source admin, far-future expiry).
- The app must be a build that includes the review-code step (merged 2026-10-27);
  older builds treat `code_required` as an error.

## Public URLs

| Purpose | URL |
|---|---|
| Privacy policy | https://app.padmakara.pt/privacy-policy |
| Account deletion (Play "Data safety" → delete account URL) | https://app.padmakara.pt/account-deletion |

In the app, account deletion is under Settings → Delete account.

## Payments (both stores)

The native app is a "reader" / consumption-only app: it never shows a price, a
pay or donate button, or a link to the website's membership page, and never uses
the words subscription/subscribe/subscrição/subscrever/assinatura. Membership is
paid on the website only (Easypay). Do not enrol in Google Play's alternative or
external billing programs. An in-app donate/member button would break both stores'
rules (see DECISIONS.md and the reader-app gating on `Platform.OS === 'web'`).

## Google Play specifics

- Account: organisation account under tech@padmakara.pt (needs the association's
  D-U-N-S number). Package: `org.padmakara.pt`.
- First upload is manual in Play Console; later ones via
  `eas build -p android --profile production` then `eas submit -p android --profile production`
  (service account key at `./secrets/play-service-account.json`, not in git).
- Foreground service declaration (media playback): needs a short video of a user
  starting audio playback, then leaving the app with the lock-screen controls.
- Data safety: collected — email, name, user id, device id, app interactions
  (progress, bookmarks), crash logs (Sentry); encrypted in transit; deletion
  available. Payment data is collected by Easypay on the website only.
- Content rating: religious content, no violence, no user-generated content, no
  in-app purchases. Target audience: 18+.

## Apple specifics

- App Review Information → Sign-in required: the demo account above, plus the note.
- Guideline 5.1.1(v): account deletion is in the app (Settings → Delete account).
