/**
 * Rich text editor (Tiptap): text style and font, size, colour, highlight, bold/italic/underline/strike, lists and
 * checklists, quote, link, picture (upload, paste or drop), table. The value is HTML ('' when empty); the server cleans
 * it before storing it (server/richText.ts) and RichText cleans it again before showing it.
 */
import { useEffect, useRef, useState } from 'react';
import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import { TableKit } from '@tiptap/extension-table';
import { TextStyleKit } from '@tiptap/extension-text-style';
import Highlight from '@tiptap/extension-highlight';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import { Placeholder } from '@tiptap/extensions';
import { Indent, indent, outdent } from './indent';
import {
  Bold, Columns3, Highlighter, ImagePlus, IndentDecrease, IndentIncrease, Italic, Link2, List, ListChecks, ListOrdered, Minus, Palette, Quote, Redo2, Rows3,
  Strikethrough, Table2, Trash2, Underline, Undo2, Unlink,
} from 'lucide-react';
import { useI18n } from '@/i18n';
import { useToast } from '@/components/ui';
import { uploadRichImage } from './images';
import { textToHtml } from './sanitize';
import './richtext.css';

const FONTS = [
  { label: 'Police', value: '' },
  { label: 'Sans serif', value: 'Inter, system-ui, sans-serif' },
  { label: 'Serif', value: 'Georgia, serif' },
  { label: 'Mono', value: 'ui-monospace, Consolas, monospace' },
];
const SIZES = ['', '12px', '14px', '16px', '18px', '22px', '28px'];
const COLORS = ['#111827', '#6b7280', '#da291c', '#d97706', '#16a34a', '#2563eb', '#7c3aed', '#db2777'];
const HIGHLIGHTS = ['#fef08a', '#bbf7d0', '#bfdbfe', '#fbcfe8', '#fed7aa'];

export interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  disabled?: boolean;
  /** Minimum height of the writing area, in px. */
  minHeight?: number;
  ariaLabel?: string;
}

export function RichTextEditor({ value, onChange, onBlur, placeholder, disabled, minHeight = 120, ariaLabel }: RichTextEditorProps) {
  const toast = useToast();
  const { t } = useI18n();
  const changeRef = useRef(onChange);
  changeRef.current = onChange;
  const blurRef = useRef(onBlur);
  blurRef.current = onBlur;

  const insertFiles = async (ed: Editor, files: File[]) => {
    for (const f of files.filter((x) => x.type.startsWith('image/'))) {
      try {
        const src = await uploadRichImage(f);
        ed.chain().focus().setImage({ src, alt: f.name.slice(0, 120) }).run();
      } catch (e) {
        toast(e instanceof Error ? e.message : String(e), 'err');
      }
    }
  };

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: false,
        link: { openOnClick: false, autolink: true, defaultProtocol: 'https', protocols: ['http', 'https', 'mailto'] },
      }),
      TextStyleKit.configure({ lineHeight: false }),
      Highlight.configure({ multicolor: true }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Image.configure({ allowBase64: true }),
      TableKit.configure({ table: { resizable: true } }),
      Placeholder.configure({ placeholder: placeholder ?? '' }),
      Indent,
    ],
    content: textToHtml(value),
    editable: !disabled,
    editorProps: {
      attributes: { class: 'rt-content rt-editable', ...(ariaLabel ? { 'aria-label': ariaLabel } : {}), style: `min-height:${minHeight}px` },
      handlePaste: (_view, event) => {
        const files = [...(event.clipboardData?.files ?? [])];
        if (!files.some((f) => f.type.startsWith('image/')) || !editorRef.current) return false;
        void insertFiles(editorRef.current, files);
        return true;
      },
      handleDrop: (_view, event) => {
        const files = [...((event as DragEvent).dataTransfer?.files ?? [])];
        if (!files.some((f) => f.type.startsWith('image/')) || !editorRef.current) return false;
        event.preventDefault();
        void insertFiles(editorRef.current, files);
        return true;
      },
    },
    onUpdate: ({ editor: ed }) => changeRef.current(ed.isEmpty ? '' : ed.getHTML()),
    onBlur: () => blurRef.current?.(),
  });
  const editorRef = useRef<Editor | null>(null);
  editorRef.current = editor;

  // Follow the value when it changes from outside (another week, another person), not while typing.
  useEffect(() => {
    if (!editor || editor.isFocused) return;
    const next = textToHtml(value);
    const current = editor.isEmpty ? '' : editor.getHTML();
    if (next !== current) editor.commands.setContent(next, { emitUpdate: false });
  }, [value, editor]);

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [editor, disabled]);

  if (!editor) return null;
  return (
    <div className={`rt-editor ${disabled ? 'is-disabled' : ''}`}>
      {!disabled && <Toolbar editor={editor} onFiles={(f) => void insertFiles(editor, f)} t={t} />}
      <EditorContent editor={editor} />
    </div>
  );
}

