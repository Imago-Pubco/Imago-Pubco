import { collection } from '@/data/db';
import type { Huddle, HuddleEntry, HuddleItem, Kpi, KpiValue, Priority, PriorityUpdate, Task, Team } from './schemas';

/** Collections of the Tools → KPI module (validated and stamped by the server, see server/api.ts). */
export const teams = collection<Team>('tools.teams');
export const kpis = collection<Kpi>('tools.kpis');
export const kpiValues = collection<KpiValue>('tools.kpiValues');
export const priorities = collection<Priority>('tools.priorities');
export const priorityUpdates = collection<PriorityUpdate>('tools.priorityUpdates');
export const tasks = collection<Task>('tools.tasks');
export const huddles = collection<Huddle>('tools.huddles');
export const huddleEntries = collection<HuddleEntry>('tools.huddleEntries');
export const huddleItems = collection<HuddleItem>('tools.huddleItems');
