import { apiFetch } from './api/client';

/**
 * Says the signed-in member is going, or takes it back. Resolves to what the
 * server now holds, which is what the screen should show. Both directions are
 * idempotent on the server, so a double tap cannot leave it out of step.
 */
export async function setRsvp(eventId: string, going: boolean): Promise<boolean> {
  const data = await apiFetch<{ rsvp: { going: boolean } }>(`/api/events/${eventId}/rsvp`, {
    method: going ? 'PUT' : 'DELETE',
  });
  return data.rsvp.going;
}
