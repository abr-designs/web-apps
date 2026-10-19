# Tech Scavenger

*Game jam prototype • Game Design Document v0.1*

Status: Team notes incorporated; proposals and open decisions explicitly identified.

## 1. High concept

A slow, atmospheric first-person exploration game set in a foggy valley of abandoned technological junk. The player ventures from a central ship to locate oversized data drives inside ancient devices, physically extracts and carries them home, then investigates their contents through a retro computer-style file explorer. Clues and firmware upgrades enable new expeditions.

Player fantasy: be an archaeologist of technology—learning what the lost civilization built and what happened to it by handling its machines and recovering its data.

### Design pillars

- Search rather than follow waypoints: acquire an object’s signature, then use the scanner to find more of its type.
- Meaningful expeditions: leave the ship with a lead; return with a drive, a new signature, or information.
- Physical recovery: drives are large and must be extracted, carried in both hands, and slotted into the ship.
- Old technology is narrative: photographs, text files, and crude software reveal a layered mystery.
- Jam discipline: atmosphere and discovery are the challenge; no combat or survival systems in the minimum prototype.
## 2. Core loop

1. At ship: browse recovered files, select a scanner signature, and pick a lead.
1. Explore a surrounding zone, slowly navigating through fog and junk.
1. Scan an identifiable device (car, computer, robot, etc.) to learn its type signature; search for other objects of that type.
1. Find an object containing a drive, interact to extract its large physical cartridge.
1. Carry the drive back to the central ship; carrying is two-handed and the drive can be dropped.
1. Slot it into the ship terminal; open a mock file explorer with drag-and-drop.
1. Read images/text for story and leads; apply executable/firmware files as upgrades; collect ZIP/archive files toward the main goal. Repeat.
## 3. World structure and navigation

Ship is the central, safe hub and always contains the only fully functional terminal. Surrounding zones are compact pockets of junk, ruins, vehicles, robots, and larger computer structures. Fog and slow movement create an oppressive, Silent Hill-inspired mood. A hub-and-spoke layout supports recognizable routes and makes returning with a drive a deliberate part of play.

### Prototype layout (proposed)

| Area | Contents | Primary purpose |
| --- | --- | --- |
| Ship clearing | Terminal, drive socket, signature selection | Hub, analysis, upgrades |
| Vehicle wrecks | Cars and a drive-bearing dashboard/computer | First discovery, scanner tutorial |
| Office / terminal ruins | Computers, monitors, drives | Clues, new signatures |
| Robot graveyard | Disabled robots or computer column | Final drive, payoff |

Keep the first map small enough that an empty-handed trip between the ship and an outer zone is approximately 30–60 seconds; verify actual pacing through playtesting. Use landmarks, lighting and audio to prevent fog from becoming aimless wandering.

## 4. Scanner

### Core behavior — agreed direction

- Point at an intact or broken device and scan it to store its object-type signature (e.g., COMPUTER, CAR, ROBOT, TV).
- Select one stored signature as the active search target.
- While active, scanner responds to nearby objects with matching types; location is narrowed through strength/direction feedback, not explicit world markers.
- Matching objects may or may not contain drives; finding the type is not equivalent to finding a reward.
### Suggested MVP search implementation

Scanner has two modes: RECORD (scan a visible object to unlock its type) and TRACK (select a previously recorded type). TRACK emits an audible ticking/static pulse and displays simple signal strength. Strength increases as the player approaches a matching object; optionally add a directional response when facing it. Never require combining filters or handling per-object numeric fingerprints in the jam version.

Practical rule: to avoid confusing overlapping targets, track the strongest eligible matching object within range. Once investigated, flag that object as resolved so it stops distracting from the next target. Visually indicate when a signature has been added.

## 5. Physical drives and carrying

- A drive is a conspicuously large removable cartridge attached to a device in the environment.
- Approach an eligible device and hold/interact to extract its drive. For MVP, use a short animation or progress indicator.
- Carrying occupies both hands. The drive is shown in front of the camera, slightly reducing visibility and preventing scanner use while held (proposed).
- The player can drop the drive at any point. It remains where dropped and can be picked back up.
- At the ship, interact with a large drive bay to snap the cartridge into the terminal. The terminal interface opens afterward.
Avoid physically simulated drive collision and complex carrying interactions initially: use a fixed carry pose, intentional pickup/drop, and a reliable ground-placement check. Do not make players lose drives permanently.

## 6. Terminal and files

After inserting a drive, the player sees a stylized retro desktop / file explorer. Files are represented as recognizable icons and can be clicked, opened, and (where meaningful) dragged to clearly labeled target areas. The terminal is the story delivery and progression interface.

| File type | Function | MVP interaction |
| --- | --- | --- |
| Image / text (“Nothing Files”) | World-building, characters, hints, misleading or incidental records | Double-click to view; close window |
| ZIP / archive | Progress currency for completing the main objective | Drag to ARCHIVE / UPLOAD target; increment count |
| EXE / firmware | Upgrade ship or scanner abilities | Drag to INSTALL / UPGRADES target; apply specific upgrade |

