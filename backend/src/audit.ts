import { db } from './db';
import { auditLog, type AuditAction, type AuditEntity, type User } from './db/schema';

type AuditInput = {
  actor: User;
  action: AuditAction;
  entity: AuditEntity;
  entityId: string;
  /** Name or title at the time, so a deleted row is still readable later. */
  entityLabel: string;
  /** Which fields an update touched. Omitted for creates and deletes. */
  changedFields?: readonly string[];
};

/**
 * Record an officer's change.
 *
 * Deliberately swallows its own failures. An officer's edit succeeding but
 * returning a 500 because the *log* insert failed would be a worse bug than the
 * missing log line — the audit trail is a record of the work, not a
 * precondition for it. Failures go to the server log, where they are visible
 * without being in the member's way.
 *
 * Callers await it anyway. The response never depends on whether the write
 * succeeded, but it must not go out before the write finishes: Cloud Run
 * throttles the CPU once a response is sent, which would leave the insert
 * stalled until some later request woke the instance.
 */
export async function recordAudit(input: AuditInput): Promise<void> {
  try {
    await db.insert(auditLog).values({
      actorId: input.actor.id,
      actorEmail: input.actor.email,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      entityLabel: input.entityLabel,
      changedFields: [...(input.changedFields ?? [])],
    });
  } catch (err) {
    console.error('[audit] failed to record', {
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      error: err instanceof Error ? err.message : err,
    });
  }
}
