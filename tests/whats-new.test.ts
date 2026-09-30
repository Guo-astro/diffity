import { describe, expect, it } from 'vitest';
import { WHATS_NEW, compareVersions, shouldShowUpdateNotice } from '../src/whats-new';

describe('shouldShowUpdateNotice', () => {
  it('says nothing on a fresh install', () => {
    expect(shouldShowUpdateNotice({ lastSeen: null, current: '0.0.3', returningUser: false })).toBe(false);
  });

  it('tells someone who used the app before the notice existed', () => {
    expect(shouldShowUpdateNotice({ lastSeen: null, current: '0.0.3', returningUser: true })).toBe(true);
  });

  it('shows after an update', () => {
    expect(shouldShowUpdateNotice({ lastSeen: '0.0.2', current: '0.0.3', returningUser: true })).toBe(true);
  });

  it('does not show twice for the same version', () => {
    expect(shouldShowUpdateNotice({ lastSeen: '0.0.3', current: '0.0.3', returningUser: true })).toBe(false);
  });

  it('does not show after a downgrade', () => {
    expect(shouldShowUpdateNotice({ lastSeen: '0.1.0', current: '0.0.9', returningUser: true })).toBe(false);
  });

  it('compares numerically, not as text', () => {
    expect(shouldShowUpdateNotice({ lastSeen: '0.0.9', current: '0.0.10', returningUser: true })).toBe(true);
  });
});

describe('compareVersions', () => {
  it('orders versions', () => {
    expect(compareVersions('1.2.3', '1.2.3')).toBe(0);
    expect(compareVersions('1.10.0', '1.9.9')).toBe(1);
    expect(compareVersions('1.0', '1.0.1')).toBe(-1);
  });
});

describe('WHATS_NEW', () => {
  it('lists releases newest first with unique versions', () => {
    const versions = WHATS_NEW.map((release) => release.version);
    expect(new Set(versions).size).toBe(versions.length);
    for (let i = 1; i < versions.length; i++) {
      expect(compareVersions(versions[i - 1], versions[i])).toBe(1);
    }
  });

  it('has a date and at least one bullet per release', () => {
    for (const release of WHATS_NEW) {
      expect(release.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(release.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(release.items.length).toBeGreaterThan(0);
      for (const item of release.items) {
        expect(item.trim()).not.toBe('');
      }
    }
  });

  it('includes the launch and the latest releases', () => {
    expect(WHATS_NEW.map((release) => release.version)).toEqual(expect.arrayContaining(['0.0.1', '0.0.2', '0.0.3']));
  });
});
