# Running OrbitAPI on your own hardware

This guide covers installing OrbitAPI on a server you control, with no ongoing
internet connection required.

Everything stays on your machine: your data, your API credentials, and the AI
model itself.

---

## What you need

- A Linux server (Ubuntu 22.04+ or similar). 4 CPU cores, 8 GB RAM, 40 GB disk
  is comfortable for a small team.
- Docker Engine 24+ with the Compose plugin.
- An AI model server on your network — [Ollama](https://ollama.com),
  LM Studio, or vLLM. It can run on the same machine or another one.
  **Optional at install time**: simulated connectors work with no AI at all, so
  you can explore first and add it later.

Windows is supported through WSL2 but is community-tested rather than
officially supported. Linux is the tested path.

---

## Install

### 1. Get the files onto the machine

If the machine has internet:

```bash
git clone https://github.com/L33tG33k117/orbitapi.git
cd orbitapi/docker
```

If it does not, copy the repository across on a USB drive or internal share,
along with the image bundle from your OrbitAPI account.

**Where the bundle comes from:** sign in to your OrbitAPI account with the email
address on your licence, then go to **Settings → Downloads**. The installer is
there, with its checksum and the exact commands to run. Download it on any
machine with internet — it does not have to be the server, and usually isn't.

### 2. Load the images (offline installs only)

```bash
docker load -i images/orbit-app.tar
docker load -i images/postgres.tar
docker load -i images/gotrue.tar
docker load -i images/postgrest.tar
docker load -i images/nginx.tar
```

### 3. Run the installer

```bash
./orbit.sh install --url https://orbit.yourcompany.internal
```

The URL is whatever people will type into a browser. It can be a hostname or
an IP address.

This generates `docker/.env` with keys unique to your installation, creates a
self-signed certificate, and starts everything.

### 4. Create your account

Open the URL in a browser. The first visit shows a short setup wizard: create
the administrator account, name your workspace, and optionally point OrbitAPI
at your AI model.

That's it.

---

## ⚠️ Back up your `.env` file

**Do this now, before you put any real credentials in.**

`docker/.env` contains `ORBIT_SECRETS_KEY`, which encrypts every API credential
stored in the database. It is not recoverable — not by you, not by us. If you
lose it, every connection has to be set up again from scratch.

That is deliberate: it is what makes a stolen database backup useless.

Store a copy somewhere off this machine — a password manager or your normal
secrets store. A database backup **without** this file cannot be restored into
a working system.

---

## Everyday commands

All of these run from the `docker/` directory.

| Command | What it does |
|---|---|
| `./orbit.sh status` | What's running, and whether it's healthy |
| `./orbit.sh logs` | Follow the logs (add a service name to narrow it) |
| `./orbit.sh restart` | Restart everything |
| `./orbit.sh backup` | Dump the database to `./backups` |
| `./orbit.sh update <bundle>` | Apply an update you downloaded |
| `./orbit.sh rollback` | Go back to the previous version |
| `./orbit.sh support-bundle` | Build a redacted archive to send to support |

---

## Firewall rules

OrbitAPI itself makes **no outbound requests**. It only reaches out on behalf
of the apps you connect, plus your AI model server if that runs elsewhere.

The exact list depends on which apps you've connected, so it's generated for
you rather than printed here:

**Settings → Network Access** shows every hostname, filtered to just the apps
you actually use, with a downloadable `.txt` (one host per line) or `.json`.

Three kinds of entry appear there:

- **Fixed hostnames** — allow them as-is, e.g. `api.github.com`.
- **Patterns like `<your-subdomain>.zendesk.com`** — replace the bracketed part
  with your own value, the same one you entered when connecting the app.
- **"No internet rule needed"** — apps where you supplied the address yourself.
  If that address is inside your network, nothing needs opening at all.

Each connector's own page also shows its hosts, so you can check before
connecting rather than after it fails.

---

## Adding people

Public signup is disabled: accounts are created by an administrator.

**Settings → Members → Invite.** Enter their email and role. Because your
server probably can't send email, OrbitAPI gives you a **one-time link** to
pass on however you normally would. They use it to set their own password.

If you do have an SMTP server, add the `SMTP_*` values to `docker/.env` and
restart — invitations and password resets will then be emailed as normal.

---

## Connecting your AI model

**Settings → AI Provider.**

Enter the address of your model server and the model name, then press **Test
connection** before saving. Testing first means a wrong address fails here,
with a message next to the field, rather than silently at 3am inside a
scheduled automation.

With Ollama on the same machine:

```
Address:  http://host.docker.internal:11434/v1
Model:    llama3.1:70b
```

On another machine, use its IP: `http://192.168.1.50:11434/v1`.

**Which model?** Use a recent 30B-or-larger instruct model with tool-calling
support. OrbitAPI drives multi-step work — read from one app, decide, act in
another — and smaller models tend to lose the thread partway through. If a
complex skill misbehaves, splitting it into simpler steps usually helps more
than changing model.

---

## Your licence

**Settings → Licence** shows what this installation is licensed for and when it
expires.

**Lost your key?** Sign in to your OrbitAPI account and go to
**Settings → Downloads**. Your current key is there whenever you need it — you
never have to go looking through old emails or ask support.

Changes — a renewal, more seats, a different plan — arrive as a **replacement
key**. Paste it in, check the summary of what it changes, and apply. There is
nothing to activate online.

**Renewing:** from the same page, "Request a renewal" reaches us directly. It
appears from 60 days before expiry.

### Checking for updates

Once a day, this installation can ask OrbitAPI whether a newer version is
available and whether your licence has changed. It sends your licence key, the
version you are running, and your installation id — **nothing about your data,
your workspaces, or your connections**.

It is on by default and can be turned off in **Settings → Licence**. Turned off,
this installation never contacts us; you simply won't be told when an update is
released. An air-gapped machine can't reach us either way, and nothing breaks
when the check fails — that's the configuration this edition was built for.

If a licence lapses there is a **30-day grace period** during which nothing
changes at all. After that, automation features pause until it is renewed.

**Your data is never locked.** Even with an expired licence you can read and
export everything in this installation. That is deliberate: losing access to
your own operational data because an invoice was late would be unacceptable.

---

## Updates

Updates are files, not downloads from this machine.

1. On any machine with internet, sign in to your OrbitAPI account and go to
   **Settings → Downloads**. The newest build is at the top; older ones are
   listed below it.
2. Copy the file to your server.
3. Run `./orbit.sh update orbit-selfhost-1.2.3.tar.gz`.

The Downloads page also shows the checksum, so you can confirm the file
survived the trip before you apply it.

The bundle is checked before anything is applied: its contents are verified
against their checksums and its signature against our release key. A bundle
that fails either check is refused.

The update backs up your database first, loads the new images, applies any
database changes, and restarts. If something looks wrong afterwards:

```bash
./orbit.sh rollback
```

**Rollback restores the previous code, not the previous data.** Database
changes are not reversed. If an update changed the database structure, restore
the pre-update dump from `./backups` — and be aware that anything created since
the update will be lost.

---

## What's different from OrbitAPI Cloud

| | Self-hosted | Cloud |
|---|---|---|
| AI model | Yours, on your hardware | Claude, managed by us |
| AI usage limits | None — you own the hardware | AI Power allowance |
| Billing | Licensed directly, no billing screens | Plans and top-ups |
| Accounts | Created by an administrator | Public signup |
| Single sign-on | Not available | Available |
| Webhooks and MCP | Work, but only from your network | Work from anywhere |
| Updates | Files you apply | Automatic |

---

## Troubleshooting

**The app won't start.**
`./orbit.sh logs orbit-app`. The most common cause is a missing value in
`.env` — the container says which one and stops rather than starting in a
broken state.

**"Orbit couldn't reach your AI model server."**
The model server isn't running, or isn't reachable from inside Docker. If it's
on the same machine, use `host.docker.internal` rather than `localhost` —
inside a container, `localhost` is the container itself.

**A connector times out.**
Almost always the firewall. Check Settings → Network Access for that app's
hostname and confirm it's allowed.

**Someone can't sign in and there's no email.**
Settings → Members → invite them again to generate a fresh one-time link.

**Still stuck?**
`./orbit.sh support-bundle` collects logs, container status and a redacted copy
of your configuration into one archive. Secrets are replaced with
`<redacted>`, but please skim it before sending.
