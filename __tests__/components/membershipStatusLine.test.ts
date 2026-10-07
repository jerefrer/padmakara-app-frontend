import { membershipStatusLine } from '@/components/membership/statusLine';

const t = () => undefined;

describe('membershipStatusLine', () => {
  it('should say no active membership when the user has no access', () => {
    expect(membershipStatusLine(t, 'en', false, undefined)).toBe('No active membership');
  });
  it('should say active when access is live and not cancelled', () => {
    expect(membershipStatusLine(t, 'en', true, { cancelledAt: null, expiresAt: '2027-01-01T00:00:00Z' })).toBe('Active');
  });
  it('should say when it ends once cancelled', () => {
    const line = membershipStatusLine(t, 'en', true, { cancelledAt: '2026-10-01T00:00:00Z', expiresAt: '2027-01-01T00:00:00Z' });
    expect(line).toMatch(/^Ends .*2027/);
  });
});
