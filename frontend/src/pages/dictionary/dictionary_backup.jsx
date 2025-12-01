import { useState, useEffect } from 'react'
import './dictionary.css'

function Dictionary() {
  const [searchTerm, setSearchTerm] = useState('')
  const [searchDirection, setSearchDirection] = useState('ko-en')
  const [results, setResults] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [isManualChange, setIsManualChange] = useState(false)
  const [detectedLanguage, setDetectedLanguage] = useState(null)

  const directions = [
    { value: 'ko-en', label: 'English', fromLang: 'ko', toLang: 'en' },
    { value: 'en-ko', label: 'Korean', fromLang: 'en', toLang: 'ko' },
    { value: 'ko-zh', label: 'Chinese', fromLang: 'ko', toLang: 'zh' },
    { value: 'zh-ko', label: 'Korean', fromLang: 'zh', toLang: 'ko' },
    { value: 'en-zh', label: 'Chinese', fromLang: 'en', toLang: 'zh' },
    { value: 'zh-en', label: 'English', fromLang: 'zh', toLang: 'en' },
  ]

  const getLanguageName = (lang) => {
    const langMap = {
      'ko': 'Korean',
      'en': 'English',
      'zh': 'Chinese'
    }
    return langMap[lang] || lang
  }

  // 언어 감지 함수 - 더 정확한 감지를 위해 문자 비율 계산
  const detectLanguage = (text) => {
    if (!text.trim()) return null

    const trimmedText = text.trim()
    
    // 한글 감지 (유니코드 범위: AC00-D7A3, 1100-11FF, 3130-318F)
    const koreanRegex = /[\uAC00-\uD7A3\u1100-\u11FF\u3130-\u318F]/g
    // 중국어 감지 (유니코드 범위: 4E00-9FFF)
    const chineseRegex = /[\u4E00-\u9FFF]/g
    // 영어 감지 (A-Z, a-z)
    const englishRegex = /[A-Za-z]/g

    // 각 언어의 문자 개수 계산
    const koreanMatches = trimmedText.match(koreanRegex)
    const chineseMatches = trimmedText.match(chineseRegex)
    const englishMatches = trimmedText.match(englishRegex)

    const koreanCount = koreanMatches ? koreanMatches.length : 0
    const chineseCount = chineseMatches ? chineseMatches.length : 0
    const englishCount = englishMatches ? englishMatches.length : 0

    // 숫자와 공백 제외한 전체 문자 수
    const totalChars = trimmedText.replace(/[\d\s]/g, '').length

    if (totalChars === 0) return null

    // 가장 많은 비율을 차지하는 언어 반환
    if (koreanCount > 0 && koreanCount >= englishCount && koreanCount >= chineseCount) {
      return 'ko'
    }
    if (chineseCount > 0 && chineseCount >= englishCount && chineseCount >= koreanCount) {
      return 'zh'
    }
    if (englishCount > 0) {
      return 'en'
    }
    
    return null
  }

  // 입력 텍스트가 변경될 때 언어 자동 감지
  useEffect(() => {
    if (!searchTerm.trim()) {
      setDetectedLanguage(null)
      return
    }

    if (!isManualChange) {
      const detectedLang = detectLanguage(searchTerm)
      setDetectedLanguage(detectedLang)
      
      if (detectedLang === 'en') {
        // 영어 입력 → English → Korean (영어를 한국어로 번역)
        setSearchDirection('en-ko')
      } else if (detectedLang === 'ko') {
        // 한국어 입력 → Korean → English (한국어를 영어로 번역)
        setSearchDirection('ko-en')
      }
      // 중국어는 자동 변경하지 않음 (수동으로만 변경 가능)
    }
  }, [searchTerm, isManualChange])

  // 수동으로 select를 변경한 경우
  const handleDirectionChange = (e) => {
    const newDirection = e.target.value
    setSearchDirection(newDirection)
    setIsManualChange(true)
    // select 변경 시 자동으로 검색 실행
    if (searchTerm.trim()) {
      handleSearchWithDirection(newDirection)
    }
  }

  // 입력 변경 핸들러
  const handleInputChange = (e) => {
    const newValue = e.target.value
    setSearchTerm(newValue)
    // 입력이 변경되면 수동 변경 플래그를 리셋하여 자동 감지 활성화
    if (newValue.trim()) {
      setIsManualChange(false)
    }
  }

  // 검색어가 비워지면 수동 변경 플래그 리셋
  useEffect(() => {
    if (!searchTerm.trim()) {
      setIsManualChange(false)
      setSearchDirection('ko-en') // 기본값으로 리셋
      setResults([]) // 결과도 초기화
    }
  }, [searchTerm])

  const handleSearch = async () => {
    if (!searchTerm.trim()) return

    setIsSearching(true)
    try {
      await new Promise(resolve => setTimeout(resolve, 500))
      
      const [fromLang, toLang] = searchDirection.split('-')
      const wordLower = searchTerm.toLowerCase()
      
      await performSearch(searchDirection, fromLang, toLang, wordLower)
    } catch (error) {
      console.error('Dictionary search error:', error)
      setResults([])
    } finally {
      setIsSearching(false)
    }
  }

  // 특정 방향으로 검색 실행 (select 변경 시 사용)
  const handleSearchWithDirection = async (direction) => {
    if (!searchTerm.trim()) return

    setIsSearching(true)
    try {
      await new Promise(resolve => setTimeout(resolve, 500))
      
      const [fromLang, toLang] = direction.split('-')
      const wordLower = searchTerm.toLowerCase()
      
      await performSearch(direction, fromLang, toLang, wordLower)
    } catch (error) {
      console.error('Dictionary search error:', error)
      setResults([])
    } finally {
      setIsSearching(false)
    }
  }

  // 번역 API 호출 함수
  const translateText = async (text, fromLang, toLang) => {
    try {
      const langMap = {
        'ko': 'ko',
        'en': 'en',
        'zh': 'zh'
      }
      
      const sourceCode = langMap[fromLang] || 'en'
      const targetCode = langMap[toLang] || 'ko'
      
      if (sourceCode === targetCode) {
        return text
      }
      
      // Google Translate API 사용
      const googleUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceCode}&tl=${targetCode}&dt=t&q=${encodeURIComponent(text)}`
      const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(googleUrl)}`
      
      const response = await fetch(proxyUrl)
      if (response.ok) {
        const proxyData = await response.json()
        if (proxyData && proxyData.contents) {
          const googleData = JSON.parse(proxyData.contents)
          if (googleData && Array.isArray(googleData) && googleData[0] && Array.isArray(googleData[0])) {
            return googleData[0]
              .filter((item) => item && Array.isArray(item) && item[0] && typeof item[0] === 'string')
              .map((item) => item[0])
              .join('')
              .trim()
          }
        }
      }
    } catch (error) {
      console.error('Translation error:', error)
    }
    return null
  }

  // Free Dictionary API 호출 (영어 단어)
  const fetchEnglishDictionary = async (word) => {
    try {
      const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`)
      if (!response.ok) {
        return null
      }
      const data = await response.json()
      return Array.isArray(data) ? data[0] : data
    } catch (error) {
      console.error('Dictionary API error:', error)
      return null
    }
  }

  // 실제 검색 로직을 별도 함수로 분리
  const performSearch = async (direction, fromLang, toLang, wordLower) => {
    try {
      // 영어 단어 검색 (Free Dictionary API 사용)
      if (fromLang === 'en') {
        const dictData = await fetchEnglishDictionary(searchTerm)
        
        if (dictData) {
          // 발음 정보 추출
          let pronunciation = { uk: '', us: '' }
          if (dictData.phonetics && dictData.phonetics.length > 0) {
            const phonetic = dictData.phonetics.find(p => p.text) || dictData.phonetics[0]
            if (phonetic && phonetic.text) {
              pronunciation.uk = phonetic.text
              pronunciation.us = phonetic.text
            }
          }
          
          // 의미 추출
          const meanings = []
          if (dictData.meanings && dictData.meanings.length > 0) {
            let meaningNumber = 1
            for (const meaning of dictData.meanings) {
              if (meaning.definitions && meaning.definitions.length > 0) {
                for (const def of meaning.definitions) {
                  const translation = toLang === 'ko' 
                    ? await translateText(def.definition, 'en', 'ko') || def.definition
                    : toLang === 'zh'
                    ? await translateText(def.definition, 'en', 'zh') || def.definition
                    : def.definition
                  
                  meanings.push({
                    number: meaningNumber++,
                    translation: translation,
                    exampleEn: def.example || null,
                    exampleKo: def.example && toLang === 'ko' 
                      ? await translateText(def.example, 'en', 'ko') 
                      : null,
                    exampleZh: def.example && toLang === 'zh'
                      ? await translateText(def.example, 'en', 'zh')
                      : null
                  })
                }
              }
            }
          }
          
          // 동의어 추출
          const synonyms = []
          if (dictData.meanings) {
            for (const meaning of dictData.meanings) {
              if (meaning.synonyms && meaning.synonyms.length > 0) {
                synonyms.push(...meaning.synonyms)
              }
            }
          }
          
          // 반의어 추출
          const antonyms = []
          if (dictData.meanings) {
            for (const meaning of dictData.meanings) {
              if (meaning.antonyms && meaning.antonyms.length > 0) {
                antonyms.push(...meaning.antonyms)
              }
            }
          }
          
          setResults([{
            word: searchTerm,
            pronunciation: pronunciation.uk || pronunciation.us ? pronunciation : null,
            meanings: meanings,
            synonyms: [...new Set(synonyms)].slice(0, 10),
            antonyms: [...new Set(antonyms)].slice(0, 10),
            phrasalVerbs: []
          }])
          return
        }
      }
      
      // 한국어/중국어 → 영어
      if ((fromLang === 'ko' || fromLang === 'zh') && toLang === 'en') {
        // 먼저 번역해서 영어 단어 찾기
        const englishWord = await translateText(searchTerm, fromLang, 'en')
        if (englishWord) {
          // 영어 단어로 사전 검색
          const dictData = await fetchEnglishDictionary(englishWord)
          
          if (dictData) {
            let pronunciation = { uk: '', us: '' }
            if (dictData.phonetics && dictData.phonetics.length > 0) {
              const phonetic = dictData.phonetics.find(p => p.text) || dictData.phonetics[0]
              if (phonetic && phonetic.text) {
                pronunciation.uk = phonetic.text
                pronunciation.us = phonetic.text
              }
            }
            
            const meanings = []
            if (dictData.meanings && dictData.meanings.length > 0) {
              let meaningNumber = 1
              for (const meaning of dictData.meanings) {
                if (meaning.definitions && meaning.definitions.length > 0) {
                  for (const def of meaning.definitions) {
                    const translation = fromLang === 'ko'
                      ? await translateText(def.definition, 'en', 'ko') || def.definition
                      : await translateText(def.definition, 'en', 'zh') || def.definition
                    
                    meanings.push({
                      number: meaningNumber++,
                      translation: translation,
                      exampleEn: def.example || null,
                      exampleKo: def.example && fromLang === 'ko'
                        ? await translateText(def.example, 'en', 'ko')
                        : null,
                      exampleZh: def.example && fromLang === 'zh'
                        ? await translateText(def.example, 'en', 'zh')
                        : null
                    })
                  }
                }
              }
            }
            
            const synonyms = []
            if (dictData.meanings) {
              for (const meaning of dictData.meanings) {
                if (meaning.synonyms && meaning.synonyms.length > 0) {
                  synonyms.push(...meaning.synonyms)
                }
              }
            }
            
            const antonyms = []
            if (dictData.meanings) {
              for (const meaning of dictData.meanings) {
                if (meaning.antonyms && meaning.antonyms.length > 0) {
                  antonyms.push(...meaning.antonyms)
                }
              }
            }
            
            setResults([{
              word: searchTerm,
              englishWord: englishWord,
              pronunciation: pronunciation.uk || pronunciation.us ? pronunciation : null,
              meanings: meanings,
              synonyms: [...new Set(synonyms)].slice(0, 10),
              antonyms: [...new Set(antonyms)].slice(0, 10),
              phrasalVerbs: []
            }])
            return
          }
        }
      }
      
      // 한국어 ↔ 중국어 (번역만)
      if ((fromLang === 'ko' && toLang === 'zh') || (fromLang === 'zh' && toLang === 'ko')) {
        const translated = await translateText(searchTerm, fromLang, toLang)
        if (translated) {
          setResults([{
            word: searchTerm,
            [toLang === 'ko' ? 'koreanWord' : 'chineseWord']: translated,
            translation: `${searchTerm} → ${translated}`,
            example: `Example: ${translated}`
          }])
          return
        }
      }
      
      // 영어 → 한국어/중국어 (번역만)
      if (fromLang === 'en' && (toLang === 'ko' || toLang === 'zh')) {
        const dictData = await fetchEnglishDictionary(searchTerm)
        if (dictData) {
          let pronunciation = { uk: '', us: '' }
          if (dictData.phonetics && dictData.phonetics.length > 0) {
            const phonetic = dictData.phonetics.find(p => p.text) || dictData.phonetics[0]
            if (phonetic && phonetic.text) {
              pronunciation.uk = phonetic.text
              pronunciation.us = phonetic.text
            }
          }
          
          const meanings = []
          if (dictData.meanings && dictData.meanings.length > 0) {
            let meaningNumber = 1
            for (const meaning of dictData.meanings) {
              if (meaning.definitions && meaning.definitions.length > 0) {
                for (const def of meaning.definitions) {
                  const translation = await translateText(def.definition, 'en', toLang) || def.definition
                  
                  meanings.push({
                    number: meaningNumber++,
                    translation: translation,
                    exampleEn: def.example || null,
                    exampleKo: def.example && toLang === 'ko'
                      ? await translateText(def.example, 'en', 'ko')
                      : null,
                    exampleZh: def.example && toLang === 'zh'
                      ? await translateText(def.example, 'en', 'zh')
                      : null
                  })
                }
              }
            }
          }
          
          const synonyms = []
          if (dictData.meanings) {
            for (const meaning of dictData.meanings) {
              if (meaning.synonyms && meaning.synonyms.length > 0) {
                synonyms.push(...meaning.synonyms)
              }
            }
          }
          
          const antonyms = []
          if (dictData.meanings) {
            for (const meaning of dictData.meanings) {
              if (meaning.antonyms && meaning.antonyms.length > 0) {
                antonyms.push(...meaning.antonyms)
              }
            }
          }
          
          setResults([{
            word: searchTerm,
            pronunciation: pronunciation.uk || pronunciation.us ? pronunciation : null,
            meanings: meanings,
            synonyms: [...new Set(synonyms)].slice(0, 10),
            antonyms: [...new Set(antonyms)].slice(0, 10),
            phrasalVerbs: []
          }])
          return
        }
      }
      
      // 기본 결과 (API 실패 시)
      setResults([{
        word: searchTerm,
        translation: `No results found for "${searchTerm}"`
      }])
      
    } catch (error) {
      console.error('Search error:', error)
      setResults([{
        word: searchTerm,
        translation: `Error: ${error.message}`
      }])
    }
  }

  return (
    <div className="dictionary">
      <div className="dictionary-container">
        <h1 className="page-title">Dictionary</h1>
        <p className="page-subtitle">Search for words using free dictionary service</p>

        <div className="dictionary-box">
          <div className="search-controls">
            <div className="search-input-group">
              <input
                type="text"
                value={searchTerm}
                onChange={handleInputChange}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Enter a word to search..."
                className="search-input"
              />
              <select
                value={searchDirection}
                onChange={handleDirectionChange}
                className="direction-select"
              >
                {directions.map(dir => (
                  <option key={dir.value} value={dir.value}>{dir.label}</option>
                ))}
              </select>
              <button
                onClick={handleSearch}
                disabled={isSearching || !searchTerm.trim()}
                className="search-btn"
              >
                {isSearching ? 'Searching...' : 'Search'}
              </button>
            </div>
            {detectedLanguage && (
              <div className="detected-language">
                Detected language: {getLanguageName(detectedLanguage)}
              </div>
            )}
          </div>

          <div className="results-section">
            {results.length > 0 ? (
              <div className="results-list">
                {results.map((result, index) => {
                  // 발음 재생 함수
                  const playPronunciation = (text, lang = 'en-GB') => {
                    if ('speechSynthesis' in window) {
                      const utterance = new SpeechSynthesisUtterance(text)
                      utterance.lang = lang
                      utterance.rate = 0.8
                      window.speechSynthesis.speak(utterance)
                    }
                  }
                  
                  // 발음 재생에 사용할 단어 (한국어 입력 시 영어 단어 사용)
                  const wordToPronounce = result.englishWord || result.word
                  
                  return (
                    <div key={index} className="result-item">
                      <div className="result-header">
                        <div className="result-word-container">
                          <div className="result-word">{result.word}</div>
                          {result.englishWord && (
                            <div className="result-english-word">{result.englishWord}</div>
                          )}
                          {result.koreanWord && (
                            <div className="result-korean-word">{result.koreanWord}</div>
                          )}
                          {result.chineseWord && (
                            <div className="result-chinese-word">{result.chineseWord}</div>
                          )}
                        </div>
                        {result.pronunciation && (
                          <div className="result-pronunciation">
                            <div className="pronunciation-item">
                              <span className="flag-icon" role="img" aria-label="UK">
                                <span className="emoji-flag">🇬🇧</span>
                              </span>
                              <span className="pronunciation-text">{result.pronunciation.uk}</span>
                              <button 
                                className="speaker-btn"
                                onClick={() => playPronunciation(wordToPronounce, 'en-GB')}
                                aria-label="Play UK pronunciation"
                                title="Play UK pronunciation"
                              >
                                <span className="emoji-icon">🔊</span>
                              </button>
                            </div>
                            <div className="pronunciation-item">
                              <span className="flag-icon" role="img" aria-label="US">
                                <span className="emoji-flag">🇺🇸</span>
                              </span>
                              <span className="pronunciation-text">{result.pronunciation.us}</span>
                              <button 
                                className="speaker-btn"
                                onClick={() => playPronunciation(wordToPronounce, 'en-US')}
                                aria-label="Play US pronunciation"
                                title="Play US pronunciation"
                              >
                                <span className="emoji-icon">🔊</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    
                    {/* 의미별 번역 및 예문 */}
                    {result.meanings && result.meanings.length > 0 && (
                      <div className="meanings-section">
                        {result.meanings.map((meaning, idx) => (
                          <div key={idx} className="meaning-item">
                            <div className="meaning-number">{meaning.number}</div>
                            <div className="meaning-content">
                              <div className="meaning-translation">{meaning.translation}</div>
                              {(meaning.exampleKo || meaning.exampleEn || meaning.exampleZh) && (
                                <div className="meaning-examples">
                                  {meaning.exampleKo && (
                                    <div className="example-ko">{meaning.exampleKo}</div>
                                  )}
                                  {meaning.exampleZh && (
                                    <div className="example-zh">{meaning.exampleZh}</div>
                                  )}
                                  {meaning.exampleEn && (
                                    <div className="example-en-container">
                                      <div className="example-en">{meaning.exampleEn}</div>
                                      <button 
                                        className="example-speaker-btn"
                                        onClick={() => playPronunciation(meaning.exampleEn, 'en-US')}
                                        aria-label="Play example pronunciation"
                                        title="Play example pronunciation"
                                      >
                                        <span className="emoji-icon">🔊</span>
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* 기본 번역 (상세 데이터가 없을 때) */}
                    {result.translation && (
                      <div className="result-translation">{result.translation}</div>
                    )}
                    {result.example && (
                      <div className="result-example">{result.example}</div>
                    )}
                    
                    {/* Synonyms */}
                    {result.synonyms && result.synonyms.length > 0 && (
                      <div className="synonyms-section">
                        <div className="section-title">Synonyms</div>
                        <div className="word-list">
                          {result.synonyms.map((syn, idx) => (
                            <span key={idx} className="word-tag synonym-tag">{syn}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Antonyms */}
                    {result.antonyms && result.antonyms.length > 0 && (
                      <div className="antonyms-section">
                        <div className="section-title">Antonyms</div>
                        <div className="word-list">
                          {result.antonyms.map((ant, idx) => (
                            <span key={idx} className="word-tag antonym-tag">{ant}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Phrasal Verbs */}
                    {result.phrasalVerbs && result.phrasalVerbs.length > 0 && (
                      <div className="phrasal-verbs-section">
                        <div className="section-title">Phrasal Verbs</div>
                        <div className="phrasal-verbs-list">
                          {result.phrasalVerbs.map((pv, idx) => (
                            <div key={idx} className="phrasal-verb-item">
                              <div className="phrasal-verb-word">{pv.verb}</div>
                              <div className="phrasal-verb-meaning">{pv.meaning}</div>
                              {pv.example && (
                                <div className="phrasal-verb-example">{pv.example}</div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  )
                })}
              </div>
            ) : (
              <div className="no-results">
                {searchTerm ? 'No results found.' : 'Enter a search term.'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dictionary

