/** All help topics (see types.ts). Written in two parts so each stays reviewable. */
import { HELP_A } from './content.a.ts';
import { HELP_B } from './content.b.ts';
import type { HelpTopic } from './types.ts';

export const HELP_TOPICS: HelpTopic[] = [...HELP_A, ...HELP_B];
