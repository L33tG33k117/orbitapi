# Self-hosted: internal runbook

Not for customers. This is how *we* issue licences and cut releases.

---

## Signing keys — both are set up ✅

Done on 2026-08-05. Recorded here so nobody regenerates them by mistake:
**issuing a new `k1` would invalidate every licence already in the field.**

### Licence key `k1`

Public half is in `PUBLIC_KEYS` in `lib/license.ts`. Licences verify.

**The private half must live in the founder's password manager** — it is the
only copy, it is not in the repo, and anyone holding it can mint licences.

### Release key `r1`

Public half is in `RELEASE_PUBLIC_KEYS` in `scripts/verify-bundle.mjs`.
Private half is stored as the GitHub repo secret `RELEASE_SIGNING_KEY`, so
`release.yml` produces signed bundles automatically.

Deliberately a **separate** key from `k1`: a leaked licence key must not also
let someone forge an update bundle.

### Rotating

Add a new entry (`k2`, `r2`) alongside the old one rather than replacing it —
existing licences and bundles keep verifying against the key they were signed
with, and new ones are issued under the new `kid`.

---

## Issuing a licence

**Use Admin → Self-hosted.** Add the customer, then *Issue 12-month licence*.
The key is signed, verified against the same code their install runs, copied to
your clipboard, and recorded — and *Email it* opens a pre-written message. No
terminal, no private key on a laptop.

This requires `LICENSE_SIGNING_KEY` in the Vercel environment, set to the
**private** half of `k1` (the public half is already in `lib/license.ts`). If it
is missing the page says so and issuing is disabled; everything else still works.

Renewals are the same button — it reads *Renew 12 months* once a licence exists.

**Re-sending is not re-issuing.** Use *Show current key* to hand over the
existing key. Issuing a fresh one bumps `iat`, and their install refuses any key
older than the one already applied — so minting a replacement just to resend it
can strand a customer mid-renewal.

<details>
<summary>CLI fallback (<code>scripts/license-issue.mjs</code>)</summary>

Still works, and is the way out if the cloud is down or the admin page is
broken. It records nothing in the ledger, so add the customer afterwards.

```bash
node scripts/license-issue.mjs issue \
  --customer "Acme Ltd" \
  --email ops@acme.com \
  --tier enterprise \
  --seats 25 \
  --months 12 \
  --kid k1 \
  --private-key ~/secure/k1.private.pem
```
</details>

Either way the customer pastes the `ORBIT.…` key into **Settings → Licence**.

**Changing a licence = issuing a new key.** A renewal, a seat change and a plan
change are all just a replacement key with a later `iat`. Their instance refuses
any key older than the one installed, so an old key can't be replayed to undo a
change.

---

## Withdrawing a licence

*Admin → Self-hosted → Withdraw licence.* Be precise about what this does,
because the name promises more than the mechanism can deliver.

**Immediately, always:** their downloads stop and they can no longer retrieve
their licence key from their account.

**Within a day, if their install has internet:** the next check-in returns
`revoked`, and the installation collapses to the free-tier floor with your
reason shown to their administrator. Their data and exports keep working —
that promise is never broken, for any reason.

**Never, on an air-gapped install:** there is no mechanism, and there cannot be
one. Licences verify locally against an embedded public key, which is the whole
reason the offline edition works. Their signed key runs until it expires.

So the real lever on a customer who has stopped paying is **not renewing**:
their key expires, then 30 days of grace, then automation pauses. Withdrawing is
for the case where you also want to cut off downloads and self-service today.

Treat check-in as enforcement, not security. A customer who controls the server
can block it, and the product is designed to be completely unaffected when they
do. Expiry is what actually bounds the damage. Withdrawal is reversible —
reinstating does not require issuing a new key.

Copying a key to a second install is possible and not worth engineering
against — offline validation cannot detect it. Seat limits bound the damage.

---

## Cutting a release

```bash
git tag selfhost-v1.2.3
git push origin selfhost-v1.2.3
```

The workflow verifies the code first (`tsc`, connector and bundle integrity,
the full offline suite), builds and pulls all five images, assembles the
bundle, signs it, verifies its own output, uploads it as an artifact, **pushes
it to Blob, and registers it** — at which point it appears on every entitled
customer's Settings → Downloads page. Cutting the tag is the whole job.

Three settings make the last two steps work. If any is missing the workflow
warns rather than failing, and the build simply is not published:

| Where | Name | Value |
|---|---|---|
| Actions secret | `BLOB_READ_WRITE_TOKEN` | Blob store read-write token |
| Actions secret | `RELEASE_REGISTRY_SECRET` | Same value as the app's env var |
| Actions variable | `RELEASE_REGISTRY_URL` | `https://<production domain>` |

Check the result in **Admin → Self-hosted → Releases**. A build that turns out
bad can be *pulled from downloads* there — it stops being offered without
destroying the record that it existed, which matters because someone may
already be running it.

**Bundles are multi-GB.** Keep the last few releases and prune older ones.
Delta bundles are a later idea — don't build them until someone complains.

---

## Supporting an install

Ask for a support bundle:

```bash
./orbit.sh support-bundle
```

Secrets are redacted. It contains container status, the last 200 log lines per
service, the health endpoint output, and the configuration with keys replaced.

Common causes, roughly in order of frequency:

| Symptom | Usually |
|---|---|
| A connector times out | Firewall. Settings → Network Access has the hostname. |
| "Couldn't reach your AI model server" | Model server down, or `localhost` used instead of `host.docker.internal`. |
| Skills produce nonsense | Model too small. Recommend 30B+ with tool calling. |
| Nobody can sign in | No SMTP; generate a fresh invite link from Members. |
| App won't start | Missing value in `.env` — the container names it and exits. |

---

## Things that will bite us

- **A customer loses `ORBIT_SECRETS_KEY`.** Every stored credential becomes
  unrecoverable and must be re-entered. There is no back door, by design. The
  installer, the wizard and the docs all say to back it up; expect it to happen
  anyway.
- **GoTrue drift.** `supabase/gotrue` is pinned in `docker-compose.yml`. Before
  changing that pin, re-check the 13 migrations that reference `auth.users` and
  the `on_auth_user_created` trigger.
- **The two-environment tax.** Roughly 10–15% ongoing overhead on feature work.
  The `selfhost` CI job is what keeps it from becoming a surprise; if it starts
  being skipped or ignored, that cost lands on a customer instead.