function Toolbar({ editor, onFiles, t }: { editor: Editor; onFiles: (f: File[]) => void; t: (fr: string, en: string) => string }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [palette, setPalette] = useState<'color' | 'highlight' | null>(null);
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      block: e.isActive('heading', { level: 1 }) ? 'h1' : e.isActive('heading', { level: 2 }) ? 'h2' : e.isActive('heading', { level: 3 }) ? 'h3' : 'p',
      font: (e.getAttributes('textStyle').fontFamily as string | undefined) ?? '',
      size: (e.getAttributes('textStyle').fontSize as string | undefined) ?? '',
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      underline: e.isActive('underline'),
      strike: e.isActive('strike'),
      bullet: e.isActive('bulletList'),
      ordered: e.isActive('orderedList'),
      task: e.isActive('taskList'),
      quote: e.isActive('blockquote'),
      link: e.isActive('link'),
      table: e.isActive('table'),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });
  const c = () => editor.chain().focus();

  const setBlock = (v: string) => {
    if (v === 'p') c().setParagraph().run();
    else c().toggleHeading({ level: Number(v.slice(1)) as 1 | 2 | 3 }).run();
  };
  const setLink = () => {
    const prev = (editor.getAttributes('link').href as string | undefined) ?? '';
    const url = window.prompt(t('Adresse du lien (https://…)', 'Link address (https://…)'), prev);
    if (url === null) return;
    const v = url.trim();
    if (!v) return void c().extendMarkRange('link').unsetLink().run();
    const href = /^(https?:|mailto:)/i.test(v) ? v : `https://${v}`;
    c().extendMarkRange('link').setLink({ href }).run();
  };

  const B = ({ on, title, onClick, children, disabled }: { on?: boolean; title: string; onClick: () => void; children: React.ReactNode; disabled?: boolean }) => (
    <button type="button" className={`rt-btn ${on ? 'on' : ''}`} title={title} aria-label={title} aria-pressed={on} disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={onClick}>
      {children}
    </button>
  );

  return (
    <div className="rt-toolbar" role="toolbar" aria-label={t('Mise en forme', 'Formatting')}>
      <select className="rt-select" value={s.block} onChange={(e) => setBlock(e.target.value)} aria-label={t('Style', 'Style')}>
        <option value="p">{t('Texte', 'Text')}</option>
        <option value="h1">{t('Titre 1', 'Heading 1')}</option>
        <option value="h2">{t('Titre 2', 'Heading 2')}</option>
        <option value="h3">{t('Titre 3', 'Heading 3')}</option>
      </select>
      <select className="rt-select" value={s.font} onChange={(e) => (e.target.value ? c().setFontFamily(e.target.value).run() : c().unsetFontFamily().run())} aria-label={t('Police', 'Font')}>
        {FONTS.map((f) => (
          <option key={f.label} value={f.value}>
            {f.value ? f.label : t('Police', 'Font')}
          </option>
        ))}
      </select>
      <select className="rt-select rt-size" value={s.size} onChange={(e) => (e.target.value ? c().setFontSize(e.target.value).run() : c().unsetFontSize().run())} aria-label={t('Taille', 'Size')}>
        {SIZES.map((x) => (
          <option key={x} value={x}>
            {x ? x.replace('px', '') : t('Taille', 'Size')}
          </option>
        ))}
      </select>
      <span className="rt-sep" />
      <B on={s.bold} title={t('Gras', 'Bold')} onClick={() => c().toggleBold().run()}><Bold size={15} /></B>
      <B on={s.italic} title={t('Italique', 'Italic')} onClick={() => c().toggleItalic().run()}><Italic size={15} /></B>
      <B on={s.underline} title={t('Souligné', 'Underline')} onClick={() => c().toggleUnderline().run()}><Underline size={15} /></B>
      <B on={s.strike} title={t('Barré', 'Strikethrough')} onClick={() => c().toggleStrike().run()}><Strikethrough size={15} /></B>
      <span className="rt-pop">
        <B on={palette === 'color'} title={t('Couleur du texte', 'Text colour')} onClick={() => setPalette(palette === 'color' ? null : 'color')}><Palette size={15} /></B>
        {palette === 'color' && (
          <span className="rt-palette" onMouseLeave={() => setPalette(null)}>
            {COLORS.map((col) => (
              <button key={col} type="button" className="rt-swatch" style={{ background: col }} title={col} onMouseDown={(e) => e.preventDefault()} onClick={() => { c().setColor(col).run(); setPalette(null); }} />
            ))}
            <button type="button" className="rt-swatch rt-swatch-none" title={t('Aucune', 'None')} onMouseDown={(e) => e.preventDefault()} onClick={() => { c().unsetColor().run(); setPalette(null); }}>×</button>
          </span>
        )}
      </span>
      <span className="rt-pop">
        <B on={palette === 'highlight'} title={t('Surligner', 'Highlight')} onClick={() => setPalette(palette === 'highlight' ? null : 'highlight')}><Highlighter size={15} /></B>
        {palette === 'highlight' && (
          <span className="rt-palette" onMouseLeave={() => setPalette(null)}>
            {HIGHLIGHTS.map((col) => (
              <button key={col} type="button" className="rt-swatch" style={{ background: col }} title={col} onMouseDown={(e) => e.preventDefault()} onClick={() => { c().setHighlight({ color: col }).run(); setPalette(null); }} />
            ))}
            <button type="button" className="rt-swatch rt-swatch-none" title={t('Aucun', 'None')} onMouseDown={(e) => e.preventDefault()} onClick={() => { c().unsetHighlight().run(); setPalette(null); }}>×</button>
          </span>
        )}
      </span>
      <span className="rt-sep" />
      <B on={s.bullet} title={t('Liste à puces', 'Bulleted list')} onClick={() => c().toggleBulletList().run()}><List size={15} /></B>
      <B on={s.ordered} title={t('Liste numérotée', 'Numbered list')} onClick={() => c().toggleOrderedList().run()}><ListOrdered size={15} /></B>
      <B on={s.task} title={t('Liste de cases à cocher', 'Checklist')} onClick={() => c().toggleTaskList().run()}><ListChecks size={15} /></B>
      <B title={t('Retrait (Tab)', 'Indent (Tab)')} onClick={() => indent(editor)}><IndentIncrease size={15} /></B>
      <B title={t('Réduire le retrait (Maj+Tab)', 'Outdent (Shift+Tab)')} onClick={() => outdent(editor)}><IndentDecrease size={15} /></B>
      <B on={s.quote} title={t('Citation', 'Quote')} onClick={() => c().toggleBlockquote().run()}><Quote size={15} /></B>
      <B title={t('Ligne de séparation', 'Divider')} onClick={() => c().setHorizontalRule().run()}><Minus size={15} /></B>
      <span className="rt-sep" />
      <B on={s.link} title={t('Lien', 'Link')} onClick={setLink}><Link2 size={15} /></B>
      {s.link && <B title={t('Retirer le lien', 'Remove link')} onClick={() => c().unsetLink().run()}><Unlink size={15} /></B>}
      <B title={t('Image', 'Picture')} onClick={() => fileRef.current?.click()}><ImagePlus size={15} /></B>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        hidden
        onChange={(e) => {
          onFiles([...(e.target.files ?? [])]);
          e.target.value = '';
        }}
      />
      <B on={s.table} title={t('Insérer un tableau', 'Insert table')} onClick={() => c().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}><Table2 size={15} /></B>
      {s.table && (
        <>
          <B title={t('Ajouter une colonne', 'Add column')} onClick={() => c().addColumnAfter().run()}><Columns3 size={15} /></B>
          <B title={t('Ajouter une ligne', 'Add row')} onClick={() => c().addRowAfter().run()}><Rows3 size={15} /></B>
          <B title={t('Supprimer la colonne', 'Delete column')} onClick={() => c().deleteColumn().run()}><span className="rt-mini">−col</span></B>
          <B title={t('Supprimer la ligne', 'Delete row')} onClick={() => c().deleteRow().run()}><span className="rt-mini">−lig</span></B>
          <B title={t('Supprimer le tableau', 'Delete table')} onClick={() => c().deleteTable().run()}><Trash2 size={15} /></B>
        </>
      )}
      <span className="rt-spacer" />
      <B title={t('Annuler', 'Undo')} disabled={!s.canUndo} onClick={() => c().undo().run()}><Undo2 size={15} /></B>
      <B title={t('Rétablir', 'Redo')} disabled={!s.canRedo} onClick={() => c().redo().run()}><Redo2 size={15} /></B>
    </div>
  );
}
