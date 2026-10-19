import { Input } from '@mantine/core';
import { RichTextEditor } from '@mantine/tiptap';
import { useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useEffect } from 'react';
import '@mantine/tiptap/styles.css';

interface Props {
  label?: string;
  value: string;
  onChange: (html: string) => void;
  error?: string;
  description?: string;
  minHeight?: number;
  required?: boolean;
}

/**
 * The ONLY multi-line text input used in forms (replaces <Textarea/> everywhere).
 * Stores sanitised-by-schema HTML. Never render the stored value with dangerouslySetInnerHTML
 * unless it has been purified server-side (added with the comments module in Bundle 2).
 */
export function RichTextField({ label, value, onChange, error, description, minHeight = 120, required }: Props) {
  const editor = useEditor({
    extensions: [StarterKit],      // v3 StarterKit already includes link & underline
    content: value,
    onUpdate: ({ editor: e }) => onChange(e.isEmpty ? '' : e.getHTML()),
  });

  // Reset content when the form is re-opened with another record.
  useEffect(() => {
    if (editor && value !== (editor.isEmpty ? '' : editor.getHTML())) editor.commands.setContent(value || '', { emitUpdate: false });
  }, [value, editor]);

  return (
    <Input.Wrapper label={label} description={description} error={error} withAsterisk={required}>
      <RichTextEditor editor={editor} mt={label || description ? 4 : 0}>
        <RichTextEditor.Toolbar sticky stickyOffset={0}>
          <RichTextEditor.ControlsGroup>
            <RichTextEditor.Bold />
            <RichTextEditor.Italic />
            <RichTextEditor.Underline />
            <RichTextEditor.Strikethrough />
          </RichTextEditor.ControlsGroup>
          <RichTextEditor.ControlsGroup>
            <RichTextEditor.H2 />
            <RichTextEditor.H3 />
            <RichTextEditor.BulletList />
            <RichTextEditor.OrderedList />
            <RichTextEditor.Blockquote />
          </RichTextEditor.ControlsGroup>
          <RichTextEditor.ControlsGroup>
            <RichTextEditor.Link />
            <RichTextEditor.Unlink />
            <RichTextEditor.Undo />
            <RichTextEditor.Redo />
          </RichTextEditor.ControlsGroup>
        </RichTextEditor.Toolbar>
        <RichTextEditor.Content style={{ minHeight }} />
      </RichTextEditor>
    </Input.Wrapper>
  );
}
