# PenguJar Screenshot Plan

Capture real application and Arc Testnet state. Do not fabricate balances, transaction confirmations, wallet addresses, or explorer verification.

## Recommended captures

1. **Desktop dashboard** — connected Arc wallet, savings summary, and multiple jar states.
2. **Create Jar** — 24-hour date/time picker and review step; no wallet secret or unrelated extension UI.
3. **Active Jar detail** — saved amount, target, unlock time, owner, and contribution accounting.
4. **Activity history** — real creation, deposit, and contribution rows with transaction links.
5. **Share Jar** — canonical share/copy controls and subtle success feedback.
6. **Mobile dashboard** — 390px viewport showing compact hero, summary, Create Jar, and first jar.
7. **Dark mode** — jar detail or dashboard with readable cards and controls.
8. **Closed Jar #3** — Closed state, zero balance, preserved deposit and withdrawal history.
9. **ArcScan verified contract** — PenguJarV2 address, verified source/ABI, and Arc Testnet network context.

## Capture standards

- Use the production build and final public URL where possible.
- Prefer 1440×900 desktop and 390×844 mobile captures.
- Include the PenguJar header and enough context to identify the screen.
- Keep private keys, seed phrases, local `.env`, terminal history, and personal browser data out of frame.
- Truncate public wallet addresses in the app as designed; public testnet transaction hashes may be shown.
- Capture both English and Vietnamese across the set, and include at least one Light and one Dark image.

## Repository placement

After review, place approved optimized images in `docs/images/` and link them from the root README. Use descriptive names such as `dashboard-desktop.webp` and `jar-closed-mobile.webp`. Do not commit raw recordings or oversized source exports.
