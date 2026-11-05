# Run the Ozy demo on your computer

This folder holds the whole demo. It runs on macOS (Apple Silicon or Intel), Windows and Linux.

## One-time setup

1. **Node.js 22 or newer.** Download the LTS installer from https://nodejs.org and run it.
2. **pnpm 10.** In a terminal (Terminal on a Mac, PowerShell on Windows), run:

   ```bash
   npm install -g pnpm@10
   ```

   If that fails with a permissions error, put `npx pnpm@10` in front of every command below instead of `pnpm`. For example: `npx pnpm@10 install`.

## Start the demo

In a terminal, inside this folder (the one that contains this file):

```bash
pnpm install
pnpm demo
```

`pnpm install` downloads the dependencies the first time, which takes a minute or two. You only need to repeat it after you get a new version of the folder. `pnpm demo` starts the demo and opens **http://localhost:5173/prepare** in your browser. Press **Ctrl+C** in the terminal to stop it.

## Walk through it

1. On `/prepare`, click **Continue without a password**. This option exists only in this local development version, never on demo.ozyntel.ai.
2. Click **Load synthetic example (dev only)**. It loads a made-up company, "Sample organisation (synthetic)".
3. Click **Show in the demo**, then **Open the demo →**.

- The **Register your interest** wording is on the last page, `/brief`.
- The visual vocabulary preview is at http://localhost:5173/dev/visual-preview.
- To prepare a real lead instead, use **New blank case** on `/prepare`. Everything is saved only in this browser. See `artifacts/digital-twin/docs/LEAD-DEMO.md`.
- The LOI and contact forms don't send anything locally, because no email server runs on your computer. That's expected.

## Using it from a Claude session on your computer

In the Claude desktop app, start a Claude Code session on your computer and choose **this folder** as the session's folder. Then ask it to "follow START-HERE.md and start the demo".

## Getting updates

This folder is a snapshot of the branch `claude/brave-meitner-fce75r`. To follow later changes, clone it with git instead of downloading a new zip:

```bash
git clone --branch claude/brave-meitner-fce75r https://github.com/Ozyntel/ozyntel-digital-twin-demo.git
```
