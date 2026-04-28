"use client"

import {
  useRef,
  useState,
  useEffect,
  forwardRef,
  useImperativeHandle,
} from "react"
import type { User } from "@/types/api"

export interface BongInputHandle {
  clear: () => void
}

interface BongInputProps {
  users: User[]
  onChange: (offense: string, subjects: User[]) => void
}

function getActiveMention(el: HTMLElement) {
  const sel = window.getSelection()
  if (!sel?.rangeCount) return null
  const range = sel.getRangeAt(0)
  const node = range.startContainer
  if (node.nodeType !== Node.TEXT_NODE) return null
  const textBefore = (node.textContent ?? "").slice(0, range.startOffset)
  const match = textBefore.match(/@(\w+)$/)
  if (!match || match[1].length === 0) return null
  return {
    query: match[1],
    textNode: node as Text,
    atOffset: range.startOffset - match[0].length,
    endOffset: range.startOffset,
  }
}

function extractContent(el: HTMLElement): { offense: string; subjects: User[] } {
  let offense = ""
  const subjects: User[] = []
  el.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      offense += node.textContent ?? ""
    } else if (node instanceof HTMLElement && node.dataset.userId) {
      offense += node.textContent ?? ""
      const user = JSON.parse(node.dataset.user!) as User
      if (!subjects.find((s) => s.id === user.id)) subjects.push(user)
    }
  })
  return { offense: offense.trim(), subjects }
}

export const BongInput = forwardRef<BongInputHandle, BongInputProps>(
  ({ users, onChange }, ref) => {
    const divRef = useRef<HTMLDivElement>(null)
    const [mention, setMention] = useState<ReturnType<typeof getActiveMention>>(null)
    const [charCount, setCharCount] = useState(0)
    const MAX_CHARS = 300

    useImperativeHandle(ref, () => ({
      clear() {
        if (divRef.current) {
          divRef.current.innerHTML = ""
        }
        setMention(null)
        onChange("", [])
      },
    }))

    const suggestions = mention
      ? users.filter((u) =>
          u.display_name.toLowerCase().startsWith(mention.query.toLowerCase())
        )
      : []

    function insertPill(user: User) {
      if (!mention || !divRef.current) return
      const { textNode, atOffset, endOffset } = mention

      const beforeText = textNode.textContent!.slice(0, atOffset)
      const afterText = textNode.textContent!.slice(endOffset)

      const pill = document.createElement("span")
      pill.contentEditable = "false"
      pill.dataset.userId = user.id
      pill.dataset.user = JSON.stringify(user)
      pill.textContent = `@${user.display_name}`
      pill.className =
        "rounded-full bg-primary/20 text-primary text-sm px-2 mx-0.5 select-none align-baseline"

      const parent = textNode.parentNode!
      parent.insertBefore(document.createTextNode(beforeText), textNode)
      parent.insertBefore(pill, textNode)
      const afterNode = document.createTextNode("\u00A0" + afterText)
      parent.insertBefore(afterNode, textNode)
      parent.removeChild(textNode)

      const sel = window.getSelection()!
      const r = document.createRange()
      r.setStart(afterNode, 1)
      r.collapse(true)
      sel.removeAllRanges()
      sel.addRange(r)

      setMention(null)
      const { offense, subjects } = extractContent(divRef.current)
      onChange(offense, subjects)
    }

    function handleInput() {
      if (!divRef.current) return
      const { offense, subjects } = extractContent(divRef.current)
      setCharCount(offense.length)
      const m = getActiveMention(divRef.current)
      setMention(m)
      onChange(offense, subjects)
    }

    function handleKeyPress(e: React.KeyboardEvent) {
      if (!divRef.current) return
      const { offense } = extractContent(divRef.current)
      if (offense.length >= MAX_CHARS) {
        e.preventDefault()
      }
    }

    function handlePaste(e: React.ClipboardEvent) {
      e.preventDefault()
      if (!divRef.current) return
      const { offense } = extractContent(divRef.current)
      const pasted = e.clipboardData.getData("text/plain")
      const remaining = MAX_CHARS - offense.length
      if (remaining <= 0) return
      const truncated = pasted.slice(0, remaining)
      document.execCommand("insertText", false, truncated)
    }

    function handleKeyDown(e: React.KeyboardEvent) {
      if ((e.key === "Tab" || e.key === "Enter") && suggestions.length > 0) {
        e.preventDefault()
        insertPill(suggestions[0])
        return
      }
      if (e.key === "Escape") setMention(null)
      if (e.key === "Enter") e.preventDefault() // no newlines
    }

    useEffect(() => {
      function handleClick(e: MouseEvent) {
        if (divRef.current && !divRef.current.contains(e.target as Node)) {
          setMention(null)
        }
      }
      document.addEventListener("mousedown", handleClick)
      return () => document.removeEventListener("mousedown", handleClick)
    }, [])

    return (
      <div className="relative flex-1">
        <div
          ref={divRef}
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onKeyPress={handleKeyPress}
          onPaste={handlePaste}
          data-placeholder="@someone did something bong..."
          className="min-h-[38px] w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring break-words overflow-wrap-anywhere empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground"
        />
        {charCount > 250 && (
          <p className={`absolute top-full right-0 mt-0.5 text-xs ${charCount >= MAX_CHARS ? "text-destructive" : "text-muted-foreground"}`}>
            {charCount}/{MAX_CHARS}
          </p>
        )}
        {suggestions.length > 0 && (
          <div className="absolute bottom-full mb-1 left-0 z-50 w-48 rounded-md border border-border bg-popover shadow-md overflow-hidden">
            {suggestions.map((u) => (
              <button
                key={u.id}
                type="button"
                className="w-full px-3 py-2 text-sm text-left hover:bg-muted transition-colors"
                onMouseDown={(e) => {
                  e.preventDefault()
                  insertPill(u)
                }}
              >
                @{u.display_name}
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }
)

BongInput.displayName = "BongInput"
