# Collaboration Protocol (Agent Switching and Session Continuity)

## Purpose

Document collaboration preferences so multi-agent strategy/product/implementation sessions remain fluid across future conversations.

## Agreed Rule: Agent Switching Ownership

Wolfcito prefers that the assistant proactively manages agent switching when it improves flow, with explicit notice before switching.

### Operating rule

- The assistant may recommend and perform agent switches when appropriate.
- Before switching to a different agent/persona, the assistant must:
  1. state which agent it plans to switch to
  2. explain why the switch is useful for the current task
  3. confirm whether it will switch now (or wait for approval, depending on user request)

### User expectation

- The default expectation is: "assistant handles the switch and informs me".
- If the user wants to keep the current agent, they can override at any time.

## Default Handoff Guidance (Current)

- Brainstorming / reframing / ideation -> `brainstorming-coach`
- Product positioning / strategic prioritization -> `innovation-strategist`
- User understanding / UX flow / comprehension -> `design-thinking-coach`
- Structured decomposition of hard problems -> `creative-problem-solver`
- Execution / code changes / instrumentation -> implementation agent (Codex)

## Continuity Notes

- This file captures collaboration preferences, not product requirements.
- Performance guardrails live separately in `docs/process/performance-policy.md` and should be consulted when proposing UI-heavy or realtime-heavy changes.
- For future sessions, these preferences are most reliable when:
  - this file remains in the repo, and
  - the session loads repo instructions/docs before deep work

## Review Trigger

Revisit this protocol when:
- new BMAD agents are introduced
- collaboration style changes
- the project shifts from product strategy to mostly execution work
