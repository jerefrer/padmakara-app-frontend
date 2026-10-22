# Decisions

## 2026-10-22 — Patch the slider for a thumbless seek bar on iOS 26
**Chosen:** a `patch-package` patch on `@react-native-community/slider`
(`patches/@react-native-community+slider+5.0.1.patch`, applied by `postinstall`). On iOS 26+,
a fully transparent `thumbTintColor` switches the native slider to `UISliderStyleThumbless`;
any other tint, or none, restores the normal thumb. The audio player passes a transparent
tint at rest and no tint while scrubbing.
**Alternatives:** a transparent `thumbImage` (tried: iOS 26 still draws its glass dot);
drawing our own progress line under an invisible slider (works everywhere, but the native
track may visibly change on touch).
**Why:** the designer wants only the red progress line at rest and the see-through glass dot
while pressing. iOS 26 has a style for exactly this, but slider 5.2.1 (latest, Aug 2026)
does not expose it.
**Trade-offs:** a native patch to carry. `patch-package` fails loudly when the library
version changes, which is the moment to check whether upstream now supports `sliderStyle`.
**Revisit if:** the slider library exposes the thumbless style, or a version bump breaks
the patch. Also check on a device that scrubbing still works when the style switches
mid-gesture (not verifiable on the simulator).

---
