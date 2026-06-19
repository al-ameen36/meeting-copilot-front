import { createFileRoute } from '@tanstack/react-router'
import { VideoWithTranscript } from '#/features/playback/VideoWithTranscript'

export const Route = createFileRoute('/playback')({
  component: () => (
    <div className="min-h-screen bg-zinc-900 text-zinc-50">
      <VideoWithTranscript />
    </div>
  ),
})
