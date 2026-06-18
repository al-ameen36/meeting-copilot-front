import { useState, useRef, useEffect } from 'react'
import { getSegments } from '#/lib/localdb/transcriptStore'
import { X, Send, Bot, Loader2 } from 'lucide-react'
import ReactMarkdown from 'react-markdown'

interface ChatPanelProps {
  isOpen: boolean
  onClose: () => void
  meetingId: string
}

interface Message {
  role: 'user' | 'assistant'
  content: string
}

function AssistantMessage({ content }: { content: string }) {
  return (
    <div className="prose prose-invert prose-sm max-w-none">
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  )
}

export function ChatPanel({ isOpen, onClose, meetingId }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [query, setQuery] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Prevent background scrolling when panel is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim() || isStreaming) return

    const userMsg: Message = { role: 'user', content: query.trim() }
    const currentHistory = [...messages]

    setMessages([...currentHistory, userMsg])
    setQuery('')
    setIsStreaming(true)

    // Add empty assistant message that will be populated
    setMessages((prev) => [...prev, { role: 'assistant', content: '' }])

    try {
      // Retrieve segments and pick context using a simple heuristic:
      // 1) take last 30 segments
      // 2) find keyword matches within the full history
      // 3) merge keyword matches first, then last30, dedupe by id, cap at 50
      let contextChunks: Array<{ id: string; start: number; text: string }> = []
      try {
        const segs = meetingId ? await getSegments(meetingId) : []
        const last30 = segs.slice(-30)
        const q = userMsg.content.trim().toLowerCase()
        const keywordMatches = q
          ? segs.filter((s) => s.text && s.text.toLowerCase().includes(q))
          : []

        const combined = [...keywordMatches, ...last30]
        const seen = new Set<string>()
        const deduped: Array<{ id: string; start: number; text: string }> = []
        for (const s of combined) {
          if (seen.has(s.id)) continue
          seen.add(s.id)
          deduped.push({ id: s.id, start: s.start, text: s.text })
          if (deduped.length >= 50) break
        }

        contextChunks = deduped
      } catch (err) {
        console.warn('Failed to load local segments for chat context', err)
      }

      const response = await fetch(`/api/meetings/${meetingId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: userMsg.content,
          history: currentHistory,
          context_chunks: contextChunks,
        }),
      })

      if (!response.ok) {
        throw new Error('Network response was not ok')
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (reader) {
        let assistantContent = ''
        for (;;) {
          const chunk = await reader.read()
          if (chunk.done) break

          assistantContent += decoder.decode(chunk.value, { stream: true })

          // Update the last message
          setMessages((prev) => {
            const updated = [...prev]
            updated[updated.length - 1] = {
              role: 'assistant',
              content: assistantContent,
            }
            return updated
          })
        }
      }
    } catch (error) {
      console.error('Chat error:', error)
      setMessages((prev) => {
        const updated = [...prev]
        updated[updated.length - 1] = {
          role: 'assistant',
          content:
            'Sorry, I encountered an error while processing your request.',
        }
        return updated
      })
    } finally {
      setIsStreaming(false)
    }
  }

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Slide-over panel */}
      <div
        className={`fixed top-0 right-0 h-full sm:w-[400px] bg-zinc-950 border-l border-zinc-800 z-50 transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <h2 className="text-lg font-semibold text-white">
            Chat with Meeting
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Messages */}
        <div className="h-[calc(100vh-150px)] p-4 space-y-6 scrollbar-thin scrollbar-thumb-zinc-800">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-3 opacity-50">
              <Bot className="w-12 h-12 text-zinc-500" />
              <p className="text-sm text-zinc-400">
                Ask questions about the meeting transcript.
              </p>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4 text-zinc-300" />
                  </div>
                )}

                <div
                  className={`px-4 py-2.5 rounded-2xl max-w-[85%] text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white rounded-tr-sm'
                      : 'bg-zinc-800 text-zinc-200 rounded-tl-sm'
                  }`}
                >
                  {msg.content ? (
                    msg.role === 'assistant' ? (
                      <AssistantMessage content={msg.content} />
                    ) : (
                      msg.content
                    )
                  ) : isStreaming && idx === messages.length - 1 ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    ''
                  )}
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Form */}
        <div className="p-4 bg-zinc-950">
          <form onSubmit={handleSubmit} className="relative flex items-center">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask a question..."
              disabled={isStreaming}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-full pl-4 pr-12 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!query.trim() || isStreaming}
              className="absolute right-2 p-2 text-white bg-blue-600 hover:bg-blue-500 rounded-full disabled:opacity-50 disabled:bg-zinc-700 disabled:text-zinc-500 transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </>
  )
}
