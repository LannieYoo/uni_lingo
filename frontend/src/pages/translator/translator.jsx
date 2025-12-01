import { useState, useEffect, useRef } from 'react'
import './translator.css'

function Translator() {
  const [inputText, setInputText] = useState('')
  const [outputText, setOutputText] = useState('')
  const [sourceLang, setSourceLang] = useState('en-CA')
  const [targetLang, setTargetLang] = useState('ko')
  const [isTranslating, setIsTranslating] = useState(false)
  const translateTimeoutRef = useRef(null)
  const abortControllerRef = useRef(null)
  const isManualLangChangeRef = useRef(false)

  const sourceLanguages = [
    { code: 'en-CA', name: 'English (Canada)' },
    { code: 'en-US', name: 'English (US)' },
    { code: 'en-IN', name: 'English (India)' },
    { code: 'en-GB', name: 'English (UK)' },
    { code: 'zh', name: 'Chinese (Simplified)' },
    { code: 'ko', name: 'Korean' },
  ]

  const targetLanguages = [
    { code: 'ko', name: 'Korean' },
    { code: 'en-CA', name: 'English (Canada)' },
    { code: 'en-US', name: 'English (US)' },
    { code: 'en-IN', name: 'English (India)' },
    { code: 'en-GB', name: 'English (UK)' },
    { code: 'zh', name: 'Chinese (Simplified)' },
  ]

  // 언어 탐지 함수
  const detectLanguage = (text) => {
    if (!text.trim()) return null
    
    const trimmedText = text.trim()
    
    // 각 언어의 문자 개수 계산 (정규식 매칭 사용)
    const koreanMatches = trimmedText.match(/[\uAC00-\uD7A3\u1100-\u11FF\u3130-\u318F]/g)
    const chineseMatches = trimmedText.match(/[\u4E00-\u9FFF]/g)
    const englishMatches = trimmedText.match(/[A-Za-z]/g)
    
    const koreanCount = koreanMatches ? koreanMatches.length : 0
    const chineseCount = chineseMatches ? chineseMatches.length : 0
    const englishCount = englishMatches ? englishMatches.length : 0
    
    // 우선순위: 한글 > 중국어 > 영어
    if (koreanCount > 0) return 'ko'
    if (chineseCount > 0) return 'zh'
    if (englishCount > 0) return 'en'
    
    return null
  }

  // 입력 텍스트 변경 시 언어 자동 탐지 및 select 박스 자동 변경
  useEffect(() => {
    // 수동 변경 플래그가 설정되어 있으면 자동 변경 스킵하고 플래그 리셋
    if (isManualLangChangeRef.current) {
      isManualLangChangeRef.current = false
      return
    }
    
    if (!inputText || !inputText.trim()) {
      return
    }
    
    const detectedLang = detectLanguage(inputText)
    
    if (!detectedLang) {
      return
    }
    
    // 언어에 따라 select box 자동 변경 (함수형 업데이트로 무한 루프 방지)
    if (detectedLang === 'ko') {
      // 한글 입력 → sourceLang을 'ko'로, targetLang을 영어로
      setSourceLang(prev => {
        if (prev !== 'ko') return 'ko'
        return prev
      })
      setTargetLang(prev => {
        const isEnglish = prev === 'en-CA' || prev === 'en-US' || prev === 'en-GB' || prev === 'en-IN'
        if (!isEnglish) return 'en-CA'
        return prev
      })
    } else if (detectedLang === 'en') {
      // 영어 입력 → sourceLang을 영어로, targetLang을 'ko'로
      setSourceLang(prev => {
        const isEnglish = prev === 'en-CA' || prev === 'en-US' || prev === 'en-GB' || prev === 'en-IN'
        if (!isEnglish) return 'en-CA'
        return prev
      })
      setTargetLang(prev => {
        if (prev !== 'ko') return 'ko'
        return prev
      })
    } else if (detectedLang === 'zh') {
      // 중국어 입력 → sourceLang을 'zh'로, targetLang을 영어로
      setSourceLang(prev => {
        if (prev !== 'zh') return 'zh'
        return prev
      })
      setTargetLang(prev => {
        const isEnglish = prev === 'en-CA' || prev === 'en-US' || prev === 'en-GB' || prev === 'en-IN'
        if (!isEnglish) return 'en-CA'
        return prev
      })
    }
  }, [inputText])

  const handleTranslate = async (text = inputText) => {
    if (!text.trim()) {
      setOutputText('')
      return
    }

    // 이전 요청 취소
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    abortControllerRef.current = new AbortController()

    setIsTranslating(true)
    try {
      // Language code mapping for MyMemory API
      const langMap = {
        'ko': 'ko',
        'en-CA': 'en',
        'en-US': 'en',
        'en-GB': 'en',
        'en-IN': 'en',
        'zh': 'zh'
      }
      
      const sourceCode = langMap[sourceLang] || 'en'
      const targetCode = langMap[targetLang] || 'ko'
      
      if (sourceCode === targetCode) {
        setOutputText(text)
        setIsTranslating(false)
        return
      }
      
      // Use multiple translation APIs with fallback (same as dictionary.jsx)
      let translatedText = ''
      const timeout = 5000
      
      // 1. 직접 Google Translate API 시도 (가장 안정적)
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), timeout)
        const googleUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceCode}&tl=${targetCode}&dt=t&q=${encodeURIComponent(text)}`
        const response = await fetch(googleUrl, { signal: controller.signal })
        clearTimeout(timeoutId)
        if (response.ok && !abortControllerRef.current.signal.aborted) {
          const googleData = await response.json()
          if (googleData?.[0] && Array.isArray(googleData[0])) {
            const translated = googleData[0]
              .filter(item => item && Array.isArray(item) && item[0] && typeof item[0] === 'string')
              .map(item => item[0])
              .join('')
              .trim()
            if (translated && translated.length > 0 && translated !== text) {
              translatedText = translated
            }
          }
        }
      } catch (e) { 
        if (e.name !== 'AbortError') {
          console.error('Google Translate direct error:', e)
        }
      }
      
      // 2. MyMemory API 시도
      if (!translatedText && !abortControllerRef.current.signal.aborted) {
        try {
          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), timeout)
          const myMemoryUrl = 'https://api.mymemory.translated.net/get?q=' + encodeURIComponent(text) + '&langpair=' + sourceCode + '|' + targetCode
          const response = await fetch(myMemoryUrl, { signal: controller.signal })
          clearTimeout(timeoutId)
          if (response.ok && !abortControllerRef.current.signal.aborted) {
            const data = await response.json()
            if (data.responseStatus === 200 && data.responseData?.translatedText) {
              let translated = data.responseData.translatedText
              translated = translated.replace(/^t\d+\//, '').replace(/<[^>]*>/g, '').trim()
              if (translated && translated !== text && translated.toUpperCase() !== text.toUpperCase()) {
                translatedText = translated
              }
            }
          }
        } catch (e) { 
          if (e.name !== 'AbortError') {
            console.error('MyMemory error:', e)
          }
        }
      }
      
      // 3. Proxy를 통한 Google Translate 시도
      if (!translatedText && !abortControllerRef.current.signal.aborted) {
        try {
          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), timeout)
          const googleUrl = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=' + sourceCode + '&tl=' + targetCode + '&dt=t&q=' + encodeURIComponent(text)
          const proxyUrl = 'https://api.allorigins.win/get?url=' + encodeURIComponent(googleUrl)
          const response = await fetch(proxyUrl, { method: 'GET', headers: { Accept: 'application/json' }, signal: controller.signal })
          clearTimeout(timeoutId)
          if (response.ok && !abortControllerRef.current.signal.aborted) {
            const proxyData = await response.json()
            if (proxyData?.contents) {
              const googleData = JSON.parse(proxyData.contents)
              if (googleData?.[0] && Array.isArray(googleData[0])) {
                const translated = googleData[0]
                  .filter(item => item && Array.isArray(item) && item[0] && typeof item[0] === 'string')
                  .map(item => item[0])
                  .join('')
                  .trim()
                if (translated && translated.length > 0 && translated !== text) {
                  translatedText = translated
                }
              }
            }
          }
        } catch (e) { 
          if (e.name !== 'AbortError') {
            console.error('Google Translate proxy error:', e)
          }
        }
      }
      
      if (!abortControllerRef.current.signal.aborted) {
        if (translatedText) {
          setOutputText(translatedText)
        } else {
          setOutputText('Translation failed. Please try again.')
        }
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Translation error:', error)
        if (!abortControllerRef.current.signal.aborted) {
          setOutputText('An error occurred during translation. Please try again.')
        }
      }
    } finally {
      if (!abortControllerRef.current.signal.aborted) {
        setIsTranslating(false)
      }
    }
  }

  // 실시간 자동 번역 (debounce 적용)
  useEffect(() => {
    // 이전 타이머 취소
    if (translateTimeoutRef.current) {
      clearTimeout(translateTimeoutRef.current)
    }

    if (!inputText.trim()) {
      setOutputText('')
      return
    }

    // 500ms 후에 자동 번역 실행 (debounce)
    translateTimeoutRef.current = setTimeout(() => {
      handleTranslate(inputText)
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, 500)

    // cleanup 함수
    return () => {
      if (translateTimeoutRef.current) {
        clearTimeout(translateTimeoutRef.current)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputText, sourceLang, targetLang])

  return (
    <div className="translator">
      <div className="translator-container">
        <h1 className="page-title">Translator</h1>
        <p className="page-subtitle">Translate between various English dialects, Chinese (Simplified), and Korean</p>

        <div className="translator-box">
          <div className="language-selectors">
            <div className="lang-select-group">
              <label>Source Language</label>
              <select
                value={sourceLang}
                onChange={(e) => {
                  isManualLangChangeRef.current = true
                  setSourceLang(e.target.value)
                }}
                className="lang-select"
              >
                {sourceLanguages.map(lang => (
                  <option key={lang.code} value={lang.code}>{lang.name}</option>
                ))}
              </select>
            </div>
            <div className="arrow">→</div>
            <div className="lang-select-group">
              <label>Target Language</label>
              <select
                value={targetLang}
                onChange={(e) => {
                  isManualLangChangeRef.current = true
                  setTargetLang(e.target.value)
                }}
                className="lang-select"
              >
                {targetLanguages.map(lang => (
                  <option key={lang.code} value={lang.code}>{lang.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="input-section">
            <textarea
              value={inputText}
              onChange={(e) => {
                const newValue = e.target.value
                setInputText(newValue)
                
                // 즉시 언어 감지 및 select box 변경
                if (newValue && newValue.trim()) {
                  const detected = detectLanguage(newValue)
                  if (detected === 'ko') {
                    setSourceLang('ko')
                    setTargetLang('en-CA')
                  } else if (detected === 'en') {
                    setSourceLang('en-CA')
                    setTargetLang('ko')
                  } else if (detected === 'zh') {
                    setSourceLang('zh')
                    setTargetLang('en-CA')
                  }
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.ctrlKey && !e.shiftKey) {
                  e.preventDefault()
                  // 엔터 키는 자동 번역이 이미 실행되므로 별도 처리 불필요
                  // 필요시 수동으로 번역 버튼 클릭 가능
                }
              }}
              placeholder="Enter text to translate... (Auto-translates as you type)"
              className="input-textarea"
              rows={8}
            />
          </div>

          <button
            onClick={handleTranslate}
            disabled={isTranslating || !inputText.trim()}
            className="translate-btn"
          >
            {isTranslating ? 'Translating...' : 'Translate'}
          </button>

          <div className="output-section">
            <textarea
              value={outputText}
              readOnly
              placeholder="Translation result will appear here..."
              className="output-textarea"
              rows={8}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default Translator

