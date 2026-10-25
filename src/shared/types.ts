// Shape of GET /api/snapshot. Built server-side from the active event in the
// .axdb; every page is derived from this on the client.

export interface SnapEvent {
  orgName: string;
  eventName: string;
  eventDate: string;
  numRuns: number;
}

export interface SnapClass {
  id: number;
  name: string;
  pax: number;
}

// Deliberately excludes email, cellphone, member_num, sponsor and tire.
export interface SnapDriver {
  id: number;
  firstName: string;
  lastName: string;
  number: string;
  classId: number;
  carModel: string;
  carColor: string;
}

// VisualAX run status: 0 start queue, 1 on course, 2 finished (penalties may
// still change), 3 committed. Only 2 and 3 are included in the snapshot.
export const STATUS_PENDING = 2;
export const STATUS_COMMITTED = 3;

export interface SnapRun {
  id: number;
  driverId: number;
  startTick: number | null;
  finishTick: number | null;
  cones: number;
  disposition: string; // "", "DNF", "RRN", "DSQ"
  status: number;
}

export interface EventSnapshot {
  // Stable across .axdb files: events.id restarts at 1 in every new file.
  eventKey: string;
  // Content hash of everything below; doubles as the HTTP ETag.
  version: string;
  event: SnapEvent;
  classes: SnapClass[];
  drivers: SnapDriver[];
  runs: SnapRun[];
  // registrations.bestpendingrun_id per driver id, when set.
  bestRunByDriver: Record<string, number>;
}
