/// <reference types="node" />

import type { ChatMessage, ChatRequestBody } from './chat.types'

export const jsonResponse = (body: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  })

export const getBackendBaseUrl = () => {
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

export const parseChatBody = (value: unknown): ChatRequestBody | null => {
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

  return {
    query: maybeBody.query.trim(),
    history: maybeBody.history,
  }
}
