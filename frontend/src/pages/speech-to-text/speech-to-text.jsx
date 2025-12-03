import { useState, useRef, useEffect } from 'react'
import './speech-to-text.css'

function SpeechToText() {
  const [isRecording, setIsRecording] = useState(false)
  const [transcribedText, setTranscribedText] = useState('')
  const [selectedLanguage, setSelectedLanguage] = useState('auto')
  const [isProcessing, setIsProcessing] = useState(false)
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const intervalRef = useRef(null)

  const languageOptions = [
    { value: 'auto', label: 'Auto Detect' },
    { value: 'ko', label: 'Korean' },
    { value: 'en-CA', label: 'English (Canada)' },
    { value: 'en-US', label: 'English (US)' },
    { value: 'en-GB', label: 'English (UK)' },
    { value: 'en-IN', label: 'English (India)' },
    { value: 'zh', label: 'Chinese (Simplified)' },
  ]

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
          processAudioChunk(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach(track => track.stop())
        saveToFile()
      }

      mediaRecorder.start(1000) // 1초마다 데이터 수집
      setIsRecording(true)

      // 주기적으로 텍스트 파일 업데이트
      intervalRef.current = setInterval(() => {
        saveToFile()
      }, 5000) // 5초마다 저장

    } catch (error) {
      console.error('Microphone access error:', error)
      alert('Microphone access permission is required.')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
      saveToFile()
    }
  }

  const processAudioChunk = async (audioBlob) => {
    setIsProcessing(true)
    try {
      const formData = new FormData()
      formData.append('audio', audioBlob, 'audio.webm')
      formData.append('language', selectedLanguage)

      // Whisper 로컬 서버로 전송
      const apiUrl = import.meta.env.VITE_API_URL || '/api/whisper/transcribe'
      const response = await fetch(apiUrl, {
        method: 'POST',
        body: formData,
      })

      if (response.ok) {
        const data = await response.json()
        if (data.text) {
          setTranscribedText(prev => {
            const newText = prev ? `${prev} ${data.text}` : data.text
            return newText
          })
        }
      } else {
        console.error('Whisper API 오류:', response.statusText)
      }
    } catch (error) {
      console.error('음성 인식 오류:', error)
      // Mock data for development
      setTranscribedText(prev => prev + ' [음성 인식 텍스트] ')
    } finally {
      setIsProcessing(false)
    }
  }

  const saveToFile = () => {
    if (transcribedText) {
      const blob = new Blob([transcribedText], { type: 'text/plain;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `transcription_${new Date().toISOString().slice(0, 10)}.txt`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }
  }

  const handleToggle = () => {
    if (isRecording) {
      stopRecording()
    } else {
      startRecording()
    }
  }

  const handleClear = () => {
    setTranscribedText('')
    audioChunksRef.current = []
  }

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
      if (mediaRecorderRef.current && isRecording) {
        mediaRecorderRef.current.stop()
      }
    }
  }, [isRecording])

  return (
    <div className="speech-to-text">
      <div className="speech-to-text-container">
        <h1 className="page-title">Speech to Text</h1>
        <p className="page-subtitle">Convert speech to text in real-time</p>

        <div className="control-panel">
          <div className="language-select-wrapper">
            <label htmlFor="language-select">Language:</label>
            <select
              id="language-select"
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              className="language-select"
              disabled={isRecording}
            >
              {languageOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="button-group">
            <button
              onClick={handleToggle}
              className={`record-btn ${isRecording ? 'recording' : ''}`}
              disabled={isProcessing}
            >
              {isRecording ? '⏹ Stop' : '▶ Start'}
            </button>
            <button
              onClick={handleClear}
              className="clear-btn"
              disabled={isRecording || !transcribedText}
            >
              Clear
            </button>
          </div>
        </div>

        <div className="status-indicator">
          {isRecording && (
            <div className="recording-indicator">
              <span className="pulse-dot"></span>
              Recording...
            </div>
          )}
          {isProcessing && (
            <div className="processing-indicator">Processing...</div>
          )}
        </div>

        <div className="text-output">
          <textarea
            value={transcribedText}
            readOnly
            placeholder="Start recording and text will appear here in real-time..."
            className="output-textarea"
            rows={15}
          />
          {transcribedText && (
            <div className="text-info">
              Characters: {transcribedText.length} | Words: {transcribedText.split(/\s+/).filter(w => w).length}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default SpeechToText

