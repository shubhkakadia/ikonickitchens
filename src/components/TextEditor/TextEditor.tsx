import React, { useEffect, useState, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TiptapUnderline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  Quote,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Undo,
  Redo,
  ChevronDown,
} from "lucide-react";

const TextEditor = ({
  initialContent = "",
  onSave,
  placeholder = "Start typing...",
}) => {
  const [showHeadingDropdown, setShowHeadingDropdown] = useState(false);
  const [showHighlightDropdown, setShowHighlightDropdown] = useState(false);
  const [showTextColorDropdown, setShowTextColorDropdown] = useState(false);

  const [currentHighlightColor, setCurrentHighlightColor] = useState("#d1d5db");
  const [currentTextColor, setCurrentTextColor] = useState("#000000");
  const debounceTimerRef = useRef(null);
  const [saveStatus, setSaveStatus] = useState("idle"); // "idle" | "saving" | "saved"
  const saveStatusTimeoutRef = useRef(null);

  const [buttonStates, setButtonStates] = useState({
    bold: false,
    italic: false,
    underline: false,
    strike: false,
    bulletList: false,
    orderedList: false,
    blockquote: false,
    codeBlock: false,
    alignLeft: false,
    alignCenter: false,
    alignRight: false,
    heading: false,
    highlight: false,
    canUndo: false,
    canRedo: false,
  });

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      TiptapUnderline,
      TextStyle,
      Color,
      TextAlign.configure({
        types: ["heading", "paragraph"],
        alignments: ["left", "center", "right"],
      }),
      Highlight.configure({
        multicolor: true,
        HTMLAttributes: {
          class: "highlight-mark",
        },
      }),
    ],
    content: initialContent,
    editorProps: {
      attributes: {
        class: "prose max-w-none focus:outline-none min-h-[300px] p-4",
      },
    },
    onUpdate: ({ editor }) => {
      updateButtonStates(editor);

      // Debounced auto-save
      if (onSave) {
        // Clear existing timer
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }

        // Set status to saving when user stops typing
        setSaveStatus("saving");

        // Set new timer for auto-save
        debounceTimerRef.current = setTimeout(async () => {
          const html = editor.getHTML();// Debug log

          try {
            // Call onSave and wait if it's async
            const result = onSave(html);
            if (result && typeof result.then === "function") {
              await result;
            }

            // Show saved status
            setSaveStatus("saved");

            // Clear saved status after 2 seconds
            if (saveStatusTimeoutRef.current) {
              clearTimeout(saveStatusTimeoutRef.current);
            }
            saveStatusTimeoutRef.current = setTimeout(() => {
              setSaveStatus("idle");
            }, 2000);
          } catch (error) {
            console.error("Error saving:", error);
            setSaveStatus("idle");
          }
        }, 1000); // 1 second debounce delay
      }
    },
    onSelectionUpdate: ({ editor }) => {
      updateButtonStates(editor);
    },
  });

  const updateButtonStates = (editor) => {
    setButtonStates({
      bold: editor.isActive("bold"),
      italic: editor.isActive("italic"),
      underline: editor.isActive("underline"),
      strike: editor.isActive("strike"),
      bulletList: editor.isActive("bulletList"),
      orderedList: editor.isActive("orderedList"),
      blockquote: editor.isActive("blockquote"),
      codeBlock: editor.isActive("codeBlock"),
      alignLeft: editor.isActive({ textAlign: "left" }),
      alignCenter: editor.isActive({ textAlign: "center" }),
      alignRight: editor.isActive({ textAlign: "right" }),
      heading: editor.isActive("heading"),
      highlight: editor.isActive("highlight"),
      canUndo: editor.can().undo(),
      canRedo: editor.can().redo(),
    });

    // Get current highlight color
    if (editor.isActive("highlight")) {
      const attrs = editor.getAttributes("highlight");
      setCurrentHighlightColor(attrs.color || "#fef08a");
    } else {
      setCurrentHighlightColor("#d1d5db"); // Gray when no highlight
    }

    // Get current text color
    const textColor = editor.getAttributes("textStyle").color;
    if (textColor) {
      setCurrentTextColor(textColor);
    } else {
      setCurrentTextColor("#000000"); // Black when no color set
    }
  };

  useEffect(() => {
    if (editor && initialContent !== undefined) {
      // Only update if content is actually different to prevent unnecessary resets
      const currentContent = editor.getHTML();
      if (currentContent !== initialContent) {
        editor.commands.setContent(initialContent || "", { emitUpdate: false });
      }
    }
  }, [initialContent, editor]);

  useEffect(() => {
    if (editor) {
      updateButtonStates(editor);
    }
  }, [editor]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      const target = e.target;
      if (!target.closest(".dropdown-container")) {
        setShowHeadingDropdown(false);
        setShowHighlightDropdown(false);
        setShowTextColorDropdown(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (saveStatusTimeoutRef.current) {
        clearTimeout(saveStatusTimeoutRef.current);
      }
    };
  }, []);

  if (!editor) {
    return null;
  }

  const ToolbarButton = ({
    onClick,
    isActive = false,
    children,
    title,
    disabled = false,
  }) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={`p-2.5 rounded-md transition-all duration-200 ${
        isActive
          ? "bg-blue-500 text-white shadow-md"
          : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
      } ${disabled ? "opacity-30 cursor-not-allowed" : "cursor-pointer"}`}
    >
      {children}
    </button>
  );

  const getActiveHeading = () => {
    if (editor.isActive("heading", { level: 1 })) return "Heading 1";
    if (editor.isActive("heading", { level: 2 })) return "Heading 2";
    if (editor.isActive("heading", { level: 3 })) return "Heading 3";
    return "Normal";
  };

  const highlightColors = [
    { name: "Yellow", color: "#fef08a" },
    { name: "Green", color: "#bbf7d0" },
    { name: "Blue", color: "#bfdbfe" },
    { name: "Pink", color: "#fbcfe8" },
    { name: "Orange", color: "#fed7aa" },
    { name: "Purple", color: "#e9d5ff" },
    { name: "Red", color: "#fecaca" },
    { name: "Gray", color: "#e5e7eb" },
  ];

  const textColors = [
    { name: "Black", color: "#000000" },
    { name: "Dark Gray", color: "#374151" },
    { name: "Gray", color: "#6b7280" },
    { name: "Red", color: "#dc2626" },
    { name: "Orange", color: "#ea580c" },
    { name: "Yellow", color: "#ca8a04" },
    { name: "Green", color: "#16a34a" },
    { name: "Blue", color: "#2563eb" },
    { name: "Indigo", color: "#4f46e5" },
    { name: "Purple", color: "#9333ea" },
    { name: "Pink", color: "#db2777" },
    { name: "Brown", color: "#92400e" },
  ];

  return (
    <div className="w-full">
      <style>{`
        .ProseMirror {
          outline: none;
        }
        
        .ProseMirror ::selection {
          background-color: #2563eb !important;
          color: #ffffff !important;
        }
        
        .ProseMirror ::-moz-selection {
          background-color: #2563eb !important;
          color: #ffffff !important;
        }
        
        .ProseMirror mark::selection {
          background-color: #1e40af !important;
          color: #ffffff !important;
        }
        
        .ProseMirror *::selection {
          background-color: #2563eb !important;
          color: #ffffff !important;
        }
        
        .ProseMirror *::-moz-selection {
          background-color: #2563eb !important;
          color: #ffffff !important;
        }
        
        .ProseMirror p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: #adb5bd;
          pointer-events: none;
          height: 0;
        }
        
        .ProseMirror h1 {
          font-size: 2em;
          font-weight: bold;
          margin: 0.5em 0;
          line-height: 1.2;
        }
        
        .ProseMirror h2 {
          font-size: 1.5em;
          font-weight: bold;
          margin: 0.5em 0;
          line-height: 1.3;
        }
        
        .ProseMirror h3 {
          font-size: 1.25em;
          font-weight: bold;
          margin: 0.5em 0;
          line-height: 1.4;
        }
        
        .ProseMirror p {
          margin: 0.5em 0;
        }
        
        .ProseMirror code {
          background: #f3f4f6;
          padding: 0.2em 0.4em;
          border-radius: 0.25em;
          font-family: monospace;
          font-size: 0.9em;
        }
        
        .ProseMirror pre {
          background: #1f2937;
          color: #f9fafb;
          padding: 1em;
          border-radius: 0.5em;
          overflow-x: auto;
          margin: 1em 0;
        }
        
        .ProseMirror pre code {
          background: none;
          color: inherit;
          padding: 0;
        }
        
        .ProseMirror blockquote {
          border-left: 4px solid #d1d5db;
          padding-left: 1em;
          margin: 1em 0;
          font-style: italic;
          color: #6b7280;
        }
        
        .ProseMirror ul {
          padding-left: 1.5em;
          margin: 0.5em 0;
          list-style-type: disc;
          list-style-position: outside;
        }
        
        .ProseMirror ol {
          padding-left: 1.5em;
          margin: 0.5em 0;
          list-style-type: decimal;
          list-style-position: outside;
        }
        
        .ProseMirror li {
          margin: 0.25em 0;
          display: list-item;
        }
        
        .ProseMirror mark {
          padding: 0.1em 0.15em;
          border-radius: 0.2em;
          display: inline;
          word-spacing: normal;
        }
        
        .ProseMirror .highlight-mark {
          padding: 0.1em 0.15em;
          border-radius: 0.2em;
          word-spacing: normal;
        }
        
        .ProseMirror mark + mark {
          margin-left: 1px;
        }
        
        .ProseMirror strong {
          font-weight: 700;
        }
        
        .ProseMirror em {
          font-style: italic;
        }
        
        .ProseMirror u {
          text-decoration: underline;
        }
        
        .ProseMirror s {
          text-decoration: line-through;
        }
      `}</style>

      <div className="border border-slate-300 rounded-lg bg-white overflow-hidden">
        {/* Toolbar */}
        <div className="border-b-2 border-gray-200 bg-gradient-to-b from-gray-50 to-white px-3 py-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Heading Dropdown */}
            <div className="relative dropdown-container">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowHeadingDropdown(!showHeadingDropdown);
                  setShowHighlightDropdown(false);
                  setShowTextColorDropdown(false);
                }}
                className={`cursor-pointer px-3 py-2 rounded-md transition-all duration-200 flex items-center gap-2 min-w-[130px] justify-between border ${
                  buttonStates.heading
                    ? "bg-blue-500 border-blue-500 text-white shadow-md"
                    : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400"
                }`}
              >
                <span className="text-sm font-medium">
                  {getActiveHeading()}
                </span>
                <ChevronDown
                  size={16}
                  className={`transition-transform ${
                    showHeadingDropdown ? "rotate-180" : ""
                  }`}
                />
              </button>

              {showHeadingDropdown && (
                <div className="absolute top-full left-0 mt-2 bg-white border-2 border-gray-200 rounded-lg shadow-xl z-20 min-w-[180px] overflow-hidden">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      editor.chain().focus().setParagraph().run();
                      setShowHeadingDropdown(false);
                    }}
                    className="w-full px-4 py-2.5 text-left hover:bg-blue-50 transition-colors text-sm border-b border-gray-100"
                  >
                    Normal
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      editor.chain().focus().toggleHeading({ level: 1 }).run();
                      setShowHeadingDropdown(false);
                    }}
                    className="w-full px-4 py-2.5 text-left hover:bg-blue-50 transition-colors text-xl font-bold border-b border-gray-100"
                  >
                    Heading 1
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      editor.chain().focus().toggleHeading({ level: 2 }).run();
                      setShowHeadingDropdown(false);
                    }}
                    className="w-full px-4 py-2.5 text-left hover:bg-blue-50 transition-colors text-lg font-bold border-b border-gray-100"
                  >
                    Heading 2
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      editor.chain().focus().toggleHeading({ level: 3 }).run();
                      setShowHeadingDropdown(false);
                    }}
                    className="w-full px-4 py-2.5 text-left hover:bg-blue-50 transition-colors text-base font-bold"
                  >
                    Heading 3
                  </button>
                </div>
              )}
            </div>

            <div className="w-px h-8 bg-gray-300"></div>

            {/* Text Formatting */}
            <div className="flex gap-1">
              <ToolbarButton
                onClick={() => editor.chain().focus().toggleBold().run()}
                isActive={buttonStates.bold}
                title="Bold (Ctrl+B)"
              >
                <Bold size={18} strokeWidth={2.5} />
              </ToolbarButton>
              <ToolbarButton
                onClick={() => editor.chain().focus().toggleItalic().run()}
                isActive={buttonStates.italic}
                title="Italic (Ctrl+I)"
              >
                <Italic size={18} strokeWidth={2.5} />
              </ToolbarButton>
              <ToolbarButton
                onClick={() => editor.chain().focus().toggleUnderline().run()}
                isActive={buttonStates.underline}
                title="Underline (Ctrl+U)"
              >
                <Underline size={18} strokeWidth={2.5} />
              </ToolbarButton>
              <ToolbarButton
                onClick={() => editor.chain().focus().toggleStrike().run()}
                isActive={buttonStates.strike}
                title="Strikethrough"
              >
                <Strikethrough size={18} strokeWidth={2.5} />
              </ToolbarButton>
            </div>

            <div className="w-px h-8 bg-gray-300"></div>

            {/* Text Color Dropdown */}
            <div className="relative dropdown-container">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowTextColorDropdown(!showTextColorDropdown);
                  setShowHeadingDropdown(false);
                  setShowHighlightDropdown(false);
                }}
                className={`cursor-pointer px-3 py-2 rounded-md transition-all duration-200 flex items-center gap-2 border ${
                  currentTextColor !== "#000000"
                    ? "bg-blue-50 border-blue-400 text-gray-900 shadow-md"
                    : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400"
                }`}
                title="Text Color"
              >
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-sm">A</span>
                  <div
                    className="w-5 h-1 rounded-full transition-colors"
                    style={{ backgroundColor: currentTextColor }}
                  ></div>
                </div>
                <ChevronDown
                  size={14}
                  className={`transition-transform ${
                    showTextColorDropdown ? "rotate-180" : ""
                  }`}
                />
              </button>

              {showTextColorDropdown && (
                <div
                  className="absolute top-full left-0 mt-2 bg-white border-2 border-gray-200 rounded-lg shadow-xl z-20 p-3"
                  style={{ minWidth: "200px" }}
                >
                  <div className="mb-2 px-1 text-xs font-semibold text-gray-600 uppercase tracking-wide">
                    Text Color
                  </div>
                  <div className="grid grid-cols-4 gap-2 mb-3">
                    {textColors.map((item) => (
                      <button
                        key={item.color}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          editor.chain().focus().setColor(item.color).run();
                          setShowTextColorDropdown(false);
                        }}
                        className={`w-10 h-10 rounded-lg border-2 hover:border-gray-500 hover:scale-110 transition-all shadow-sm ${
                          currentTextColor === item.color
                            ? "border-blue-500 ring-2 ring-blue-300"
                            : "border-gray-300"
                        }`}
                        style={{ backgroundColor: item.color }}
                        title={item.name}
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      editor.chain().focus().unsetColor().run();
                      setShowTextColorDropdown(false);
                    }}
                    className="w-full px-3 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors font-medium"
                  >
                    Reset to Default
                  </button>
                </div>
              )}
            </div>

            <div className="w-px h-8 bg-gray-300"></div>

            {/* Highlight Dropdown */}
            <div className="relative dropdown-container">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowHighlightDropdown(!showHighlightDropdown);
                  setShowHeadingDropdown(false);
                  setShowTextColorDropdown(false);
                }}
                className={`cursor-pointer px-3 py-2 rounded-md transition-all duration-200 flex items-center gap-2 border ${
                  buttonStates.highlight
                    ? "bg-gray-200 border-gray-400 text-gray-900 shadow-md"
                    : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400"
                }`}
                title="Highlight"
              >
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-sm">A</span>
                  <div
                    className="w-4 h-4 rounded border border-gray-300 transition-colors"
                    style={{ backgroundColor: currentHighlightColor }}
                  ></div>
                </div>
                <ChevronDown
                  size={14}
                  className={`transition-transform ${
                    showHighlightDropdown ? "rotate-180" : ""
                  }`}
                />
              </button>

              {showHighlightDropdown && (
                <div
                  className="absolute top-full left-0 mt-2 bg-white border-2 border-gray-200 rounded-lg shadow-xl z-20 p-3"
                  style={{ minWidth: "200px" }}
                >
                  <div className="mb-2 px-1 text-xs font-semibold text-gray-600 uppercase tracking-wide">
                    Highlight Color
                  </div>
                  <div className="grid grid-cols-4 gap-2 mb-3">
                    {highlightColors.map((item) => (
                      <button
                        key={item.color}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();

                          // Apply highlight with the selected color
                          editor
                            .chain()
                            .focus()
                            .setHighlight({ color: item.color })
                            .run();

                          setShowHighlightDropdown(false);
                        }}
                        className="w-10 h-10 rounded-lg border-2 border-gray-300 hover:border-gray-500 hover:scale-110 transition-all shadow-sm"
                        style={{ backgroundColor: item.color }}
                        title={item.name}
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      editor.chain().focus().unsetHighlight().run();
                      setShowHighlightDropdown(false);
                    }}
                    className="w-full px-3 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors font-medium"
                  >
                    Remove Highlight
                  </button>
                </div>
              )}
            </div>

            <div className="w-px h-8 bg-gray-300"></div>

            {/* Lists and Blocks */}
            <div className="flex gap-1">
              <ToolbarButton
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                isActive={buttonStates.bulletList}
                title="Bullet List"
              >
                <List size={18} strokeWidth={2.5} />
              </ToolbarButton>
              <ToolbarButton
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                isActive={buttonStates.orderedList}
                title="Numbered List"
              >
                <ListOrdered size={18} strokeWidth={2.5} />
              </ToolbarButton>
              <ToolbarButton
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
                isActive={buttonStates.blockquote}
                title="Blockquote"
              >
                <Quote size={18} strokeWidth={2.5} />
              </ToolbarButton>
            </div>

            <div className="w-px h-8 bg-gray-300"></div>

            {/* Alignment */}
            <div className="flex gap-1">
              <ToolbarButton
                onClick={() =>
                  editor.chain().focus().setTextAlign("left").run()
                }
                isActive={buttonStates.alignLeft}
                title="Align Left"
              >
                <AlignLeft size={18} strokeWidth={2.5} />
              </ToolbarButton>
              <ToolbarButton
                onClick={() =>
                  editor.chain().focus().setTextAlign("center").run()
                }
                isActive={buttonStates.alignCenter}
                title="Align Center"
              >
                <AlignCenter size={18} strokeWidth={2.5} />
              </ToolbarButton>
              <ToolbarButton
                onClick={() =>
                  editor.chain().focus().setTextAlign("right").run()
                }
                isActive={buttonStates.alignRight}
                title="Align Right"
              >
                <AlignRight size={18} strokeWidth={2.5} />
              </ToolbarButton>
            </div>

            <div className="w-px h-8 bg-gray-300"></div>

            {/* Undo/Redo */}
            <div className="flex gap-1">
              <ToolbarButton
                onClick={() => editor.chain().focus().undo().run()}
                title="Undo (Ctrl+Z)"
                disabled={!buttonStates.canUndo}
              >
                <Undo size={18} strokeWidth={2.5} />
              </ToolbarButton>
              <ToolbarButton
                onClick={() => editor.chain().focus().redo().run()}
                title="Redo (Ctrl+Y)"
                disabled={!buttonStates.canRedo}
              >
                <Redo size={18} strokeWidth={2.5} />
              </ToolbarButton>
            </div>
          </div>
        </div>

        {/* Editor Content */}
        <div className="bg-white">
          <EditorContent editor={editor} />
        </div>

        {/* Save Status Indicator */}
        {onSave && saveStatus !== "idle" && (
          <div className="border-t border-gray-200 px-4 py-2 bg-gray-50">
            <div className="flex items-center gap-2 text-sm">
              {saveStatus === "saving" && (
                <>
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                  <span className="text-gray-600">Saving...</span>
                </>
              )}
              {saveStatus === "saved" && (
                <>
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-green-600 font-medium">Saved!</span>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TextEditor;
