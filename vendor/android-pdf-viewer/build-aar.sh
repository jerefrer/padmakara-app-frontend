#!/usr/bin/env bash
# Rebuilds the patched AndroidPdfViewer AAR in maven/ from upstream 4.0.1.
#
# Only the classes changed by top-inset.patch are recompiled, against the
# published 4.0.1 AAR, and swapped into a copy of it; everything else in the
# AAR stays byte for byte as published.
#
# Needs: git, a JDK 17 (JAVA_HOME or /opt/homebrew/opt/openjdk@17), the Android
# SDK platform 34, and a Gradle cache holding the published AAR and its
# dependencies (any earlier Android build of the app fills it).
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
UPSTREAM=https://github.com/zacharee/AndroidPdfViewer.git
TAG=4.0.1
GROUP_PATH=org/padmakara/vendor/android-pdf-viewer
VERSION=4.0.1-topinset.1
OUT="$HERE/maven/$GROUP_PATH/$VERSION"

JAVA_HOME="${JAVA_HOME:-/opt/homebrew/opt/openjdk@17}"
ANDROID_JAR="${ANDROID_HOME:-$HOME/Library/Android/sdk}/platforms/android-34/android.jar"
GRADLE_FILES="$HOME/.gradle/caches/modules-2/files-2.1"

find_one() {
  local found
  found=$(find "$GRADLE_FILES/$1" -name "$2" 2>/dev/null | head -1)
  if [ -z "$found" ]; then
    echo "Missing $1/$2 in the Gradle cache: run an Android build of the app first." >&2
    exit 1
  fi
  echo "$found"
}

ORIGINAL_AAR=$(find_one com.github.zacharee/AndroidPdfViewer/$TAG "AndroidPdfViewer-$TAG.aar")
PDFIUM_AAR=$(find_one io.legere/pdfiumandroid/1.0.32 "pdfiumandroid-1.0.32.aar")
CORE_AAR=$(find_one androidx.core/core/1.13.1 "core-1.13.1.aar")
ANNOTATION_JAR=$(find_one androidx.annotation/annotation-jvm/1.8.1 "annotation-jvm-1.8.1.jar")

WORK=$(mktemp -d "${TMPDIR:-/tmp}/android-pdf-viewer.XXXXXX")
trap 'rm -rf "$WORK"' EXIT

git clone -q --depth 1 --branch "$TAG" "$UPSTREAM" "$WORK/src"
# Upstream sources use CRLF line endings; the patch is stored with LF.
git -C "$WORK/src" apply --ignore-whitespace "$HERE/top-inset.patch"

mkdir -p "$WORK/aar" "$WORK/classes" "$WORK/deps" "$WORK/out"
(cd "$WORK/aar" && unzip -q "$ORIGINAL_AAR")
(cd "$WORK/classes" && unzip -q "$WORK/aar/classes.jar")
unzip -q -p "$PDFIUM_AAR" classes.jar > "$WORK/deps/pdfium.jar"
unzip -q -p "$CORE_AAR" classes.jar > "$WORK/deps/core.jar"

SRC="$WORK/src/android-pdf-viewer/src/main/java/com/github/barteksc/pdfviewer"
"$JAVA_HOME/bin/javac" -nowarn -source 8 -target 8 -bootclasspath "$ANDROID_JAR" \
  -cp "$WORK/classes:$WORK/deps/pdfium.jar:$WORK/deps/core.jar:$ANNOTATION_JAR" \
  -d "$WORK/out" "$SRC/PDFView.java" "$SRC/DragPinchManager.java"

cp -R "$WORK/out/." "$WORK/classes/"
rm "$WORK/aar/classes.jar"
(cd "$WORK/classes" && zip -q -r -X -D "$WORK/aar/classes.jar" .)

mkdir -p "$OUT"
rm -f "$OUT/android-pdf-viewer-$VERSION.aar"
(cd "$WORK/aar" && zip -q -r -X -D "$OUT/android-pdf-viewer-$VERSION.aar" .)
cat > "$OUT/android-pdf-viewer-$VERSION.pom" <<POM
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
  <modelVersion>4.0.0</modelVersion>
  <groupId>org.padmakara.vendor</groupId>
  <artifactId>android-pdf-viewer</artifactId>
  <version>$VERSION</version>
  <packaging>aar</packaging>
  <dependencies>
    <dependency>
      <groupId>io.legere</groupId>
      <artifactId>pdfiumandroid</artifactId>
      <version>1.0.19</version>
      <scope>compile</scope>
    </dependency>
    <dependency>
      <groupId>androidx.core</groupId>
      <artifactId>core</artifactId>
      <version>1.12.0</version>
      <scope>runtime</scope>
    </dependency>
  </dependencies>
</project>
POM
echo "Built $OUT/android-pdf-viewer-$VERSION.aar"
