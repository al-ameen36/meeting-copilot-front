import { useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { MessageSquare } from 'lucide-react'

import { useWhisperStream } from '#/features/live-meeting/useWhisperStream'
import { useAuth } from '#/features/auth/AuthContext'
import { useNetwork } from '#/hooks/use-network'

import { TranscriptDisplay } from '#/features/transcript/TranscriptDisplay'
import {
  SourceSelector,
  StartButton,
  Header,
} from '#/features/_internal/aliases'
import { ChatPanel } from '#/features/chat/ChatPanel'
import { cn } from '#/lib/utils'

export default function LiveMeetingPage() {
  const navigate = useNavigate()
  const { active, segments, liveText, start, stop, meetingId } =
    useWhisperStream()

  const { user, isLoading } = useAuth()
  const { isOnline } = useNetwork()

  const [source, setSource] = useState<'mic' | 'tab'>('mic')
  const [disableRecBtn, setDisableRecBtn] = useState(false)
  const [isChatOpen, setIsChatOpen] = useState(false)

  useEffect(() => {
    return () => {
      if (active) stop()
    }
  }, [active, stop])

  useEffect(() => {
    if (!isLoading && !user) {
      navigate({ to: '/login' })
    }
  }, [user, isLoading, navigate])

  const toggleSession = async () => {
    setDisableRecBtn(true)

    if (active) {
      stop()
      setDisableRecBtn(false)
      return
    }

    start(source)
    setDisableRecBtn(false)
  }

  if (isLoading) {
    return <div className="min-h-screen bg-black" />
  }

  if (!user) {
    return null
  }

  return (
    <div className="size-full bg-gradient-to-br from-zinc-950 via-zinc-950 to-zinc-900 text-white overflow-auto relative">
      <div className="max-w-5xl mx-auto p-6 space-y-8 min-h-screen relative z-10 pt-30">
        <Header active={active} />

        {/* TRANSCRIPT */}
        <TranscriptDisplay
          segments={segments}
          liveText={liveText}
          isListening={active}
        />
        {/* Floating control bar */}
        <div className="fixed inset-x-0 bottom-4 flex justify-center items-center gap-2 z-20">
          <StartButton
            isRecording={active}
            onClick={toggleSession}
            disabled={!isOnline || disableRecBtn}
          />
          <SourceSelector selectedSource={source} onSourceChange={setSource} />
          <button
            onClick={() => setIsChatOpen(true)}
            className={cn(
              'w-9 h-9 rounded-full transition-all duration-300 shadow-lg flex justify-center items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium',
              meetingId ? 'opacity-100' : 'opacity-50 cursor-not-allowed',
            )}
            title="Chat with Meeting"
            disabled={!meetingId}
          >
            <MessageSquare className="w-4 h-4" />
          </button>
        </div>
      </div>

      {meetingId && (
        <ChatPanel
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
          meetingId={meetingId}
        />
      )}
    </div>
  )
}
