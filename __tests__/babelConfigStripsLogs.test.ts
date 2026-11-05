import { transformSync } from '@babel/core';
import path from 'path';

const SOURCE = "console.log('a'); console.info('b'); console.debug('c'); console.warn('d'); console.error('e');";

function compile(nodeEnv: 'development' | 'production' | 'test'): string {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = nodeEnv;
  try {
    return transformSync(SOURCE, {
      configFile: path.join(__dirname, '..', 'babel.config.js'),
      babelrc: false,
      filename: 'sample.js',
      caller: { name: 'metro', platform: 'ios', bundler: 'metro' } as never,
    })!.code!;
  } finally {
    process.env.NODE_ENV = previous;
  }
}

describe('babel config console stripping', () => {
  it('should remove log, info and debug in production but keep warn and error', () => {
    const code = compile('production');
    expect(code).not.toMatch(/console\.(log|info|debug)/);
    expect(code).toContain('console.warn');
    expect(code).toContain('console.error');
  });

  it('should keep every console call in development', () => {
    expect(compile('development')).toContain('console.log');
  });
});
