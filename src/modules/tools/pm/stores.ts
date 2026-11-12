import { collection } from '@/data/db';
import type { Client, Expense, PmTask, Project, Rate, Staff, TimeEntry, TimeOff } from './schemas';

/** Collections of Tools → Gestion de projet (validated and stamped by the server, see server/pmGuard.ts). */
export const clients = collection<Client>('pm.clients');
export const projects = collection<Project>('pm.projects');
export const pmTasks = collection<PmTask>('pm.tasks');
export const timeEntries = collection<TimeEntry>('pm.timeEntries');
export const expenses = collection<Expense>('pm.expenses');
export const staff = collection<Staff>('pm.staff');
/** Confidential: only readable with tools.pm.reports (an empty list otherwise). */
export const rates = collection<Rate>('pm.rates');
export const timeOff = collection<TimeOff>('pm.timeOff');
