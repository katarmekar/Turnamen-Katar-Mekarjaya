"use client";

import { useEffect, useRef } from "react";

type RulesRichEditorProps = {
  name: string;
  defaultHtml?: string;
  placeholder?: string;
};

type Cmd =
  | "bold"
  | "italic"
  | "underline"
  | "justifyLeft"
  | "justifyCenter"
  | "justifyRight"
  | "justifyFull"
  | "insertUnorderedList"
  | "insertOrderedList"
  | "indent"
  | "outdent"
  | "removeFormat";

function run(cmd: Cmd) {
  document.execCommand(cmd, false);
}

export function RulesRichEditor({
  name,
  defaultHtml = "<p></p>",
  placeholder = "Tulis isi pasal di sini...",
}: RulesRichEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const hiddenRef = useRef<HTMLInputElement>(null);
  const readyRef = useRef(false);

  function syncHidden() {
    if (!editorRef.current || !hiddenRef.current) return;
    hiddenRef.current.value = editorRef.current.innerHTML;
  }

  useEffect(() => {
    if (!editorRef.current || readyRef.current) return;
    editorRef.current.innerHTML = defaultHtml?.trim() ? defaultHtml : "<p></p>";
    readyRef.current = true;
    syncHidden();
  }, [defaultHtml]);

  const tools: { cmd: Cmd; label: string; title: string }[] = [
    { cmd: "bold", label: "B", title: "Tebal" },
    { cmd: "italic", label: "I", title: "Miring" },
    { cmd: "underline", label: "U", title: "Garis bawah" },
    { cmd: "justifyLeft", label: "Kiri", title: "Rata kiri" },
    { cmd: "justifyCenter", label: "Tengah", title: "Rata tengah" },
    { cmd: "justifyRight", label: "Kanan", title: "Rata kanan" },
    { cmd: "justifyFull", label: "Justify", title: "Rata kiri-kanan" },
    { cmd: "insertUnorderedList", label: "• Bullet", title: "Bullet poin" },
    { cmd: "insertOrderedList", label: "1. Nomor", title: "Nomor poin" },
    { cmd: "indent", label: "→ Sub", title: "Sub-poin (indent)" },
    { cmd: "outdent", label: "← Out", title: "Kurangi indent" },
    { cmd: "removeFormat", label: "Clear", title: "Hapus format" },
  ];

  return (
    <div className="rules-word-editor">
      <input
        ref={hiddenRef}
        type="hidden"
        name={name}
        defaultValue={defaultHtml}
      />

      <div className="rules-word-toolbar" role="toolbar" aria-label="Format teks">
        {tools.map((t) => (
          <button
            key={t.cmd}
            type="button"
            title={t.title}
            className={
              t.cmd === "bold"
                ? "rules-word-tool is-bold"
                : t.cmd === "italic"
                  ? "rules-word-tool is-italic"
                  : t.cmd === "underline"
                    ? "rules-word-tool is-underline"
                    : "rules-word-tool"
            }
            onMouseDown={(e) => {
              e.preventDefault();
              editorRef.current?.focus();
              run(t.cmd);
              syncHidden();
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div
        ref={editorRef}
        className="rules-word-canvas"
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onInput={syncHidden}
        onBlur={syncHidden}
      />
    </div>
  );
}
