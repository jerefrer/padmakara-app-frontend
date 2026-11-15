const { addVendorRepository } = require('../../plugins/withVendorMaven');

const ROOT_BUILD_GRADLE = `allprojects {
  repositories {
    google()
    mavenCentral()
    maven { url 'https://www.jitpack.io' }
  }
}
`;

describe('withVendorMaven', () => {
  it('should add the vendored Maven repository to every project, for its group only', () => {
    const out = addVendorRepository(ROOT_BUILD_GRADLE);

    expect(out).toContain('url "${rootDir}/../vendor/android-pdf-viewer/maven"');
    expect(out).toContain('includeGroup "org.padmakara.vendor"');
    expect(out.indexOf('vendor/android-pdf-viewer/maven')).toBeLessThan(out.indexOf('google()'));
  });

  it('should not add the repository twice', () => {
    const once = addVendorRepository(ROOT_BUILD_GRADLE);

    expect(addVendorRepository(once)).toBe(once);
  });

  it('should fail loudly when the build file has no allprojects repositories', () => {
    expect(() => addVendorRepository('buildscript {}\n')).toThrow(/allprojects/);
  });
});
