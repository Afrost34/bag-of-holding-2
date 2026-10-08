# 0009 — The player window is a board

Date: 2026-10-08 · Status: accepted

## Context

The player window (a second browser window on a TV or second screen) used to show copies of the
cards the DM marked as shown on a board, laid out read-only. The DM wants it to work exactly like
a board (add, move, resize, roll, remove anything there), the only difference being that cards are
sent to it. Two things stood in the way: the 5etools index can be open in one window only (the
SQLite database in OPFS is locked by its window, ADR 0003), and two windows writing the same board
file would overwrite each other.

## Decision

- Each campaign (and the library) has a **players' board**, `players-<campaign>`, a board file like
  any other (`players: true`), not listed with the DM's boards. The player window opens it with the
  ordinary board editor, minus "Delete board", "Player window" and "Send to players".
- **Send to players** (a board card's menu, the calendar) copies cards onto it. While the player
  window is open it is the **only writer** of that board: the DM's window asks it over a
  BroadcastChannel (a ping first) to add the cards. When it is closed, the DM's window adds them
  itself, then opens it.
- The player window's **data calls are relayed** to the DM's window (`app/data/relay.ts`): it
  never opens the database, and the DM's window answers from its worker. Calls with callbacks
  (installing data) stay the DM window's.
- On the players' board a calendar shows no secret events and none of the DM's buttons.

## Consequences

- The player window needs the DM's window open to show compendium entries (it always is at the
  table); without it, entries say so after a timeout.
- Cards on the players' board are copies: changing the DM's card later does not change them.
