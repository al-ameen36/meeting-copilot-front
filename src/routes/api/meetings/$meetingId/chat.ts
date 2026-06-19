/// <reference types="node" />

import { createFileRoute } from '@tanstack/react-router'

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

type ContextChunk = {
  id: string
  start: number
  text: string
}

type ChatRequestBody = {
  query: string
  history: Array<ChatMessage>
  context_chunks?: ContextChunk[]
}

const jsonResponse = (body: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  })

const getBackendBaseUrl = () => {
  const explicitUrl =
    process.env.MEETING_COPILOT_API_URL ??
    process.env.VITE_MEETING_COPILOT_API_URL ??
    process.env.VITE_API_URL

  if (explicitUrl) {
    return explicitUrl.replace(/\/$/, '')
  }

  const whisperUrl = process.env.VITE_WHISPER_SERVER_URL
  if (whisperUrl) {
    try {
      const url = new URL(whisperUrl)
      url.protocol = url.protocol === 'wss:' ? 'https:' : 'http:'
      url.pathname = ''
      url.search = ''
      url.hash = ''
      return url.toString().replace(/\/$/, '')
    } catch {
      return 'http://localhost:8000'
    }
  }

  return 'http://localhost:8000'
}

const isChatMessage = (value: unknown): value is ChatMessage => {
  if (!value || typeof value !== 'object') return false

  const maybeMessage = value as Partial<ChatMessage>
  return (
    (maybeMessage.role === 'user' || maybeMessage.role === 'assistant') &&
    typeof maybeMessage.content === 'string'
  )
}

const parseChatBody = (value: unknown): ChatRequestBody | null => {
  if (!value || typeof value !== 'object') return null

  const maybeBody = value as Partial<ChatRequestBody>
  if (typeof maybeBody.query !== 'string' || !maybeBody.query.trim()) {
    return null
  }

  if (!Array.isArray(maybeBody.history)) {
    return null
  }

  if (!maybeBody.history.every(isChatMessage)) {
    return null
  }

  // optional context_chunks validation
  const maybeChunks = maybeBody.context_chunks
  if (maybeChunks !== undefined) {
    if (!Array.isArray(maybeChunks)) return null
    for (const c of maybeChunks) {
      if (typeof c !== 'object') return null
      if (typeof c.id !== 'string') return null
      if (typeof c.start !== 'number') return null
      if (typeof c.text !== 'string') return null
    }
  }

  return {
    query: maybeBody.query.trim(),
    history: maybeBody.history,
    context_chunks: maybeChunks,
  }
}

export const Route = createFileRoute('/api/meetings/$meetingId/chat')({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const body = parseChatBody(await request.json().catch(() => null))

        if (!body) {
          return jsonResponse(
            { error: 'Invalid chat request.' },
            { status: 400 },
          )
        }

        const backendUrl = `${getBackendBaseUrl()}/meetings/${encodeURIComponent(
          params.meetingId,
        )}/chat`

        const upstreamResponse = await fetch(backendUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        })

        if (!upstreamResponse.ok) {
          return jsonResponse(
            { error: 'The meeting chat backend returned an error.' },
            { status: upstreamResponse.status },
          )
        }

        return new Response(upstreamResponse.body, {
          status: upstreamResponse.status,
          headers: {
            'Content-Type':
              upstreamResponse.headers.get('Content-Type') ?? 'text/plain',
            'Cache-Control': 'no-store',
          },
        })
      },
    },
  },
})
