import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const insert = vi.hoisted(() => vi.fn());
vi.mock('./db', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./db')>()),
  db: { insert: () => ({ values: insert }) },
}));

import { recordAudit } from './audit';
import { ROLE } from './roles';
import type { User } from './db/schema';

const ACTOR = {
  id: 'actor-1',
  email: 'officer@uic.edu',
  name: 'Officer',
  role: ROLE.TOP8,
} as unknown as User;

const ENTRY = {
  actor: ACTOR,
  action: 'update',
  entity: 'member',
  entityId: 'member-1',
  entityLabel: 'Ann',
} as const;

beforeEach(() => {
  insert.mockReset().mockResolvedValue(undefined);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('recordAudit', () => {
  it('snapshots the actor and the label rather than referencing them', async () => {
    await recordAudit(ENTRY);

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: ACTOR.id,
        actorEmail: ACTOR.email,
        entityLabel: 'Ann',
        entity: 'member',
        action: 'update',
      }),
    );
  });

  it('defaults changedFields to an empty array for creates and deletes', async () => {
    await recordAudit({ ...ENTRY, action: 'create' });
    expect(insert.mock.calls[0]![0]).toMatchObject({ changedFields: [] });
  });

  /**
   * The contract the whole design rests on: an officer's edit must not fail
   * because the log insert did. Without this, a broken audit table would take
   * every officer action down with it.
   */
  it('swallows a failed write instead of throwing', async () => {
    insert.mockRejectedValue(new Error('audit table is gone'));

    await expect(recordAudit(ENTRY)).resolves.toBeUndefined();
  });

  it('reports the swallowed failure to the server log', async () => {
    insert.mockRejectedValue(new Error('audit table is gone'));

    await recordAudit(ENTRY);

    expect(console.error).toHaveBeenCalledWith(
      '[audit] failed to record',
      expect.objectContaining({ entityId: 'member-1', error: 'audit table is gone' }),
    );
  });
});
