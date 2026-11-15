# AndroidPdfViewer 4.0.1, with a top inset

`react-native-pdf` renders PDFs on Android with
[zacharee/AndroidPdfViewer](https://github.com/zacharee/AndroidPdfViewer) 4.0.1
(Apache License 2.0, see `LICENSE`). That library always pins the top of the
document to the top of the view, so a reader toolbar laid over the page hid the
top of the first page, and the library offers no setting to change it.

`top-inset.patch` adds `PDFView.setTopInset(px)`: in vertical mode the document
can sit that far below the top of the view, opens there, and scrolls under the
toolbar. It changes the clamp in `moveTo`, `jumpTo`, the position offset,
`canScrollVertically` and the fling bounds; nothing else.

The app uses it through `contentInsetTop` on `react-native-pdf` (see
`patches/react-native-pdf+7.0.5.patch`), which on iOS sets the same inset on
PDFKit's scroll view.

## Files

- `maven/` — a local Maven repository holding the patched AAR as
  `org.padmakara.vendor:android-pdf-viewer:4.0.1-topinset.1`. The patched
  `react-native-pdf` build.gradle depends on it instead of
  `com.github.zacharee:AndroidPdfViewer:4.0.1`, and the config plugin
  `plugins/withVendorMaven.js` adds this repository to the Android build.
- `top-inset.patch` — the change, against upstream tag `4.0.1`.
- `build-aar.sh` — rebuilds the AAR from upstream plus the patch. Only the two
  changed classes are recompiled and swapped into the published AAR; every other
  file stays as published.

## Changing it

Edit the patch, bump `VERSION` in `build-aar.sh` and the version in the
`react-native-pdf` patch, run `./build-aar.sh`, and commit the new AAR.
Upgrading `react-native-pdf` means checking which AndroidPdfViewer version it
then depends on and porting the patch to it.
