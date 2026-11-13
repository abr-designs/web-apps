---
created_by: Claude (claude-opus-5-5)
date: 2026-11-13
---

# SVG Colorizer

Turns a photo into a stack of cut paper sheets exported as one SVG for Cricut.

## Language

**Palette color**:
One of the colors the photo is reduced to: either an **Automatic color** or an **Added color**. At most 20 in total.
_Avoid_: shade, tone

**Automatic color**:
A palette color chosen from the photo by the app. The Colors slider sets how many there are, and moving it re-picks all of them.

**Added color**:
A palette color the user picks from the photo with the eyedropper. It starts as the front sheet, survives Colors slider changes, and can be removed.

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

**Bridge**:
A thin strip of a sheet's own paper that the user adds to join two pieces of that sheet, usually to hold an island in place. The user places one by clicking the two pieces, and removes one by clicking it. A bridge is visible on the finished art, because the pixels it crosses belong to sheets further back. Every bridge shares the one **Bridge width**. Bridges are cleared whenever the automatic colors are re-picked.
_Avoid_: tab, connector, tie

**Bridge width**:
The width of every bridge, in the export unit.

**Erase**:
Removing paper from one sheet: clicking an **Island** removes the whole island, and dragging the **Brush** cuts any area away. Shift+drag puts erased paper back. Erased areas become holes that show the sheets behind. Erasing is cleared whenever the automatic colors are re-picked, and erased islands are also forgotten whenever pixels are re-labelled (Min piece size, Smoothness, Width or a color change), because the island may no longer exist.
_Avoid_: delete, mask

**Focus area**:
Parts of the photo the user paints whose detail must survive, like an eye. Inside it, **Smoothness** is skipped, a piece only needs a quarter of the **Min piece size** across, and its pixels weigh more when the automatic colors are picked. Leaving focus mode after painting re-picks the automatic colors.
_Avoid_: priority, protect

**Brush**:
The round tool, with one shared size, used to **Erase** and to paint the **Focus area**.

**Min piece size**:
The smallest region allowed to survive; anything smaller is absorbed into its neighbouring palette color.
_Avoid_: speck filter, despeckle

**Smoothness**:
How much region outlines are rounded off before export, trading jagged pixel edges for cuttable curves.

## Relationships

- Each **Palette color** maps to exactly one **Sheet**
- **Stack order** decides each **Sheet shape**: sheets further forward have smaller shapes and more holes
- A **Bridge** belongs to one **Sheet** and is added to its **Sheet shape**, which can turn an **Island** back into part of the main piece
- **Erase** belongs to one **Sheet** and is applied to its **Sheet shape** after its bridges
- The **Focus area** belongs to the photo, so it applies to every **Sheet** and lasts until a new photo is loaded
