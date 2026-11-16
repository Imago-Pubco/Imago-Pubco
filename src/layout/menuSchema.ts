/**
 * The sidebar menu chosen by an administrator (sections, their names and order, which module goes where, module
 * names). Stored in app.settings under the id below; the server validates it and requires admin.menu to save it.
 * Kept free of React and of '@/' imports so the server can load it.
 */
import { z } from 'zod';

export const MENU_LAYOUT_ID = 'sidebar.layout';

const name = z.strictObject({ fr: z.string().trim().min(1).max(60), en: z.string().trim().min(1).max(60) });

export const MenuLayoutSchema = z.strictObject({
  sections: z
    .array(
      z.strictObject({
        id: z.string().regex(/^[a-z0-9_-]{1,40}$/),
        /** null = no heading (e.g. Support TI at the bottom). */
        label: name.nullable(),
        moduleIds: z.array(z.string().min(1).max(60)).max(50),
      }),
    )
    .max(30),
  /** Display-name overrides, by module id. */
  names: z.record(z.string().min(1).max(60), name),
});

export type MenuLayout = z.infer<typeof MenuLayoutSchema>;
export type MenuName = z.infer<typeof name>;
