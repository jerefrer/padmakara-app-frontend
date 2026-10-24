/**
 * In-memory stand-in for the parts of expo-file-system/legacy that the
 * storage code uses. Files are registered with a size; directories exist
 * implicitly as prefixes of file paths (or explicitly via `addDir`).
 */
export function createFakeFileSystem(documentDirectory = 'file:///doc/', cacheDirectory = 'file:///cache/') {
  const files = new Map<string, { size: number; modificationTime: number }>();
  const dirs = new Set<string>();

  const norm = (p: string) => (p.endsWith('/') ? p.slice(0, -1) : p);
  const isDir = (p: string) => {
    const n = norm(p);
    if (dirs.has(n)) return true;
    for (const f of files.keys()) if (f.startsWith(`${n}/`)) return true;
    return false;
  };

  return {
    documentDirectory,
    cacheDirectory,
    addFile(path: string, size: number, modificationTime = 0) {
      files.set(norm(path), { size, modificationTime });
    },
    addDir(path: string) {
      dirs.add(norm(path));
    },
    has(path: string) {
      return files.has(norm(path)) || isDir(path);
    },
    getInfoAsync: jest.fn(async (path: string) => {
      const n = norm(path);
      const file = files.get(n);
      if (file) return { exists: true, isDirectory: false, uri: path, size: file.size, modificationTime: file.modificationTime };
      if (isDir(n)) return { exists: true, isDirectory: true, uri: path, size: 0, modificationTime: 0 };
      return { exists: false, isDirectory: false, uri: path };
    }),
    readDirectoryAsync: jest.fn(async (path: string) => {
      const n = norm(path);
      const names = new Set<string>();
      for (const key of [...files.keys(), ...dirs]) {
        if (key.startsWith(`${n}/`)) names.add(key.slice(n.length + 1).split('/')[0]);
      }
      return [...names];
    }),
    makeDirectoryAsync: jest.fn(async (path: string) => {
      dirs.add(norm(path));
    }),
    deleteAsync: jest.fn(async (path: string) => {
      const n = norm(path);
      files.delete(n);
      dirs.delete(n);
      for (const key of [...files.keys()]) if (key.startsWith(`${n}/`)) files.delete(key);
      for (const key of [...dirs]) if (key.startsWith(`${n}/`)) dirs.delete(key);
    }),
  };
}
