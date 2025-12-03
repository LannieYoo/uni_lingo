import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Layout from './components/layout/layout'
import Home from './pages/home/home'
import Dictionary from './pages/dictionary/dictionary'
import TextToSpeech from './pages/text-to-speech/text-to-speech'
import SpeechToText from './pages/speech-to-text/speech-to-text'
import SpeechToRecording from './pages/speech-to-recording/speech-to-recording'
import Translator from './pages/translator/translator'
import Logs from './pages/logs/logs'

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/dictionary" element={<Dictionary />} />
          <Route path="/text-to-speech" element={<TextToSpeech />} />
          <Route path="/speech-to-text" element={<SpeechToText />} />
          <Route path="/speech-to-recording" element={<SpeechToRecording />} />
          <Route path="/translator" element={<Translator />} />
          <Route path="/logs" element={<Logs />} />
        </Routes>
      </Layout>
    </Router>
  )
}

export default App

