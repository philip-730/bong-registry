"use client"

import {
  useRef,
  useState,
  useEffect,
  forwardRef,
  useImperativeHandle,
} from "react"
import type { User, OffenseToken } from "@/types/api"

export interface BongInputHandle {
  clear: () => void
}

interface BongInputProps {
  users: User[]
  onChange: (tokens: OffenseToken[], subjects: User[]) => void
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

function extractContent(el: HTMLElement): { tokens: OffenseToken[]; subjects: User[]; charCount: number } {
  const tokens: OffenseToken[] = []
  const subjects: User[] = []
  let charCount = 0
  el.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? ""
      if (text) {
        tokens.push({ type: "text", value: text })
        charCount += text.length
      }
    } else if (node instanceof HTMLElement && node.dataset.userId) {
      const user = JSON.parse(node.dataset.user!) as User
      tokens.push({ type: "mention", user_id: user.id })
      charCount += (node.textContent ?? "").length
      if (!subjects.find((s) => s.id === user.id)) subjects.push(user)
    }
  })
  // trim leading/trailing whitespace from first/last text tokens
  if (tokens.length > 0 && tokens[0].type === "text") {
    tokens[0] = { ...tokens[0], value: tokens[0].value!.trimStart() }
    if (!tokens[0].value) tokens.shift()
  }
  if (tokens.length > 0 && tokens[tokens.length - 1].type === "text") {
    tokens[tokens.length - 1] = { ...tokens[tokens.length - 1], value: tokens[tokens.length - 1].value!.trimEnd() }
    if (!tokens[tokens.length - 1].value) tokens.pop()
  }
  return { tokens, subjects, charCount }
}

export const BongInput = forwardRef<BongInputHandle, BongInputProps>(
  ({ users, onChange }, ref) => {
    const divRef = useRef<HTMLDivElement>(null)
    const [mention, setMention] = useState<ReturnType<typeof getActiveMention>>(null)
    const mentionRef = useRef<ReturnType<typeof getActiveMention>>(null)
    const [charCount, setCharCount] = useState(0)
    const MAX_CHARS = 300

    useImperativeHandle(ref, () => ({
      clear() {
        if (divRef.current) {
          divRef.current.innerHTML = ""
        }
        setMention(null)
        onChange([], [])
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
      const { tokens, subjects } = extractContent(divRef.current)
      onChange(tokens, subjects)
    }

    function handleInput() {
      if (!divRef.current) return
      const { tokens, subjects, charCount } = extractContent(divRef.current)
      setCharCount(charCount)
      const m = getActiveMention(divRef.current)
      mentionRef.current = m
      setMention(m)
      onChange(tokens, subjects)
    }

    function handleKeyPress(e: React.KeyboardEvent) {
      if (!divRef.current) return
      const { charCount } = extractContent(divRef.current)
      if (charCount >= MAX_CHARS) {
        e.preventDefault()
      }
    }

    function handlePaste(e: React.ClipboardEvent) {
      e.preventDefault()
      if (!divRef.current) return
      const { charCount } = extractContent(divRef.current)
      const pasted = e.clipboardData.getData("text/plain")
      const remaining = MAX_CHARS - charCount
      if (remaining <= 0) return
      const truncated = pasted.slice(0, remaining)
      document.execCommand("insertText", false, truncated)
    }

    function deletePillBeforeCursor(): boolean {
      if (!divRef.current) return false
      const sel = window.getSelection()
      if (!sel?.rangeCount) return false
      const range = sel.getRangeAt(0)
      if (!range.collapsed) return false
      const { startContainer, startOffset } = range
      let prev: Node | null = null
      if (startContainer === divRef.current) {
        prev = divRef.current.childNodes[startOffset - 1] ?? null
      } else if (startContainer.nodeType === Node.TEXT_NODE && startOffset === 0) {
        prev = startContainer.previousSibling
      }
      if (prev instanceof HTMLElement && prev.dataset.userId) {
        prev.remove()
        const { tokens, subjects } = extractContent(divRef.current)
        onChange(tokens, subjects)
        return true
      }
      return false
    }

    function handleBeforeInput(e: InputEvent) {
      if (e.inputType === "deleteContentBackward") {
        if (deletePillBeforeCursor()) e.preventDefault()
      }
      if (e.inputType === "insertText" && e.data === " " && mentionRef.current) {
        const currentMention = mentionRef.current
        const exact = users.find(
          (u) => u.display_name.toLowerCase() === currentMention.query.toLowerCase()
        )
        if (exact) {
          e.preventDefault()
          insertPill(exact)
        }
      }
    }

    function handleKeyDown(e: React.KeyboardEvent) {
      if ((e.key === "Tab" || e.key === "Enter") && suggestions.length > 0) {
        e.preventDefault()
        insertPill(suggestions[0])
        return
      }
      if (e.key === " " && mention) {
        const exact = users.find(
          (u) => u.display_name.toLowerCase() === mention.query.toLowerCase()
        )
        if (exact) {
          e.preventDefault()
          insertPill(exact)
          return
        }
      }
      if (e.key === "Escape") setMention(null)
      if (e.key === "Enter") e.preventDefault() // no newlines
      if (e.key === "Backspace") deletePillBeforeCursor()
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
          onBeforeInput={(e) => handleBeforeInput(e.nativeEvent as InputEvent)}
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
