<!-- Created by Claude (claude-opus-5-5) -->
<!-- Date: 2026-10-22 -->

# Model Credits

Every file here is CC0 (public domain, https://creativecommons.org/publicdomain/zero/1.0/) by Kay Lousberg, www.kaylousberg.com. Credit is not required; it is given here anyway.

| File | Source pack | Notes |
|---|---|---|
| `mannequin.glb` | KayKit Mannequin Character (`Mannequin_Medium.glb`) | squad soldiers |
| `skeleton-warrior.glb`, `skeleton-minion.glb`, `skeleton-rogue.glb`, `skeleton-mage.glb` | KayKit Character Pack: Skeletons 1.1 FREE | enemies; licence in the pack's `License.txt` |
| `gear/crossbow.glb`, `gear/blade.glb`, `gear/staff.glb` | KayKit Character Pack: Skeletons 1.1 FREE (`assets/gltf`) | converted from .gltf to .glb |
| `clips.glb` | KayKit Character Animations, `Rig_Medium` (https://kaylousberg.itch.io/kaykit-character-animations) | 16 clips kept from the General, MovementBasic, MovementAdvanced, CombatRanged, CombatMelee and Special files; meshes removed |

`clips.glb` holds: Death_A, Hit_A, Idle_A, Throw, Walking_A, Crouching, Running_HoldingRifle, Ranged_1H_Shoot, Ranged_2H_Aiming, Ranged_2H_Reload, Ranged_2H_Shoot, Ranged_Magic_Shoot, Melee_1H_Attack_Chop, Melee_2H_Attack_Stab, Skeletons_Idle, Skeletons_Walking. It was built with `@gltf-transform/core` 4.1.1 by copying those animations onto one Rig_Medium node tree (clips bind by bone name), then `dedup` and `prune`.