“Nothing Files” is a team term for images and text files with no mechanical payout. Some should provide valuable clues, even when they do not award an upgrade. To avoid filler, keep them short and evocative.

### Suggested upgrade sequence

1. Base scanner: records signatures and gives weak proximity feedback.
1. First firmware: extends detection distance or strengthens directional feedback.
1. Optional second firmware: identifies whether a matching device still contains a drive; only add if needed for pacing.
ZIP files are proposed as a counter toward “recover enough archives to restore/open/transmit [the final objective].” Exact fiction and threshold remain undecided. Treat ZIPs as progress items, not purchasable currency, unless a resource-spending loop is deliberately added.

## 7. Example player session / vertical slice

1. Start at ship. Terminal explains that the player needs three archives to recover a missing transmission. Scanner can record a signature, but has no signature yet.
1. Near the ship, a broken computer is visible. Scan it to learn COMPUTER.
1. Select COMPUTER and follow the scanner into the vehicle/office zone; some computers are empty, one has an extractable drive.
1. Extract the oversized cartridge. Scanner becomes unavailable while carrying. Walk it back through fog, optionally dropping it to reorient.
1. Insert the drive. Open a short text file hinting at a damaged robot in another area; find an image depicting a distinctive robot; see one ZIP archive and an executable scanner upgrade.
1. Drag ZIP to the archive target and EXE to the install target; scanner detection range improves.
1. Use the clue to find and scan a robot, then TRACK ROBOT to locate another matching robot containing a second drive.
1. Return the second drive and discover a story contradiction or revelation; the demo can end here or lead to a third and final drive.
## 8. Tension, pacing and player guidance

- Alternate searching and payoff: a meaningful find should occur every few minutes, rather than long stretches of empty fog.
- Always offer a lead: terminal notes or visible landmarks suggest the next object type; do not demand blind sweeping.
- Use near misses carefully: a few empty devices create uncertainty, but too many turn tracking into busywork.
- Make drives visually and aurally satisfying to extract and slot into the ship.
- Give the player a fast way to identify the ship from a distance (beacon, light column, distinct silhouette, compass-home icon).
- Do not punish dropped drives with physics glitches or permanent loss.
## 9. MVP requirements and implementation

### Build first — essential

- First-person controller, walk speed, fog, one compact zone and a visible ship.
- Interactable device prefabs with TypeSignature and optional Drive reference.
- Scanner: scan-to-learn, select signature, strength feedback, and matching-object detection.
- Drive extraction, two-handed fixed-pose carry, drop, pickup, ship insertion.
- Terminal UI: desktop/file list, opening text/images, dragging ZIP to archive counter and EXE to upgrade slot.
- A scripted 2-drive route containing one discovery, one scanner upgrade, and one ending/reveal.
### Only if time remains

- More device types and additional zones; richer story files.
- Multiple scanner upgrades, animated detection UI, stronger positional audio.
- Environmental events when files are read; alternate final choices.
- Physics-driven carry animation, elaborate extraction sequences, file management simulation.
### Explicitly outside MVP

Combat, enemies, hunger, stamina, crafting, complex inventory, procedural map generation, procedural clues, realistic drive physics, complex install dependencies, and multiple ship terminals.

## 10. Suggested data model

Device: id, signatureType, hasDrive, scanned, driveExtracted, resolved. Scanner: knownSignatureTypes, selectedType, detectionRange, feedbackStrength. Drive: id, worldState (installed / in device / carried / dropped), files[]. File: id, name, type (text/image/zip/exe), payload, processed flag. Upgrade: id, effect, installed. Objective: requiredArchives, submittedArchives, completed.

Suggested scanner calculation: find eligible devices matching selectedType in range, compute normalized distance proximity, and optionally multiply by a look-direction factor. Keep scan state separate from drive extraction state; a device may be scannable even when its drive has already been removed.

## 11. Open design decisions

1. Does tracking detect all matching objects or only those with drives? Recommendation: all; the player is searching for a device class, not directly detecting loot.
1. Can scanner be used while carrying? Recommendation: no, to make carry-back a distinct phase; ensure clear return landmarks.
1. Are ZIP archives consumed automatically or manually submitted? Recommendation: drag into the terminal’s archive/upload target, then increment progress.
1. What is the main narrative objective? Choose one explicit promise (recover a transmission, reconstruct a recording, repair ship navigation, or discover why the civilization disappeared).
1. How much terminal drag-and-drop is necessary? Recommendation: minimal desktop with file windows and only two drop targets; avoid building a real operating system.
1. What stops players scanning a matching object through walls? Recommendation: directional/distance feedback can work through obstacles but close-range extraction requires line of sight.
1. Can drives be left behind indefinitely? Recommendation: yes, with recoverable persistent positions.
## 12. Prototype acceptance tests

- A new player can learn a signature, follow a signal, and locate a device without written instructions.
- A player can extract, drop, recover, carry and insert a drive without soft-locking.
- A file can be opened; ZIP increments main-objective progress; EXE changes scanner behavior visibly.
- A text/image clue genuinely helps guide the next expedition.
- The full two-drive loop is completable in a single short play session and feels satisfying without additional mechanics.
