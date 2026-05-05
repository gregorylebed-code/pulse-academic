import { useRef, useState } from 'react'

interface Props {
  onTranscript: (text: string) => void
}

// SpeechRecognition works on Chrome and Safari (iOS 14.5+, macOS)
const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition

export default function MicButton({ onTranscript }: Props) {
  const [listening, setListening] = useState(false)
  const recRef = useRef<any>(null)

  if (!SpeechRecognition) return null

  function toggle() {
    if (listening) {
      recRef.current?.stop()
      setListening(false)
      return
    }
    const rec = new SpeechRecognition()
    rec.lang = 'en-US'
    rec.interimResults = false
    rec.maxAlternatives = 1
    rec.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript
      if (transcript) onTranscript(transcript)
    }
    rec.onend = () => setListening(false)
    rec.onerror = () => setListening(false)
    recRef.current = rec
    rec.start()
    setListening(true)
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="absolute bottom-3 right-3 w-8 h-8 rounded-full flex items-center justify-center transition-colors"
      style={{
        background: listening ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.07)',
        color: listening ? '#f87171' : '#5a5a6a',
      }}
      title={listening ? 'Stop recording' : 'Dictate note'}
    >
      {listening ? (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <rect x="6" y="6" width="12" height="12" rx="2" />
        </svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" />
        </svg>
      )}
    </button>
  )
}
