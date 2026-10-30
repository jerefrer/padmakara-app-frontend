import { redactEmails, scrubBreadcrumb, sentryUser } from '../../utils/sentryPrivacy';

describe('sentryUser', () => {
  it('should identify a signed-in person by account id only', () => {
    const user = { id: '42', email: 'ana@example.pt' };

    expect(sentryUser(user)).toEqual({ id: '42' });
  });

  it('should clear the identity when nobody is signed in', () => {
    expect(sentryUser(null)).toBeNull();
  });
});

describe('redactEmails', () => {
  it('should replace every email address in a text', () => {
    expect(redactEmails('from ana.silva+x@example.pt to b@mail.co')).toBe(
      'from [email] to [email]',
    );
  });

  it('should leave text without an email unchanged', () => {
    expect(redactEmails('Session refreshed at 10:00')).toBe('Session refreshed at 10:00');
  });
});

describe('scrubBreadcrumb', () => {
  it('should redact emails from a console breadcrumb message and its logged arguments', () => {
    const scrubbed = scrubBreadcrumb({
      category: 'console',
      message: '🔍 Auth state: userEmail ana@example.pt',
      data: { arguments: ['🔍 Auth state:', { userEmail: 'ana@example.pt', hasToken: true }] },
    });

    expect(scrubbed).toEqual({
      category: 'console',
      message: '🔍 Auth state: userEmail [email]',
      data: { arguments: ['🔍 Auth state:', { userEmail: '[email]', hasToken: true }] },
    });
  });

  it('should redact emails from a request URL breadcrumb', () => {
    const scrubbed = scrubBreadcrumb({
      category: 'fetch',
      data: { url: 'https://api.padmakara.pt/api/x?email=ana@example.pt', status_code: 200 },
    });

    expect(scrubbed.data).toEqual({
      url: 'https://api.padmakara.pt/api/x?email=[email]',
      status_code: 200,
    });
  });
});
