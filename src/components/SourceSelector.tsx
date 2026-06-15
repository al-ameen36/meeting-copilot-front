import { motion } from 'motion/react'
import { Mic, MonitorPlay } from 'lucide-react'

interface SourceSelectorProps {
  selectedSource: 'mic' | 'tab'
  onSourceChange: (source: 'mic' | 'tab') => void
}

export function SourceSelector({
  selectedSource,
  onSourceChange,
}: SourceSelectorProps) {
  const sources = [
    { id: 'mic' as const, label: 'Mic', icon: Mic },
    { id: 'tab' as const, label: 'Tab / Screen', icon: MonitorPlay },
  ]

  return (
    <div className="flex gap-2 p-1 bg-zinc-900 backdrop-blur-xl rounded-md border border-zinc-600/50">
      {sources.map((source) => {
        const Icon = source.icon
        const isActive = selectedSource === source.id

        return (
          <button
            key={source.id}
            onClick={() => onSourceChange(source.id)}
            className="relative px-4 py-2 rounded-md text-sm font-medium transition-all duration-200"
          >
            {isActive && (
              <motion.div
                layoutId="activeSource"
                className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 rounded-md border border-cyan-500/30"
                transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
              />
            )}
            <div className="relative flex items-center gap-2">
              <Icon
                className={`w-4 h-4 ${isActive ? 'text-cyan-400' : 'text-zinc-500'}`}
              />
              <span className={isActive ? 'text-white' : 'text-zinc-400'}>
                {source.label}
              </span>
            </div>
          </button>
        )
      })}
    </div>
  )
}
