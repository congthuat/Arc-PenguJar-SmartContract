# 04 — Wireframe

## Screen A — Dashboard

```text
┌──────────────────────────────────────────────┐
│ PenguJar 🐧                    [0x12...89ab] │
├──────────────────────────────────────────────┤
│ Save USDC for something that matters.       │
│                              [+ Create Jar]  │
│                                              │
│ My Jars                                      │
│ ┌──────────────────┐  ┌──────────────────┐   │
│ │ 🏍 New Bike       │  │ ✈️ Da Lat Trip    │   │
│ │ 320 / 2,000 USDC │  │ 180 / 500 USDC   │   │
│ │ ███░░░░░░ 16%    │  │ ████░░░░ 36%     │   │
│ │ Unlock: 20 Sep   │  │ Unlock: 01 Oct   │   │
│ │ [View Jar]       │  │ [View Jar]       │   │
│ └──────────────────┘  └──────────────────┘   │
└──────────────────────────────────────────────┘
```

### UX rule
Không hiển thị raw chain data ở màn chính. Người dùng cần thấy “bao nhiêu / mục tiêu / khi nào mở”.

---

## Screen B — Create Jar

```text
┌──────────────────────────────────┐
│ Create a new jar                 │
│                                  │
│ Jar name                         │
│ [ Da Lat Trip                 ]  │
│                                  │
│ Target                           │
│ [ 500                        ] USDC
│                                  │
│ Unlock date                      │
│ [ 01 / 10 / 2026              ] │
│                                  │
│ Starting deposit (optional)      │
│ [ 50                         ] USDC
│                                  │
│ You cannot withdraw before the   │
│ unlock date once funds are added.│
│                                  │
│ [Cancel]          [Create Jar]   │
└──────────────────────────────────┘
```

---

## Screen C — Jar Detail / Owner

```text
┌──────────────────────────────────────────────┐
│ ← My Jars                         [Share]     │
│                                              │
│ ✈️ Da Lat Trip                               │
│ 180.00 / 500.00 USDC                         │
│ ███████░░░░░░░ 36%                          │
│                                              │
│ 🔒 Unlocks 01 Oct 2026                       │
│ 49 days remaining                            │
│                                              │
│ Add to this jar                              │
│ [ 25.00                    ] USDC             │
│ [Add USDC]                                   │
│                                              │
│ Contributions: 3                             │
│                                              │
│ [Withdraw]  disabled until unlock            │
└──────────────────────────────────────────────┘
```

After unlock:
- lock copy becomes `Ready to withdraw`.
- deposit/contribute UI hidden/disabled.
- Withdraw becomes primary action.

---

## Screen D — Shared Jar / Contributor

```text
┌──────────────────────────────────────────────┐
│ PenguJar                                     │
│                                              │
│ Help fund: ✈️ Da Lat Trip                    │
│ 180 / 500 USDC · 36%                         │
│ Unlocks 01 Oct 2026                          │
│                                              │
│ Important: contributions belong to the jar  │
│ owner. You will not be able to withdraw them.│
│                                              │
│ Your contribution                            │
│ [ 10.00                    ] USDC             │
│                                              │
│ [Connect Wallet / Contribute]                │
└──────────────────────────────────────────────┘
```

## Mobile-first rules
- One primary action per screen state.
- Tap targets >= 44px.
- Address is secondary, truncated.
- Amounts always formatted to human-readable USDC.
- Explain approvals only when needed, not permanently.
- Every transaction has pending → confirmed / failed feedback.
