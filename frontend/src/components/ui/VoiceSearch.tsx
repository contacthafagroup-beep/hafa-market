import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Mic, MicOff, Loader } from 'lucide-react'
import api from '@/lib/api'
import toast from 'react-hot-toast'

interface Props {
  onResult?: (text: string) => void
  className?: string
}

export default function VoiceSearch({ onResult, className }: Props) {
  const [listening, setListening] = useState(false)
  const [processing, setProcessing] = useState(false)
  const navigate = useNavigate()
  const recRef = useRef<any>(null)

  const startListening = async () => {
    // Try browser SpeechRecognition first (fast, no API call)
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (SR) {
      const rec = new SR()
      rec.lang = 'am-ET' // Amharic first
      rec.continuous = false
      rec.interimResults = false
      recRef.current = rec

      setListening(true)
      rec.onresult = (e: any) => {
        const text = e.results[0][0].transcript
        setListening(false)
        handleSearchText(text)
      }
      rec.onerror = () => {
        setListening(false)
        toast.error('Voice search failed. Try typing instead.')
      }
      rec.onend = () => setListening(false)
      rec.start()
      return
    }

    // Fallback: record audio and send to Groq Whisper
    if (!navigator.mediaDevices) {
      toast.error('Voice search not supported on this device')
      return
    }

    try {
      setListening(true)
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      const chunks: Blob[] = []

      recorder.ondataavailable = e => chunks.push(e.data)
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        setListening(false)
        setProcessing(true)
        try {
          const blob = new Blob(chunks, { type: 'audio/webm' })
          const fd = new FormData()
          fd.append('audio', blob, 'voice.webm')
          const res = await api.post('/ai/transcribe', fd, {
            headers: { 'Content-Type': 'multipart/form-data' },
          })
          const text = res.data.data?.text
          if (text) handleSearchText(text)
          else toast.error('Could not understand. Please try again.')
        } catch {
          toast.error('Voice processing failed')
        } finally { setProcessing(false) }
      }

      recorder.start()
      // Auto-stop after 5 seconds
      setTimeout(() => { if (recorder.state === 'recording') recorder.stop() }, 5000)
    } catch {
      setListening(false)
      toast.error('Microphone access denied')
    }
  }

  const stopListening = () => {
    recRef.current?.stop()
    setListening(false)
  }

  const handleSearchText = (text: string) => {
    toast.success(`🎤 "${text}"`, { duration: 2000 })
    if (onResult) {
      onResult(text)
    } else {
      navigate(`/products?search=${encodeURIComponent(text)}`)
    }
  }

  return (
    <button
      onClick={listening ? stopListening : startListening}
      disabled={processing}
      title={listening ? 'Stop listening' : 'Voice search (Amharic/English)'}
      className={`flex items-center justify-center transition-all ${className || 'w-10 h-10 rounded-full'} ${
        listening ? 'bg-red-500 text-white animate-pulse' :
        processing ? 'bg-gray-100 text-gray-400' :
        'bg-green-50 text-green-primary hover:bg-green-100'
      }`}>
      {processing ? <Loader size={18} className="animate-spin" /> :
       listening ? <MicOff size={18} /> : <Mic size={18} />}
    </button>
  )
}
