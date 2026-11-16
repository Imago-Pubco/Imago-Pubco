/**
 * Tab / Shift+Tab in the rich text editor:
 *   in a table      → next / previous cell (handled by the table extension)
 *   in a list       → nest / un-nest the item
 *   anywhere else   → indent / outdent the paragraph or heading (stored as margin-left, in steps of 2em, 8 max)
 * Tab never leaves the editor.
 */
import { Extension, type Editor } from '@tiptap/react';

const MAX = 8;
const TYPES = ['paragraph', 'heading'];

function changeIndent(editor: Editor, by: number): boolean {
  return editor
    .chain()
    .focus()
    .command(({ tr, state }) => {
      const { from, to } = state.selection;
      let changed = false;
      state.doc.nodesBetween(from, to, (node, pos) => {
        if (!TYPES.includes(node.type.name)) return true;
        const cur = Number(node.attrs.indent) || 0;
        const next = Math.max(0, Math.min(MAX, cur + by));
        if (next !== cur) {
          tr.setNodeMarkup(pos, undefined, { ...node.attrs, indent: next });
          changed = true;
        }
        return false;
      });
      return changed || true;
    })
    .run();
}

/** Indent and outdent commands for the toolbar (same rules as Tab / Shift+Tab). */
export function indent(editor: Editor): boolean {
  if (editor.isActive('table')) return editor.commands.goToNextCell();
  if (editor.isActive('taskItem')) return editor.commands.sinkListItem('taskItem') || true;
  if (editor.isActive('listItem')) return editor.commands.sinkListItem('listItem') || true;
  return changeIndent(editor, 1);
}

export function outdent(editor: Editor): boolean {
  if (editor.isActive('table')) return editor.commands.goToPreviousCell();
  if (editor.isActive('taskItem')) return editor.commands.liftListItem('taskItem') || true;
  if (editor.isActive('listItem')) return editor.commands.liftListItem('listItem') || true;
  return changeIndent(editor, -1);
}

export const Indent = Extension.create({
  name: 'indent',
  // Before the list and table shortcuts, so the rules above decide.
  priority: 1000,

  addGlobalAttributes() {
    return [
      {
        types: TYPES,
        attributes: {
          indent: {
            default: 0,
            parseHTML: (el) => {
              const m = /margin-left:\s*(\d+(?:\.\d+)?)em/i.exec(el.getAttribute('style') ?? '');
              return m ? Math.max(0, Math.min(MAX, Math.round(Number(m[1]) / 2))) : 0;
            },
            renderHTML: (attrs) => (attrs.indent ? { style: `margin-left: ${Number(attrs.indent) * 2}em` } : {}),
          },
        },
      },
    ];
  },

  addKeyboardShortcuts() {
    return {
      Tab: () => indent(this.editor),
      'Shift-Tab': () => outdent(this.editor),
    };
  },
});
