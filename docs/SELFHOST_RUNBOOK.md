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

Send the printed `ORBIT.…` key to the customer. They paste it into
**Settings → Licence**.

**Changing a licence = issuing a new key.** There is no revocation and no
phone-home: a renewal, a seat change and a plan change are all just a
replacement key with a later `iat`. Their instance refuses any key older than
the one installed, so an old key can't be replayed to undo a change.

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
bundle, signs it, verifies its own output, then uploads it as an artifact.

Then: download the artifact, upload it wherever customers fetch from, and add a
changelog entry.

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
