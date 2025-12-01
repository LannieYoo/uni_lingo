import { useState, useEffect, useRef } from 'react'
import './home.css'

function Home() {
  const [inputText, setInputText] = useState('')
  const [outputText, setOutputText] = useState('')
  const [sourceLang, setSourceLang] = useState('ko')
  const [targetLang, setTargetLang] = useState('en')
  const [isTranslating, setIsTranslating] = useState(false)
  const [grammarErrors, setGrammarErrors] = useState([])
  const [isCheckingGrammar, setIsCheckingGrammar] = useState(false)
  const translateTimeoutRef = useRef(null)
  const grammarTimeoutRef = useRef(null)

  const languages = [
    { code: 'ko', name: 'Korean' },
    { code: 'en', name: 'English' },
    { code: 'zh', name: 'Chinese (Simplified)' },
  ]

  // 영어 문법/철자 검사 함수
  const checkGrammar = async (text) => {
    if (!text || !text.trim()) {
      setGrammarErrors([])
      return
    }
    
    // 영어가 아니면 검사하지 않음
    const englishMatches = text.match(/[A-Za-z]/g)
    if (!englishMatches || englishMatches.length < 3) {
      setGrammarErrors([])
      return
    }
    
    setIsCheckingGrammar(true)
    
    try {
      // LanguageTool API 사용
      const response = await fetch('https://api.languagetool.org/v2/check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          text: text,
          language: 'en-US',
        }),
      })
      
      if (response.ok) {
        const data = await response.json()
        console.log('Grammar check response:', data)
        if (data.matches && data.matches.length > 0) {
          const errors = data.matches.map(match => ({
            message: match.message,
            context: match.context?.text || '',
            offset: match.offset,
            length: match.length,
            replacements: match.replacements ? match.replacements.slice(0, 3).map(r => r.value) : [],
            ruleId: match.rule?.id || '',
            category: match.rule?.category?.name || '',
          }))
          console.log('Grammar errors found:', errors)
          setGrammarErrors(errors)
        } else {
          console.log('No grammar errors found')
          setGrammarErrors([])
        }
      } else {
        console.log('Grammar API response not ok:', response.status)
      }
    } catch (error) {
      console.error('Grammar check error:', error)
      setGrammarErrors([])
    } finally {
      setIsCheckingGrammar(false)
    }
  }

  // 언어 탐지 함수
  const detectLanguage = (text) => {
    if (!text || !text.trim()) return null
    
    const trimmedText = text.trim()
    
    // 각 언어의 문자 개수 계산
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

  const handleTranslate = async () => {
    if (!inputText.trim()) {
      return
    }

    setIsTranslating(true)
    
    try {
      const sourceCode = sourceLang
      const targetCode = targetLang
      
      if (sourceLang === targetLang) {
        setOutputText(inputText)
        setIsTranslating(false)
        return
      }
      
      let translatedText = ''
      const timeout = 3000 // 3초 타임아웃
      
      // 1. 직접 Google Translate API 시도 (가장 빠름)
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), timeout)
        const googleUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceCode}&tl=${targetCode}&dt=t&q=${encodeURIComponent(inputText)}`
        const response = await fetch(googleUrl, { signal: controller.signal })
        clearTimeout(timeoutId)
        
        if (response.ok) {
          const googleData = await response.json()
          if (googleData?.[0] && Array.isArray(googleData[0])) {
            translatedText = googleData[0]
              .filter(item => item && Array.isArray(item) && item[0] && typeof item[0] === 'string')
              .map(item => item[0])
              .join('')
              .trim()
          }
        }
      } catch (e) {
        console.log('Direct Google Translate failed')
      }
      
      // 2. MyMemory API 시도 (빠른 fallback)
      if (!translatedText) {
        try {
          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), timeout)
          const response = await fetch(
            `https://api.mymemory.translated.net/get?q=${encodeURIComponent(inputText)}&langpair=${sourceCode}|${targetCode}`,
            { signal: controller.signal }
          )
          clearTimeout(timeoutId)
          
          if (response.ok) {
            const data = await response.json()
            if (data.responseStatus === 200 && data.responseData?.translatedText) {
              translatedText = data.responseData.translatedText
                .replace(/^t\d+\//, '')
                .replace(/<[^>]*>/g, '')
                .trim()
            }
          }
        } catch (e) {
          console.log('MyMemory failed')
        }
      }
      
      if (translatedText) {
        setOutputText(translatedText)
      } else {
        setOutputText('Translation failed. Please try again.')
      }
    } catch (error) {
      console.error('Translation error:', error)
      setOutputText('Translation failed. Please try again.')
    } finally {
      setIsTranslating(false)
    }
  }

  const handleSwap = () => {
    setSourceLang(targetLang)
    setTargetLang(sourceLang)
    setInputText(outputText)
    setOutputText(inputText)
  }

  // 이전 언어 값을 저장
  const prevSourceLangRef = useRef(sourceLang)
  const prevTargetLangRef = useRef(targetLang)

  // source와 target이 같아지면 target을 자동으로 변경
  useEffect(() => {
    if (sourceLang === targetLang) {
      const otherLang = languages.find(l => l.code !== sourceLang)
      if (otherLang) setTargetLang(otherLang.code)
    }
  }, [sourceLang, targetLang])

  // inputText 변경 시 자동 번역 및 문법 검사
  useEffect(() => {
    // 실시간 자동 번역 (debounce)
    if (translateTimeoutRef.current) {
      clearTimeout(translateTimeoutRef.current)
    }
    if (inputText && inputText.trim()) {
      translateTimeoutRef.current = setTimeout(() => {
        handleTranslate()
      }, 500)
    } else {
      setOutputText('')
    }

    // 영어 입력 시 문법/철자 검사 (debounce)
    if (grammarTimeoutRef.current) {
      clearTimeout(grammarTimeoutRef.current)
    }
    const detectedLang = detectLanguage(inputText)
    if (detectedLang === 'en' && inputText && inputText.trim()) {
      grammarTimeoutRef.current = setTimeout(() => {
        checkGrammar(inputText)
      }, 800)
    } else {
      setGrammarErrors([])
    }

    return () => {
      if (translateTimeoutRef.current) clearTimeout(translateTimeoutRef.current)
      if (grammarTimeoutRef.current) clearTimeout(grammarTimeoutRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputText])

  // 언어 변경 시 입력/출력 텍스트 자동 교체 및 번역
  useEffect(() => {
    // 초기 로드 시에는 실행하지 않음
    if (!inputText.trim() && !outputText.trim()) {
      prevSourceLangRef.current = sourceLang
      prevTargetLangRef.current = targetLang
      return
    }

    // 언어가 실제로 변경되었는지 확인
    const sourceLangChanged = prevSourceLangRef.current !== sourceLang
    const targetLangChanged = prevTargetLangRef.current !== targetLang

    if (!sourceLangChanged && !targetLangChanged) {
      return
    }

    // 언어가 변경되었을 때만 실행
    const timeoutId = setTimeout(async () => {
      if (isTranslating) return

      if (sourceLangChanged && inputText.trim()) {
        // 입력 언어가 변경된 경우: 
        // 1. 현재 입력 텍스트를 이전 입력 언어에서 새 입력 언어로 번역하여 입력 필드에 표시
        // 2. 그 결과를 새 출력 언어로 번역하여 출력 필드에 표시
        setIsTranslating(true)
        try {
          const langMap = {
            'ko': 'ko',
            'en': 'en',
            'zh': 'zh'
          }
          
          const prevSourceCode = langMap[prevSourceLangRef.current] || prevSourceLangRef.current
          const newSourceCode = langMap[sourceLang] || sourceLang
          const targetCode = langMap[targetLang] || targetLang
          
          // Step 1: 현재 입력 텍스트를 이전 입력 언어에서 새 입력 언어로 번역
          let translatedInput = inputText
          
          if (prevSourceCode !== newSourceCode) {
            // Try Google Translate via CORS proxy
            try {
              const googleUrl1 = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${prevSourceCode}&tl=${newSourceCode}&dt=t&q=${encodeURIComponent(inputText)}`
              const proxyUrl1 = `https://api.allorigins.win/get?url=${encodeURIComponent(googleUrl1)}`
              
              const googleResponse1 = await fetch(proxyUrl1)
              
              if (googleResponse1.ok) {
                const proxyData1 = await googleResponse1.json()
                if (proxyData1 && proxyData1.contents) {
                  try {
                    const googleData1 = JSON.parse(proxyData1.contents)
                    if (googleData1 && Array.isArray(googleData1) && googleData1[0] && Array.isArray(googleData1[0])) {
                      translatedInput = googleData1[0]
                        .filter((item) => item && Array.isArray(item) && item[0] && typeof item[0] === 'string')
                        .map((item) => item[0])
                        .join('')
                        .trim()
                    }
                  } catch (parseError) {
                    console.log('Failed to parse Google Translate response:', parseError)
                  }
                }
              }
            } catch (googleError) {
              // Fallback to MyMemory
              const response1 = await fetch(
                `https://api.mymemory.translated.net/get?q=${encodeURIComponent(inputText)}&langpair=${prevSourceCode}|${newSourceCode}`
              )
              
              if (response1.ok) {
                const data1 = await response1.json()
                if (data1.responseStatus === 200 && data1.responseData && data1.responseData.translatedText) {
                  // Clean up translation result
                  let cleanedInput = data1.responseData.translatedText
                  cleanedInput = cleanedInput.replace(/^t\d+\//, '')
                  cleanedInput = cleanedInput.replace(/<[^>]*>/g, '')
                  cleanedInput = cleanedInput.trim()
                  translatedInput = cleanedInput || inputText
                }
              }
            }
          }
          
          // Step 2: 번역된 입력을 입력 필드에 설정
          setInputText(translatedInput)
          
          // Step 3: 번역된 입력을 새 출력 언어로 번역
          if (newSourceCode === targetCode) {
            setOutputText(translatedInput)
            setIsTranslating(false)
          } else {
            // Try Google Translate via CORS proxy
            let finalTranslated = ''
            try {
              const googleUrl2 = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${newSourceCode}&tl=${targetCode}&dt=t&q=${encodeURIComponent(translatedInput)}`
              const proxyUrl2 = `https://api.allorigins.win/get?url=${encodeURIComponent(googleUrl2)}`
              
              const googleResponse2 = await fetch(proxyUrl2)
              
              if (googleResponse2.ok) {
                const proxyData2 = await googleResponse2.json()
                if (proxyData2 && proxyData2.contents) {
                  try {
                    const googleData2 = JSON.parse(proxyData2.contents)
                    if (googleData2 && Array.isArray(googleData2) && googleData2[0] && Array.isArray(googleData2[0])) {
                      finalTranslated = googleData2[0]
                        .filter((item) => item && Array.isArray(item) && item[0] && typeof item[0] === 'string')
                        .map((item) => item[0])
                        .join('')
                        .trim()
                    }
                  } catch (parseError) {
                    console.log('Failed to parse Google Translate response:', parseError)
                  }
                }
              }
            } catch (googleError) {
              // Fallback to MyMemory
              const response2 = await fetch(
                `https://api.mymemory.translated.net/get?q=${encodeURIComponent(translatedInput)}&langpair=${newSourceCode}|${targetCode}`
              )
              
              if (response2.ok) {
                const data2 = await response2.json()
                if (data2.responseStatus === 200 && data2.responseData && data2.responseData.translatedText) {
                  // Clean up translation result - remove unwanted tags/prefixes
                  finalTranslated = data2.responseData.translatedText
                  finalTranslated = finalTranslated.replace(/^t\d+\//, '')
                  finalTranslated = finalTranslated.replace(/<[^>]*>/g, '')
                  finalTranslated = finalTranslated.trim()
                }
              }
            }
            
            setOutputText(finalTranslated)
            setIsTranslating(false)
          }
        } catch (error) {
          console.error('Translation error:', error)
          setOutputText('')
          setIsTranslating(false)
        }
      } else if (targetLangChanged && inputText.trim()) {
        // 출력 언어만 변경된 경우: 현재 입력을 새 출력 언어로 번역
        handleTranslate()
      }

      // 이전 언어 값 업데이트
      prevSourceLangRef.current = sourceLang
      prevTargetLangRef.current = targetLang
    }, 100)

    return () => clearTimeout(timeoutId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceLang, targetLang])

  return (
    <div className="home">
      <div className="home-container">
        <h1 className="home-title">Fast Translator</h1>
        <p className="home-subtitle">LLM-powered translator that converts your words into sentences in any language</p>

        <div className="translator-box">
          <div className="language-selector">
            <select
              value={sourceLang}
              onChange={(e) => {
                const newSourceLang = e.target.value
                setSourceLang(newSourceLang)
                // source와 target이 같아지면 target을 다른 언어로 변경
                if (newSourceLang === targetLang) {
                  const otherLang = languages.find(l => l.code !== newSourceLang)
                  if (otherLang) setTargetLang(otherLang.code)
                }
              }}
              className="lang-select"
            >
              {languages.map(lang => (
                <option key={lang.code} value={lang.code}>{lang.name}</option>
              ))}
            </select>
            <button onClick={handleSwap} className="swap-btn" aria-label="Swap languages">
              ⇄
            </button>
            <select
              value={targetLang}
              onChange={(e) => setTargetLang(e.target.value)}
              className="lang-select"
            >
              {/* source 언어는 target 목록에서 제외 */}
              {languages.filter(lang => lang.code !== sourceLang).map(lang => (
                <option key={lang.code} value={lang.code}>{lang.name}</option>
              ))}
            </select>
          </div>

          <div className="input-section">
            <textarea
              value={inputText}
              onChange={(e) => {
                const newValue = e.target.value
                setInputText(newValue)
                
                // 즉시 언어 감지 및 select box 변경
                const detectedLang = detectLanguage(newValue)
                if (newValue && newValue.trim()) {
                  if (detectedLang === 'ko') {
                    setSourceLang('ko')
                    setTargetLang('en')
                  } else if (detectedLang === 'en') {
                    setSourceLang('en')
                    setTargetLang('ko')
                  } else if (detectedLang === 'zh') {
                    setSourceLang('zh')
                    setTargetLang('en')
                  }
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.ctrlKey && !e.shiftKey) {
                  e.preventDefault()
                  // 자동 번역이 이미 실행되므로 별도 처리 불필요
                }
              }}
              placeholder="Enter text to translate... (Auto-translates as you type)"
              className="input-textarea"
              rows={8}
            />
            {/* 영어 문법/철자 오류 표시 */}
            {grammarErrors.length > 0 && (
              <div className="grammar-errors">
                <div className="grammar-header">
                  <span className="grammar-icon">⚠️</span>
                  <span className="grammar-title">Grammar & Spelling Issues ({grammarErrors.length})</span>
                </div>
                <div className="grammar-list">
                  {grammarErrors.map((error, index) => (
                    <div key={index} className="grammar-item">
                      <div className="grammar-message">{error.message}</div>
                      {error.replacements.length > 0 && (
                        <div className="grammar-suggestions">
                          <span className="suggestion-label">Suggestions:</span>
                          {error.replacements.map((replacement, idx) => (
                            <button
                              key={idx}
                              className="suggestion-btn"
                              onClick={() => {
                                // 오류 부분을 제안된 단어로 교체
                                const before = inputText.substring(0, error.offset)
                                const after = inputText.substring(error.offset + error.length)
                                const newText = before + replacement + after
                                setInputText(newText)
                                // 문법 검사 다시 실행
                                setTimeout(() => checkGrammar(newText), 100)
                              }}
                            >
                              {replacement}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {isCheckingGrammar && (
              <div className="grammar-checking">Checking grammar...</div>
            )}
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

export default Home

