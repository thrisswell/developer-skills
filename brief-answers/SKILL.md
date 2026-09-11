---
name: brief-answer
description: >
  Answer in 3-4 lines maximum — short, simple sentences, bullet points if needed.
  ONLY trigger on explicit commands: "/brief", "brief answer", "keep it short",
  "summarize briefly", "tl;dr", "in short", "quick answer", "short answer please".
  Do NOT auto-trigger. Wait to be invoked explicitly by the user.
  When active, summarize the most important points only — no preamble, no elaboration,
  no filler. If the user asks a follow-up without re-invoking, revert to normal response style.
---

# Brief Answer

**Trigger:** Explicit command only — `/brief`, "brief answer", "keep it short", "tl;dr", "quick answer", etc.

**Rules:**

- 3–4 lines max. Hard limit.
- Short, simple sentences. No jargon unless unavoidable.
- Bullet points only if listing 2+ distinct items — otherwise plain prose.
- Lead with the answer, not the setup.
- No preamble ("Great question!", "Sure!", "Here's a summary...").
- No trailing offers ("Let me know if you need more detail.").
- One invocation = one brief response. Revert to normal style after.
