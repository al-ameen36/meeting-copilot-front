import { useNavigate, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { LogOut, History, MessageSquare } from 'lucide-react'

import { useWhisperStream } from '#/features/live-meeting/useWhisperStream'
import { supabase } from '#/lib/supabase'
import { useAuth } from '#/features/auth/AuthContext'
import { useNetwork } from '#/hooks/use-network'

import { TranscriptDisplay } from '#/features/transcript/TranscriptDisplay'
import { SourceSelector } from '#/components/SourceSelector'
import { StartButton } from '#/components/StartButton'
import { ChatPanel } from '#/features/chat/ChatPanel'

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
        {/* HEADER */}
        <div className="fixed bg-zinc-900/60 backdrop-blur-sm z-1 top-0 left-0 right-0 px-6 pt-6 pb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div
                className={`w-2.5 h-2.5 rounded-full ${
                  active ? 'bg-green-400' : 'bg-zinc-600'
                }`}
              />
              {active && (
                <div className="absolute inset-0 rounded-full bg-green-400 animate-ping" />
              )}
            </div>

            <span className="text-sm text-zinc-400 uppercase tracking-wider font-semibold">
              {active ? 'LIVE' : 'IDLE'}
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <StartButton
                isRecording={active}
                onClick={toggleSession}
                disabled={!isOnline || disableRecBtn}
              />
              <SourceSelector
                selectedSource={source}
                onSourceChange={setSource}
              />
            </div>

            <div className="flex items-center gap-2">
              {meetingId && (
                <button
                  onClick={() => setIsChatOpen(true)}
                  className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-md transition-colors text-sm font-medium"
                  title="Chat with Meeting"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span className="hidden sm:inline">Chat</span>
                </button>
              )}

              <Link
                to="/meetings"
                className="p-2 ml-2 text-zinc-500 hover:text-white bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 rounded-md transition-all duration-200"
                title="Past Meetings"
              >
                <History className="w-6 h-6" />
              </Link>

              <button
                onClick={async () => {
                  await supabase.auth.signOut()
                  navigate({ to: '/login' })
                }}
                className="p-2 text-zinc-500 hover:text-white bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 rounded-md transition-all duration-200"
                title="Sign Out"
              >
                <LogOut className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>

        {/* TRANSCRIPT */}
        <TranscriptDisplay
          segments={segments}
          liveText={liveText}
          isListening={active}
        />
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
