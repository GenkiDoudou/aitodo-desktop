import { onBeforeUnmount, shallowRef, type ShallowRef } from 'vue'
import { useEditor, type Editor } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Highlight from '@tiptap/extension-highlight'
import { Markdown } from 'tiptap-markdown'
import type { MarkdownTool } from '@shared/markdown-tools'

export interface UseTaskTiptapOptions {
  placeholder: string
  /** 正文 Markdown 变更（不含外置附件注释） */
  onBodyChange: (markdown: string) => void
  onPasteImage: (file: File) => void | Promise<void>
}

/** TipTap 所见即所得：读写 Markdown 正文，图片 inline 显示 */
export function useTaskTiptapEditor(options: UseTaskTiptapOptions): {
  editor: ShallowRef<Editor | undefined>
  setMarkdownContent: (markdown: string) => void
  getMarkdown: () => string
  applyTool: (tool: MarkdownTool) => void
  insertImage: (uri: string, name: string) => void
  destroy: () => void
} {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] }
      }),
      Image.configure({
        inline: true,
        allowBase64: false
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Highlight,
      Placeholder.configure({ placeholder: options.placeholder }),
      Markdown.configure({
        html: false,
        transformPastedText: true,
        breaks: true
      })
    ],
    editorProps: {
      attributes: {
        class: 'task-tiptap__content'
      },
      handlePaste(_view, event) {
        const items = event.clipboardData?.items
        if (!items) return false
        for (const item of items) {
          if (!item.type.startsWith('image/')) continue
          event.preventDefault()
          const file = item.getAsFile()
          if (file) void options.onPasteImage(file)
          return true
        }
        return false
      }
    },
    onUpdate: ({ editor: ed }) => {
      const storage = ed.storage as { markdown?: { getMarkdown: () => string } }
      options.onBodyChange(storage.markdown?.getMarkdown() ?? '')
    }
  })

  function getMarkdown(): string {
    const ed = editor.value
    if (!ed) return ''
    const storage = ed.storage as { markdown?: { getMarkdown: () => string } }
    return storage.markdown?.getMarkdown() ?? ''
  }

  function setMarkdownContent(markdown: string) {
    const ed = editor.value
    if (!ed) return
    const next = markdown || ''
    if (getMarkdown() === next) return
    ed.commands.setContent(next, false, { contentType: 'markdown' } as never)
  }

  function insertImage(uri: string, name: string) {
    editor.value?.chain().focus().setImage({ src: uri, alt: name }).run()
  }

  function applyTool(tool: MarkdownTool) {
    const ed = editor.value
    if (!ed) return
    const chain = ed.chain().focus()
    switch (tool.key) {
      case 'b':
        chain.toggleBold().run()
        break
      case 'i':
        chain.toggleItalic().run()
        break
      case 'mark':
        chain.toggleHighlight().run()
        break
      case 'strike':
        chain.toggleStrike().run()
        break
      case 'code':
        chain.toggleCode().run()
        break
      case 'h1':
        chain.toggleHeading({ level: 1 }).run()
        break
      case 'h2':
        chain.toggleHeading({ level: 2 }).run()
        break
      case 'h3':
        chain.toggleHeading({ level: 3 }).run()
        break
      case 'ul':
        chain.toggleBulletList().run()
        break
      case 'ol':
        chain.toggleOrderedList().run()
        break
      case 'check':
        chain.toggleTaskList().run()
        break
      case 'quote':
        chain.toggleBlockquote().run()
        break
      case 'link':
        chain.setLink({ href: 'https://' }).run()
        break
      case 'hr':
        chain.setHorizontalRule().run()
        break
      default:
        break
    }
  }

  function destroy() {
    editor.value?.destroy()
  }

  onBeforeUnmount(() => {
    destroy()
  })

  return {
    editor: editor as ShallowRef<Editor | undefined>,
    setMarkdownContent,
    getMarkdown,
    applyTool,
    insertImage,
    destroy
  }
}
