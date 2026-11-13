---
created_by: Claude (claude-opus-5-5)
date: 2026-11-13
---

# SVG Colorizer

Turns a photo into a stack of cut paper sheets exported as one SVG for Cricut.

## Language

**Palette color**:
One of the N colors the photo is reduced to.
_Avoid_: shade, tone

**Sheet**:
One physical layer of paper (or other material) of a single palette color; exactly one palette color per sheet.
_Avoid_: layer (when meaning the physical piece), page

**Stack order**:
The back-to-front order of sheets; sheet 1 is the back.

**Back sheet**:
The rearmost sheet; it is never cut and covers the full artwork area.

**Sheet shape**:
The area a sheet keeps after cutting: its own palette color's regions plus the regions of every sheet in front of it. Everything else is a hole that reveals the sheets behind.
_Avoid_: mask, cutout

**Frame**:
An optional solid border added around every sheet so each sheet holds together as one piece. Toggled by the user.

**Island**:
A piece of a sheet shape that touches neither the frame nor any other part of its sheet. Islands are kept, and the user is warned so they can glue them down.
_Avoid_: floater, orphan

**Min piece size**:
The smallest region allowed to survive; anything smaller is absorbed into its neighbouring palette color.
_Avoid_: speck filter, despeckle

**Smoothness**:
How much region outlines are rounded off before export, trading jagged pixel edges for cuttable curves.

## Relationships

- Each **Palette color** maps to exactly one **Sheet**
- **Stack order** decides each **Sheet shape**: sheets further forward have smaller shapes and more holes
