import { describe, expect, it } from 'vitest';
import { isStorageConfigured, orgObjectKey } from './storage';

describe('isStorageConfigured', () => {
  // The test env sets no STORAGE_* keys. The app must still boot — this module
  // does no work at import — and callers get false rather than a throw.
  it('is false when no storage env is set', () => {
    expect(isStorageConfigured()).toBe(false);
  });
});

describe('orgObjectKey', () => {
  it('namespaces the key by org', () => {
    expect(orgObjectKey('org_a', 'logo.png', 'uuid-1')).toBe('orgs/org_a/uuid-1-logo.png');
  });

  it('keeps two orgs uploading the same filename apart', () => {
    const a = orgObjectKey('org_a', 'logo.png', 'uuid-1');
    const b = orgObjectKey('org_b', 'logo.png', 'uuid-2');

    expect(a).not.toBe(b);
    expect(a.startsWith('orgs/org_a/')).toBe(true);
    expect(b.startsWith('orgs/org_b/')).toBe(true);
  });

  // The filename comes from the client, so it must not be able to climb out of
  // the org prefix and collide with another tenant's object.
  it('neutralises path traversal in the filename', () => {
    const key = orgObjectKey('org_a', '../../org_b/logo.png', 'uuid-1');

    expect(key.startsWith('orgs/org_a/')).toBe(true);
    expect(key).not.toContain('..');
    expect(key).not.toContain('/org_b/');
  });

  it('strips separators and exotic characters', () => {
    const key = orgObjectKey('org_a', 'a b/c\\d?e#f.png', 'uuid-1');

    expect(key).toBe('orgs/org_a/uuid-1-a_b_c_d_e_f.png');
  });

  it('rejects a leading dot rather than writing a dotfile', () => {
    expect(orgObjectKey('org_a', '.htaccess', 'uuid-1')).toBe('orgs/org_a/uuid-1-htaccess');
  });

  it('bounds an absurdly long filename', () => {
    const key = orgObjectKey('org_a', `${'x'.repeat(500)}.png`, 'uuid-1');

    expect(key.length).toBeLessThan(140);
  });

  it('falls back to a name when sanitising leaves nothing', () => {
    expect(orgObjectKey('org_a', '...', 'uuid-1')).toBe('orgs/org_a/uuid-1-file');
  });
});
