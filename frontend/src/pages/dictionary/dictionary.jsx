import { useState, useEffect, useRef } from 'react'
import './dictionary.css'
// @ts-ignore
import config from './dictionary-config.json'

function Dictionary() {
  const [searchTerm, setSearchTerm] = useState('')
  const [targetLang, setTargetLang] = useState(config.defaultTargetLang)
  const [results, setResults] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [detectedLanguage, setDetectedLanguage] = useState(null)
  const [suggestions, setSuggestions] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1)
  const [searchHistory, setSearchHistory] = useState([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  
  const abortControllerRef = useRef(null)
  const currentSearchTermRef = useRef('')
  const suggestionAbortRef = useRef(null)
  const inputRef = useRef(null)

  const directions = config.directions

  const getLanguageName = (lang) => config.languageNames[lang] || lang

  const detectLanguage = (text) => {
    if (!text.trim()) return null
    const trimmedText = text.trim()
    const koreanRegex = new RegExp(config.languageDetection.korean.regex, 'g')
    const chineseRegex = new RegExp(config.languageDetection.chinese.regex, 'g')
    const englishRegex = new RegExp(config.languageDetection.english.regex, 'g')
    const koreanMatches = trimmedText.match(koreanRegex)
    const chineseMatches = trimmedText.match(chineseRegex)
    const englishMatches = trimmedText.match(englishRegex)
    const koreanCount = koreanMatches ? koreanMatches.length : 0
    const chineseCount = chineseMatches ? chineseMatches.length : 0
    const englishCount = englishMatches ? englishMatches.length : 0
    const totalChars = trimmedText.replace(/[\d\s]/g, '').length
    if (totalChars === 0) return null
    if (koreanCount > 0 && koreanCount >= englishCount && koreanCount >= chineseCount) return 'ko'
    if (chineseCount > 0 && chineseCount >= englishCount && chineseCount >= koreanCount) return 'zh'
    if (englishCount > 0) return 'en'
    return null
  }

  // 자동완성 API 호출 (Datamuse API)
  const fetchSuggestions = async (query) => {
    console.log('fetchSuggestions called:', query)
    if (!query.trim() || query.length < 1) {
      setSuggestions([])
      return
    }

    const detectedLang = detectLanguage(query)
    console.log('Detected language:', detectedLang)
    
    // 한국어/중국어 입력인 경우 Google Translate로 영어 번역 후 관련 단어 검색
    if (detectedLang === 'ko' || detectedLang === 'zh') {
      if (suggestionAbortRef.current) {
        suggestionAbortRef.current.abort()
      }
      const controller = new AbortController()
      suggestionAbortRef.current = controller
      
      try {
        // 1. 먼저 입력된 단어 자체를 제안으로 표시
        const sourceLang = detectedLang === 'ko' ? 'ko' : 'zh'
        const initialSuggestion = [{ word: query, translation: null, type: 'original', isNonEnglish: true, sourceLang: sourceLang }]
        setSuggestions(initialSuggestion)
        setShowSuggestions(true)
        
        // 2. Google Translate로 영어 번역
        const googleUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=en&dt=t&q=${encodeURIComponent(query)}`
        const response = await fetch(googleUrl, { signal: controller.signal })
        
        if (response.ok) {
          const data = await response.json()
          const englishWord = data?.[0]?.[0]?.[0]?.toLowerCase()?.trim()
          
          if (englishWord && englishWord !== query) {
            // 3. 영어 번역 결과로 Datamuse API에서 관련 단어 검색
            const [sugResponse, relatedResponse] = await Promise.all([
              fetch(`https://api.datamuse.com/words?ml=${encodeURIComponent(englishWord)}&max=8`, { signal: controller.signal }),
              fetch(`https://api.datamuse.com/words?rel_syn=${encodeURIComponent(englishWord)}&max=5`, { signal: controller.signal })
            ])
            
            const sugData = sugResponse.ok ? await sugResponse.json() : []
            const relatedData = relatedResponse.ok ? await relatedResponse.json() : []
            
            // 결과 병합
            const allWords = new Map()
            // 원래 입력 단어 (나중에 targetLang으로 번역)
            allWords.set(query, { word: query, translation: null, type: 'original', isNonEnglish: true, sourceLang: sourceLang })
            
            // 관련 단어들
            sugData.forEach((item, idx) => {
              if (!allWords.has(item.word) && item.word !== englishWord) {
                allWords.set(item.word, { word: item.word, score: item.score || (1000 - idx), type: 'related' })
              }
            })
            relatedData.forEach((item, idx) => {
              if (!allWords.has(item.word) && item.word !== englishWord) {
                allWords.set(item.word, { word: item.word, score: item.score || (500 - idx), type: 'synonym' })
              }
            })
            
            const combined = Array.from(allWords.values()).slice(0, 10)
            setSuggestions(combined)
            setShowSuggestions(combined.length > 0)
            
            // 모든 단어를 번역: 검색어 언어(sourceLang) ↔ targetLang
            // 실제 번역 대상 언어 결정 (검색어 언어와 타겟 언어가 같으면 영어로)
            const actualTargetLang = targetLang === sourceLang ? 'en' : targetLang
            
            const suggestionsWithTranslation = await Promise.all(
              combined.map(async (suggestion) => {
                try {
                  // 비영어 원본 단어(한글/중국어)는 sourceLang에서 actualTargetLang으로 번역
                  if (suggestion.isNonEnglish) {
                    const transUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${suggestion.sourceLang}&tl=${actualTargetLang}&dt=t&q=${encodeURIComponent(suggestion.word)}`
                    const transResponse = await fetch(transUrl)
                    if (transResponse.ok) {
                      const transData = await transResponse.json()
                      const translation = transData?.[0]?.[0]?.[0] || null
                      return { ...suggestion, translation }
                    }
                    return suggestion
                  }
                  // 영어 단어는: 검색어 언어로 번역 (왼쪽) + actualTargetLang으로 번역 (오른쪽)
                  const sourceTransUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${sourceLang}&dt=t&q=${encodeURIComponent(suggestion.word)}`
                  const sourceTransResponse = await fetch(sourceTransUrl)
                  let sourceTranslation = null
                  if (sourceTransResponse.ok) {
                    const sourceTransData = await sourceTransResponse.json()
                    sourceTranslation = sourceTransData?.[0]?.[0]?.[0] || null
                  }
                  
                  let targetTranslation = null
                  if (actualTargetLang !== 'en') {
                    const targetTransUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${actualTargetLang}&dt=t&q=${encodeURIComponent(suggestion.word)}`
                    const targetTransResponse = await fetch(targetTransUrl)
                    if (targetTransResponse.ok) {
                      const targetTransData = await targetTransResponse.json()
                      targetTranslation = targetTransData?.[0]?.[0]?.[0] || null
                    }
                  } else {
                    // actualTargetLang이 영어면 영어 단어 자체가 번역
                    targetTranslation = suggestion.word
                  }
                  
                  return { 
                    ...suggestion, 
                    sourceTranslation, // 검색어 언어로 번역 (왼쪽 표시용)
                    translation: targetTranslation || suggestion.word // actualTargetLang으로 번역 (오른쪽 표시용)
                  }
                } catch { return suggestion }
              })
            )
            
            // 검색 중이 아닐 때만 업데이트
            if (!isSearching) {
              setSuggestions(suggestionsWithTranslation)
            }
          }
        }
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error('Korean/Chinese suggestion error:', error)
        }
      }
      return
    }

    // 영어 입력인 경우 Datamuse API 사용
    if (suggestionAbortRef.current) {
      suggestionAbortRef.current.abort()
    }
    
    const controller = new AbortController()
    suggestionAbortRef.current = controller

    try {
      console.log('Fetching from Datamuse API...')
      // Datamuse API: 자동완성 + 스펠링 수정
      const [sugResponse, spellResponse] = await Promise.all([
        fetch(`https://api.datamuse.com/sug?s=${encodeURIComponent(query)}&max=8`, { signal: controller.signal }),
        fetch(`https://api.datamuse.com/words?sp=${encodeURIComponent(query)}*&max=5`, { signal: controller.signal })
      ])

      console.log('API responses:', sugResponse.ok, spellResponse.ok)

      if (!sugResponse.ok && !spellResponse.ok) {
        setSuggestions([])
        return
      }

      const sugData = sugResponse.ok ? await sugResponse.json() : []
      const spellData = spellResponse.ok ? await spellResponse.json() : []
      console.log('sugData:', sugData)
      console.log('spellData:', spellData)

      // 결과 병합 및 중복 제거
      const allWords = new Map()
      
      // 자동완성 결과 (우선순위 높음)
      sugData.forEach((item, idx) => {
        if (!allWords.has(item.word)) {
          allWords.set(item.word, { word: item.word, score: item.score || (1000 - idx), type: 'suggest' })
        }
      })
      
      // 스펠링 수정 결과
      spellData.forEach((item, idx) => {
        if (!allWords.has(item.word)) {
          allWords.set(item.word, { word: item.word, score: item.score || (500 - idx), type: 'spell' })
        }
      })

      const combined = Array.from(allWords.values())
        .sort((a, b) => b.score - a.score)
        .slice(0, 10)

      console.log('Combined suggestions:', combined)
      
      // 먼저 번역 없이 자동완성 표시 (빠른 응답)
      setSuggestions(combined)
      setShowSuggestions(combined.length > 0)
      
      // 백그라운드에서 번역 추가
      const fetchTranslationsForSuggestions = async () => {
        try {
          const suggestionsWithTranslation = await Promise.all(
            combined.map(async (suggestion) => {
              try {
                const googleUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${targetLang === 'en' ? 'ko' : targetLang}&dt=t&q=${encodeURIComponent(suggestion.word)}`
                const response = await fetch(googleUrl)
                if (response.ok) {
                  const data = await response.json()
                  const translation = data?.[0]?.[0]?.[0] || null
                  return { ...suggestion, translation }
                }
                return { ...suggestion, translation: null }
              } catch (error) {
                return { ...suggestion, translation: null }
              }
            })
          )
          // 번역 완료 후 검색 중이 아닐 때만 업데이트
          if (!isSearching) {
            setSuggestions(suggestionsWithTranslation)
          }
        } catch (error) {
          console.error('Translation batch error:', error)
        }
      }
      fetchTranslationsForSuggestions()
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Suggestion error:', error)
      }
    }
  }

  // 검색어가 비워지면 자동완성 초기화
  useEffect(() => {
    if (!searchTerm.trim()) {
      setSuggestions([])
      setShowSuggestions(false)
    }
  }, [searchTerm])

  useEffect(() => {
    if (!searchTerm.trim()) { setDetectedLanguage(null); return }
    const detectedLang = detectLanguage(searchTerm)
    setDetectedLanguage(detectedLang)
    // detectedLanguage와 targetLang이 같으면 다른 언어로 자동 변경
    if (detectedLang === targetLang) {
      const availableLangs = directions.filter(dir => dir.value !== detectedLang)
      if (availableLangs.length > 0) {
        setTargetLang(availableLangs[0].value)
      }
    }
  }, [searchTerm])

  // targetLang 변경 시 자동완성 번역 업데이트
  useEffect(() => {
    if (suggestions.length > 0 && showSuggestions) {
      const updateTranslations = async () => {
        const updatedSuggestions = await Promise.all(
          suggestions.map(async (suggestion) => {
            // 비영어 원본 단어는 영어로 번역
            if (suggestion.isNonEnglish) {
              try {
                const sourceLang = detectLanguage(suggestion.word) === 'ko' ? 'ko' : 'zh'
                const googleUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=en&dt=t&q=${encodeURIComponent(suggestion.word)}`
                const response = await fetch(googleUrl)
                if (response.ok) {
                  const data = await response.json()
                  const translation = data?.[0]?.[0]?.[0] || null
                  return { ...suggestion, translation }
                }
              } catch { }
              return suggestion
            }
            // 영어 단어는 targetLang으로 번역
            try {
              const googleUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${targetLang}&dt=t&q=${encodeURIComponent(suggestion.word)}`
              const response = await fetch(googleUrl)
              if (response.ok) {
                const data = await response.json()
                const translation = data?.[0]?.[0]?.[0] || null
                return { ...suggestion, translation }
              }
            } catch { }
            return suggestion
          })
        )
        setSuggestions(updatedSuggestions)
      }
      updateTranslations()
    }
  }, [targetLang])

  const handleTargetLangChange = (e) => {
    setTargetLang(e.target.value)
    if (searchTerm.trim()) handleSearchWithTarget(e.target.value)
  }

  const handleInputChange = (e) => {
    const newValue = e.target.value
    console.log('Input changed:', newValue)
    setSearchTerm(newValue)
    setSelectedSuggestionIndex(-1)
    if (abortControllerRef.current) { abortControllerRef.current.abort(); abortControllerRef.current = null }
    setResults([])
    setIsSearching(false)
    currentSearchTermRef.current = newValue
    
    // 입력할 때마다 자동완성 호출
    if (newValue.trim()) {
      fetchSuggestions(newValue)
    } else {
      setSuggestions([])
      setShowSuggestions(false)
    }
  }

  const handleKeyDown = (e) => {
    if (!showSuggestions || suggestions.length === 0) {
      if (e.key === 'Enter') handleSearch()
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedSuggestionIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : 0
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedSuggestionIndex(prev => 
          prev > 0 ? prev - 1 : suggestions.length - 1
        )
        break
      case 'Enter':
        e.preventDefault()
        if (selectedSuggestionIndex >= 0) {
          selectSuggestion(suggestions[selectedSuggestionIndex])
        } else {
          setShowSuggestions(false)
          handleSearch()
        }
        break
      case 'Escape':
        setShowSuggestions(false)
        setSelectedSuggestionIndex(-1)
        break
      default:
        break
    }
  }

  const selectSuggestion = (suggestion) => {
    // 검색창에 표시할 단어와 실제 검색할 단어 결정
    // 왼쪽에 표시된 단어를 검색창에 넣음
    let displayWord, searchWord
    
    if (!suggestion.isNonEnglish && suggestion.sourceTranslation) {
      // 영어 단어 + sourceTranslation이 있는 경우: 검색창에 sourceTranslation(검색어 언어), 검색은 영어로
      displayWord = suggestion.sourceTranslation
      searchWord = suggestion.word
    } else {
      // 비영어 원본이거나 번역이 없는 경우: 그대로 사용
      displayWord = suggestion.word
      searchWord = suggestion.word
    }
    
    // UI 상태 업데이트
    setSearchTerm(displayWord)
    setShowSuggestions(false)
    setSuggestions([])
    setSelectedSuggestionIndex(-1)
    
    // 검색 직접 실행 (displayWord를 히스토리용으로 전달)
    searchWithWord(searchWord, displayWord)
  }
  
  const searchWithWord = async (word, historyWord = null) => {
    if (!word.trim()) { setResults([]); return }
    
    // 히스토리에 저장할 단어 (displayWord 또는 word)
    const wordForHistory = historyWord || word
    
    // 자동완성 닫기 및 진행 중인 자동완성 요청 취소
    setShowSuggestions(false)
    setSuggestions([])
    if (suggestionAbortRef.current) {
      suggestionAbortRef.current.abort()
      suggestionAbortRef.current = null
    }
    
    // 이전 검색 취소
    if (abortControllerRef.current) { 
      abortControllerRef.current.abort()
      abortControllerRef.current = null 
    }
    
    const abortController = new AbortController()
    abortControllerRef.current = abortController
    currentSearchTermRef.current = word
    
    setResults([])
    setIsSearching(true)
    
    try {
      const detectedLang = detectLanguage(word)
      const fromLang = detectedLang || 'en'
      await performSearch(fromLang, targetLang, word, abortController.signal, wordForHistory)
    } catch (error) {
      if (error.name === 'AbortError') return
      if (currentSearchTermRef.current === word) {
        setResults([{ word: word, translation: 'Error: ' + error.message }])
      }
    } finally {
      if (currentSearchTermRef.current === word) { 
        setIsSearching(false)
        abortControllerRef.current = null 
      }
    }
  }

  const addToHistory = (searchWord, searchResults, fromLang, toLang) => {
    const historyItem = {
      word: searchWord,
      results: searchResults,
      fromLang,
      toLang,
      timestamp: Date.now()
    }
    setSearchHistory(prev => {
      // 현재 인덱스 이후의 히스토리 제거 (새 검색 시)
      const newHistory = prev.slice(0, historyIndex + 1)
      newHistory.push(historyItem)
      // 최대 50개까지만 저장
      if (newHistory.length > 50) {
        newHistory.shift()
        setHistoryIndex(newHistory.length - 1)
      } else {
        setHistoryIndex(newHistory.length - 1)
      }
      return newHistory
    })
  }

  const goBack = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1
      const historyItem = searchHistory[newIndex]
      setHistoryIndex(newIndex)
      setSearchTerm(historyItem.word)
      setTargetLang(historyItem.toLang)
      setResults(historyItem.results)
      setDetectedLanguage(historyItem.fromLang)
    }
  }

  const goForward = () => {
    if (historyIndex < searchHistory.length - 1) {
      const newIndex = historyIndex + 1
      const historyItem = searchHistory[newIndex]
      setHistoryIndex(newIndex)
      setSearchTerm(historyItem.word)
      setTargetLang(historyItem.toLang)
      setResults(historyItem.results)
      setDetectedLanguage(historyItem.fromLang)
    }
  }

  const performSearchDirect = async (fromLang, toLang, word) => {
    if (abortControllerRef.current) { abortControllerRef.current.abort(); abortControllerRef.current = null }
    const abortController = new AbortController()
    abortControllerRef.current = abortController
    currentSearchTermRef.current = word
    setResults([])
    setIsSearching(true)
    try {
      await performSearch(fromLang, toLang, word, abortController.signal)
    } catch (error) {
      if (error.name === 'AbortError') return
      const errorResult = [{ word: word, translation: 'Error: ' + error.message }]
      setResults(errorResult)
      addToHistory(word, errorResult, fromLang, toLang)
    } finally {
      setIsSearching(false)
      abortControllerRef.current = null
    }
  }

  useEffect(() => {
    if (!searchTerm.trim()) {
      setTargetLang(config.defaultTargetLang)
      setResults([])
    }
  }, [searchTerm])

  // 외부 클릭 시 자동완성 닫기
  useEffect(() => {
    const handleClickOutside = (e) => {
      // suggestion-item 클릭이면 무시 (onMouseDown에서 처리됨)
      if (e.target.closest('.suggestion-item')) {
        return
      }
      if (inputRef.current && !inputRef.current.contains(e.target)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSearch = async () => {
    if (!searchTerm.trim()) { setResults([]); return }
    setShowSuggestions(false)
    if (abortControllerRef.current) { abortControllerRef.current.abort(); abortControllerRef.current = null }
    const abortController = new AbortController()
    abortControllerRef.current = abortController
    currentSearchTermRef.current = searchTerm
    setResults([])
    setIsSearching(true)
    try {
      const fromLang = detectedLanguage || 'en'
      await performSearch(fromLang, targetLang, searchTerm, abortController.signal)
    } catch (error) {
      if (error.name === 'AbortError') return
      if (currentSearchTermRef.current === searchTerm) {
        setResults([{ word: searchTerm, translation: 'Error: ' + error.message }])
      }
    } finally {
      if (currentSearchTermRef.current === searchTerm) { setIsSearching(false); abortControllerRef.current = null }
    }
  }

  const handleSearchWithTarget = async (newTargetLang) => {
    if (!searchTerm.trim()) { setResults([]); return }
    setShowSuggestions(false)
    if (abortControllerRef.current) { abortControllerRef.current.abort(); abortControllerRef.current = null }
    const abortController = new AbortController()
    abortControllerRef.current = abortController
    currentSearchTermRef.current = searchTerm
    setResults([])
    setIsSearching(true)
    try {
      const fromLang = detectedLanguage || 'en'
      await performSearch(fromLang, newTargetLang, searchTerm, abortController.signal)
    } catch (error) {
      if (error.name === 'AbortError') return
      if (currentSearchTermRef.current === searchTerm) {
        setResults([{ word: searchTerm, translation: 'Error: ' + error.message }])
      }
    } finally {
      if (currentSearchTermRef.current === searchTerm) { setIsSearching(false); abortControllerRef.current = null }
    }
  }

  const translateText = async (text, fromLang, toLang) => {
    try {
      const langMap = { ko: 'ko', en: 'en', zh: 'zh' }
      const sourceCode = langMap[fromLang] || 'en'
      const targetCode = langMap[toLang] || 'ko'
      if (sourceCode === targetCode) return text
      const timeout = 5000
      
      // 1. 직접 Google Translate API 시도 (가장 안정적)
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), timeout)
        const googleUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceCode}&tl=${targetCode}&dt=t&q=${encodeURIComponent(text)}`
        const response = await fetch(googleUrl, { signal: controller.signal })
        clearTimeout(timeoutId)
        if (response.ok) {
          const googleData = await response.json()
          if (googleData?.[0]?.[0]?.[0]) {
            const translated = googleData[0].filter(item => item?.[0] && typeof item[0] === 'string').map(item => item[0]).join('').trim()
            if (translated && translated !== text) return translated
          }
        }
      } catch (e) { console.error('Google Translate direct error:', e) }
      
      // 2. MyMemory API 시도
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), timeout)
        const myMemoryUrl = 'https://api.mymemory.translated.net/get?q=' + encodeURIComponent(text) + '&langpair=' + sourceCode + '|' + targetCode
        const response = await fetch(myMemoryUrl, { signal: controller.signal })
        clearTimeout(timeoutId)
        if (response.ok) {
          const data = await response.json()
          if (data.responseStatus === 200 && data.responseData?.translatedText) {
            let translated = data.responseData.translatedText
            translated = translated.replace(/^t\d+\//, '').replace(/<[^>]*>/g, '').trim()
            if (translated && translated !== text && translated.toUpperCase() !== text.toUpperCase()) return translated
          }
        }
      } catch (e) { console.error('MyMemory error:', e) }
      
      // 3. Proxy를 통한 Google Translate 시도
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), timeout)
        const googleUrl = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=' + sourceCode + '&tl=' + targetCode + '&dt=t&q=' + encodeURIComponent(text)
        const proxyUrl = 'https://api.allorigins.win/get?url=' + encodeURIComponent(googleUrl)
        const response = await fetch(proxyUrl, { method: 'GET', headers: { Accept: 'application/json' }, signal: controller.signal })
        clearTimeout(timeoutId)
        if (response.ok) {
          const proxyData = await response.json()
          if (proxyData?.contents) {
            const googleData = JSON.parse(proxyData.contents)
            if (googleData?.[0]?.[0]?.[0]) {
              const translated = googleData[0].filter(item => item?.[0] && typeof item[0] === 'string').map(item => item[0]).join('').trim()
              if (translated && translated !== text) return translated
            }
          }
        }
      } catch (e) { console.error('Google Translate proxy error:', e) }
    } catch (error) { console.error('Translation error:', error) }
    return null
  }

  const fetchDictionary = async (word, signal = null) => {
    try {
      const timeout = 5000
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeout)
      try {
        const response = await fetch('https://api.dictionaryapi.dev/api/v2/entries/en/' + encodeURIComponent(word), { signal: signal || controller.signal })
        if (!response.ok) { clearTimeout(timeoutId); return null }
        const data = await response.json()
        clearTimeout(timeoutId)
        return Array.isArray(data) ? data[0] : data
      } catch (fetchError) { clearTimeout(timeoutId); return null }
    } catch (error) { console.error('Dictionary API error:', error); return null }
  }

  const performSearch = async (fromLang, toLang, searchWord, signal = null, historyWord = null) => {
    const wordToSearch = searchWord
    const wordForHistory = historyWord || searchWord
    if (signal?.aborted) throw new DOMException('Search cancelled', 'AbortError')
    if (wordToSearch !== currentSearchTermRef.current) throw new DOMException('Search cancelled', 'AbortError')
    
    try {
      if (fromLang === 'en') {
        const dictData = await fetchDictionary(wordToSearch, signal)
        if (dictData) {
          let pronunciation = { uk: '', us: '' }
          if (dictData.phonetics && dictData.phonetics.length > 0) {
            const phonetic = dictData.phonetics.find(p => p.text) || dictData.phonetics[0]
            if (phonetic && phonetic.text) { pronunciation.uk = phonetic.text; pronunciation.us = phonetic.text }
          }
          const meanings = []
          if (dictData.meanings && dictData.meanings.length > 0) {
            let meaningNumber = 1
            const textsToTranslate = []
            const meaningData = []
            // partOfSpeech로 정렬: verb를 먼저, 그 다음 noun, adjective 등
            const sortedMeanings = [...dictData.meanings].sort((a, b) => {
              const order = { 'verb': 0, 'noun': 1, 'adjective': 2, 'adverb': 3 }
              const aOrder = order[a.partOfSpeech] ?? 99
              const bOrder = order[b.partOfSpeech] ?? 99
              return aOrder - bOrder
            })
            // verb meaning의 모든 definition을 먼저 추가
            for (const meaning of sortedMeanings) {
              if (meaning.partOfSpeech === 'verb' && meaning.definitions && meaning.definitions.length > 0) {
                // verb의 모든 definition 추가 (최대 10개)
                const verbDefs = meaning.definitions.slice(0, 10)
                for (const def of verbDefs) {
                  if (def && def.definition) {
                    meaningData.push({ number: meaningNumber++, definition: def.definition, example: def.example || null })
                    if (toLang !== 'en') { textsToTranslate.push(def.definition); if (def.example) textsToTranslate.push(def.example) }
                  }
                }
              }
            }
            // verb가 아닌 다른 의미들 추가 (각 meaning의 첫 번째 definition만)
            for (const meaning of sortedMeanings) {
              if (meaning.partOfSpeech !== 'verb' && meaning.definitions && meaning.definitions.length > 0) {
                const mainDef = meaning.definitions[0]
                if (mainDef && mainDef.definition) {
                  meaningData.push({ number: meaningNumber++, definition: mainDef.definition, example: mainDef.example || null })
                  if (toLang !== 'en') { textsToTranslate.push(mainDef.definition); if (mainDef.example) textsToTranslate.push(mainDef.example) }
                }
              }
            }
            const translations = toLang !== 'en' ? await Promise.all(textsToTranslate.slice(0, 20).map(text => translateText(text, 'en', toLang))) : []
            let translationIndex = 0
            for (const data of meaningData) {
              const shouldTranslate = toLang !== 'en'
              let translation = shouldTranslate && translationIndex < translations.length ? translations[translationIndex++] || data.definition : data.definition
              // 번역 품질 검증: 번역이 원본과 너무 비슷하거나 의미 없는 경우 원본 사용
              if (shouldTranslate && translation && translation !== data.definition) {
                const translationLower = translation.toLowerCase().trim()
                const definitionLower = data.definition.toLowerCase().trim()
                // 번역이 원본과 동일하거나 너무 짧은 경우(2글자 이하) 원본 사용
                if (translationLower === definitionLower || translation.length <= 2) {
                  translation = data.definition
                }
              }
              const exampleTranslation = data.example && shouldTranslate && translationIndex < translations.length ? translations[translationIndex++] || null : null
              meanings.push({ number: data.number, translation, exampleEn: data.example || null, exampleKo: toLang === 'ko' ? exampleTranslation : null, exampleZh: toLang === 'zh' ? exampleTranslation : null })
            }
          }
          const synonyms = [], antonyms = []
          if (dictData.meanings) { for (const meaning of dictData.meanings) { if (meaning.synonyms) synonyms.push(...meaning.synonyms); if (meaning.antonyms) antonyms.push(...meaning.antonyms) } }
          const result = [{ word: wordToSearch, pronunciation: pronunciation.uk || pronunciation.us ? pronunciation : null, meanings, synonyms: [...new Set(synonyms)].slice(0, 10), antonyms: [...new Set(antonyms)].slice(0, 10) }]
          setResults(result)
          addToHistory(wordForHistory, result, fromLang, toLang)
          return
        } else {
          // Dictionary API 실패 시 번역 결과 표시 (구문 검색 등)
          console.log('Dictionary API failed for:', wordToSearch, 'trying translation...')
          const translation = await translateText(wordToSearch, 'en', toLang)
          console.log('Translation result:', translation)
          if (translation) {
            const displayTranslation = translation.toLowerCase() === wordToSearch.toLowerCase() ? null : translation
            const result = [{ 
              word: wordToSearch, 
              translation: displayTranslation || `"${wordToSearch}" - 번역을 찾을 수 없습니다.`,
              isPhrase: true 
            }]
            setResults(result)
            addToHistory(wordForHistory, result, fromLang, toLang)
            return
          } else {
            // 번역도 실패한 경우
            const result = [{ word: wordToSearch, translation: `"${wordToSearch}" - 사전에 등록되지 않은 단어입니다.`, isPhrase: true }]
            setResults(result)
            addToHistory(wordForHistory, result, fromLang, toLang)
            return
          }
        }
      }
      
      if (fromLang === 'ko' || fromLang === 'zh') {
        let englishWord = await translateText(wordToSearch, fromLang, 'en')
        if (!englishWord) { 
          const result = [{ word: wordToSearch, translation: 'Translation failed for "' + wordToSearch + '". Please try a different word.' }]
          setResults(result)
          addToHistory(wordForHistory, result, fromLang, toLang)
          return 
        }
        
        const cleanEnglishWord = englishWord.toLowerCase().trim().split(/\s+/)[0]
        const dictData = await fetchDictionary(cleanEnglishWord, signal)
        
        if (!dictData) { 
          let result
          if (toLang === 'en') {
            result = [{ word: wordToSearch, englishWord: cleanEnglishWord, translation: wordToSearch + ' → ' + cleanEnglishWord }]
          } else {
            const finalTranslation = await translateText(wordToSearch, fromLang, toLang)
            result = [{ word: wordToSearch, translation: wordToSearch + ' → ' + (finalTranslation || cleanEnglishWord) }]
          }
          setResults(result)
          addToHistory(wordForHistory, result, fromLang, toLang)
          return 
        }
        
        let pronunciation = { uk: '', us: '' }
        if (dictData.phonetics && dictData.phonetics.length > 0) { 
          const phonetic = dictData.phonetics.find(p => p.text) || dictData.phonetics[0]
          if (phonetic && phonetic.text) { pronunciation.uk = phonetic.text; pronunciation.us = phonetic.text } 
        }
        
        const meanings = []
        if (dictData.meanings && dictData.meanings.length > 0) {
          let meaningNumber = 1
          const textsToTranslate = []
          const meaningData = []
          // partOfSpeech로 정렬: verb를 먼저, 그 다음 noun, adjective 등
          const sortedMeanings = [...dictData.meanings].sort((a, b) => {
            const order = { 'verb': 0, 'noun': 1, 'adjective': 2, 'adverb': 3 }
            const aOrder = order[a.partOfSpeech] ?? 99
            const bOrder = order[b.partOfSpeech] ?? 99
            return aOrder - bOrder
          })
          // verb meaning의 모든 definition을 먼저 추가
          for (const meaning of sortedMeanings) {
            if (meaning.partOfSpeech === 'verb' && meaning.definitions && meaning.definitions.length > 0) {
              // verb의 모든 definition 추가 (최대 10개)
              const verbDefs = meaning.definitions.slice(0, 10)
              for (const def of verbDefs) {
                if (def && def.definition) {
                  meaningData.push({ number: meaningNumber++, definition: def.definition, example: def.example || null })
                  if (toLang !== 'en') { textsToTranslate.push(def.definition); if (def.example) textsToTranslate.push(def.example) }
                }
              }
            }
          }
          // verb가 아닌 다른 의미들 추가 (각 meaning의 첫 번째 definition만)
          for (const meaning of sortedMeanings) {
            if (meaning.partOfSpeech !== 'verb' && meaning.definitions && meaning.definitions.length > 0) {
              const mainDef = meaning.definitions[0]
              if (mainDef && mainDef.definition) {
                meaningData.push({ number: meaningNumber++, definition: mainDef.definition, example: mainDef.example || null })
                if (toLang !== 'en') { textsToTranslate.push(mainDef.definition); if (mainDef.example) textsToTranslate.push(mainDef.example) }
              }
            }
          }
          const translations = toLang !== 'en' ? await Promise.all(textsToTranslate.slice(0, 20).map(text => translateText(text, 'en', toLang))) : []
          let translationIndex = 0
          for (const data of meaningData) { 
            const shouldTranslate = toLang !== 'en'
            let translation = shouldTranslate && translationIndex < translations.length ? translations[translationIndex++] || data.definition : data.definition
            // 번역 품질 검증: 번역이 원본과 너무 비슷하거나 의미 없는 경우 원본 사용
            if (shouldTranslate && translation && translation !== data.definition) {
              const translationLower = translation.toLowerCase().trim()
              const definitionLower = data.definition.toLowerCase().trim()
              // 번역이 원본과 동일하거나 너무 짧은 경우(2글자 이하) 원본 사용
              if (translationLower === definitionLower || translation.length <= 2) {
                translation = data.definition
              }
            }
            const exampleTranslation = data.example && shouldTranslate && translationIndex < translations.length ? translations[translationIndex++] || null : null
            meanings.push({ number: data.number, translation, exampleEn: data.example || null, exampleKo: toLang === 'ko' ? exampleTranslation : null, exampleZh: toLang === 'zh' ? exampleTranslation : null }) 
          }
        }
        
        const synonyms = [], antonyms = []
        if (dictData.meanings) { for (const meaning of dictData.meanings) { if (meaning.synonyms) synonyms.push(...meaning.synonyms); if (meaning.antonyms) antonyms.push(...meaning.antonyms) } }
        const result = [{ word: wordToSearch, englishWord: cleanEnglishWord, pronunciation: pronunciation.uk || pronunciation.us ? pronunciation : null, meanings, synonyms: [...new Set(synonyms)].slice(0, 10), antonyms: [...new Set(antonyms)].slice(0, 10) }]
        setResults(result)
        addToHistory(wordForHistory, result, fromLang, toLang)
        return
      }
      
      const noResult = [{ word: wordToSearch, translation: 'No results found for "' + wordToSearch + '".' }]
      setResults(noResult)
      addToHistory(wordForHistory, noResult, fromLang, toLang)
    } catch (error) { 
      console.error('Search error:', error)
      const errorResult = [{ word: wordToSearch, translation: 'Error: ' + error.message }]
      setResults(errorResult)
      addToHistory(wordForHistory, errorResult, fromLang, toLang)
    }
  }

  const playPronunciation = (text, lang = 'en-GB') => { if ('speechSynthesis' in window) { const utterance = new SpeechSynthesisUtterance(text); utterance.lang = lang; utterance.rate = 0.8; window.speechSynthesis.speak(utterance) } }

  return (
    <div className="dictionary">
      <div className="dictionary-container">
        <h1 className="page-title">Dictionary</h1>
        <p className="page-subtitle">Search for words using free dictionary service</p>
        <div className="dictionary-box">
          <div className="search-controls">
            <div className="search-input-group" ref={inputRef}>
              <div className="search-input-wrapper">
                <input 
                  type="text" 
                  value={searchTerm} 
                  onChange={handleInputChange} 
                  onKeyDown={handleKeyDown}
                  onClick={() => {
                    if (searchTerm.trim() && !showSuggestions) {
                      // 자동완성이 닫혀있을 때만 새로 fetch
                      fetchSuggestions(searchTerm)
                    } else if (searchTerm.trim() && suggestions.length > 0) {
                      // 이미 suggestions가 있으면 보여주기만
                      setShowSuggestions(true)
                    }
                  }}
                  placeholder="Enter a word to search..." 
                  className="search-input" 
                  autoComplete="off"
                />
                {showSuggestions && suggestions.length > 0 && (
                  <div className="suggestions-dropdown">
                    {suggestions.map((suggestion, index) => (
                      <div 
                        key={index} 
                        className={`suggestion-item ${index === selectedSuggestionIndex ? 'selected' : ''}`}
                        onMouseDown={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          // 다음 이벤트 루프에서 실행하여 React 리렌더링 완료 후 처리
                          setTimeout(() => {
                            selectSuggestion(suggestion)
                          }, 0)
                        }}
                        onMouseEnter={() => setSelectedSuggestionIndex(index)}
                      >
                        {/* 왼쪽: 검색어 언어, 오른쪽: targetLang */}
                        {!suggestion.isNonEnglish && suggestion.sourceTranslation ? (
                          <>
                            <span className="suggestion-word">{suggestion.sourceTranslation}</span>
                            <span className="suggestion-translation">{suggestion.translation || suggestion.word}</span>
                          </>
                        ) : (
                          <>
                            <span className="suggestion-word">{suggestion.word}</span>
                            {suggestion.translation && (
                              <span className="suggestion-translation">{suggestion.translation}</span>
                            )}
                          </>
                        )}
                        {suggestion.english && (
                          <span className="suggestion-english">{suggestion.english}</span>
                        )}
                        {suggestion.type === 'spell' && (
                          <span className="suggestion-hint">Did you mean?</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <select value={targetLang} onChange={handleTargetLangChange} className="direction-select">
                {directions.filter(dir => dir.value !== detectedLanguage).map(dir => (<option key={dir.value} value={dir.value}>{dir.label}</option>))}
              </select>
              <button onClick={handleSearch} disabled={isSearching || !searchTerm.trim()} className="search-btn">{isSearching ? 'Searching...' : 'Search'}</button>
            </div>
          </div>
          {results.length > 0 && (
            <div className="related-words-section-top">
              {results.map((result, index) => (
                <div key={index} className="related-words-wrapper">
                  {result.synonyms && result.synonyms.length > 0 && (
                    <div className="synonyms-section">
                      <div className="section-title">Synonyms</div>
                      <div className="word-list">
                        {result.synonyms.map((syn, idx) => (<span key={idx} className="word-tag synonym-tag" onClick={() => { currentSearchTermRef.current = syn; setSearchTerm(syn); setTargetLang('ko'); setSuggestions([]); setShowSuggestions(false); performSearchDirect('en', 'ko', syn) }} style={{ cursor: 'pointer' }}>{syn}</span>))}
                      </div>
                    </div>
                  )}
                  {result.antonyms && result.antonyms.length > 0 && (
                    <div className="antonyms-section">
                      <div className="section-title">Antonyms</div>
                      <div className="word-list">
                        {result.antonyms.map((ant, idx) => (<span key={idx} className="word-tag antonym-tag" onClick={() => { currentSearchTermRef.current = ant; setSearchTerm(ant); setTargetLang('ko'); setSuggestions([]); setShowSuggestions(false); performSearchDirect('en', 'ko', ant) }} style={{ cursor: 'pointer' }}>{ant}</span>))}
                      </div>
                    </div>
                  )}
                  {searchHistory.length > 1 && (
                    <div className="history-controls-inline">
                      <button 
                        onClick={goBack} 
                        disabled={historyIndex <= 0}
                        className="history-btn-inline history-back-btn"
                        title="Previous search"
                      >
                        ← Back
                      </button>
                      <span className="history-info-inline">
                        {historyIndex + 1} / {searchHistory.length}
                      </span>
                      <button 
                        onClick={goForward} 
                        disabled={historyIndex >= searchHistory.length - 1}
                        className="history-btn-inline history-forward-btn"
                        title="Next search"
                      >
                        Forward →
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          <div className="results-section">
            {isSearching && results.length === 0 ? (
              <div className="loading-container"><div className="loading-spinner"></div><p className="loading-text">Searching...</p></div>
            ) : !isSearching && results.length > 0 ? (
              <div className="results-list">
                {results.map((result, index) => {
                  const wordToPronounce = result.englishWord || result.word
                  return (
                    <div key={index} className="result-item">
                      <div className="result-header">
                        <div className="result-word-container">
                          <div className="result-word">{result.word}</div>
                          {result.englishWord && (<div className="result-english-word">{result.englishWord}</div>)}
                        </div>
                        {result.pronunciation && (
                          <div className="result-pronunciation">
                            <div className="pronunciation-item">
                              <img src="https://flagcdn.com/w40/gb.png" alt="UK" className="flag-icon" width="24" height="16" />
                              <span className="pronunciation-label">UK</span>
                              <span className="pronunciation-text">{result.pronunciation.uk}</span>
                              <button className="speaker-btn" onClick={() => playPronunciation(wordToPronounce, 'en-GB')}>🔊</button>
                            </div>
                            <div className="pronunciation-item">
                              <img src="https://flagcdn.com/w40/us.png" alt="US" className="flag-icon" width="24" height="16" />
                              <span className="pronunciation-label">US</span>
                              <span className="pronunciation-text">{result.pronunciation.us}</span>
                              <button className="speaker-btn" onClick={() => playPronunciation(wordToPronounce, 'en-US')}>🔊</button>
                            </div>
                          </div>
                        )}
                        {!result.pronunciation && targetLang === 'zh' && (
                          <button className="speaker-btn" onClick={() => playPronunciation(result.word, 'zh-CN')}>🔊</button>
                        )}
                        {!result.pronunciation && targetLang === 'ko' && (
                          <button className="speaker-btn" onClick={() => playPronunciation(result.word, 'ko-KR')}>🔊</button>
                        )}
                      </div>
                      {result.meanings && result.meanings.length > 0 && (
                        <div className="meanings-section">
                          {result.meanings.map((meaning, idx) => (
                            <div key={idx} className="meaning-item">
                              <div className="meaning-number">{meaning.number}</div>
                              <div className="meaning-content">
                                <div className="meaning-translation-container">
                                  <div className="meaning-translation">{meaning.translation}</div>
                                  {targetLang === 'zh' && meaning.translation && (
                                    <button className="example-speaker-btn" onClick={() => playPronunciation(meaning.translation, 'zh-CN')}>🔊</button>
                                  )}
                                  {targetLang === 'ko' && meaning.translation && (
                                    <button className="example-speaker-btn" onClick={() => playPronunciation(meaning.translation, 'ko-KR')}>🔊</button>
                                  )}
                                </div>
                                {(meaning.exampleKo || meaning.exampleEn || meaning.exampleZh) && (
                                  <div className="meaning-examples">
                                    {meaning.exampleKo && (
                                      <div className="example-ko-container">
                                        <div className="example-ko">{meaning.exampleKo}</div>
                                        <button className="example-speaker-btn" onClick={() => playPronunciation(meaning.exampleKo, 'ko-KR')}>🔊</button>
                                      </div>
                                    )}
                                    {meaning.exampleZh && (
                                      <div className="example-zh-container">
                                        <div className="example-zh">{meaning.exampleZh}</div>
                                        <button className="example-speaker-btn" onClick={() => playPronunciation(meaning.exampleZh, 'zh-CN')}>🔊</button>
                                      </div>
                                    )}
                                    {meaning.exampleEn && (
                                      <div className="example-en-container">
                                        <div className="example-en">{meaning.exampleEn}</div>
                                        <button className="example-speaker-btn" onClick={() => playPronunciation(meaning.exampleEn, 'en-US')}>🔊</button>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {result.translation && (<div className="result-translation">{result.translation}</div>)}
                    </div>
                  )
                })}
              </div>
            ) : (<div className="no-results">{searchTerm ? 'No results found.' : 'Enter a search term.'}</div>)}
          </div>
        </div>
        {/* 검색 히스토리 표시 */}
        {searchHistory.length > 0 && (
          <div className="search-history-bar">
            <div className="history-words">
              {searchHistory.map((item, index) => (
                <span key={index} className="history-item">
                  <span 
                    className="history-word" 
                    onClick={() => {
                      setSearchTerm(item.word)
                      searchWithWord(item.word)
                    }}
                  >
                    {item.word}
                  </span>
                  <span 
                    className="history-delete"
                    onClick={(e) => {
                      e.stopPropagation()
                      setSearchHistory(prev => {
                        const newHistory = prev.filter((_, i) => i !== index)
                        if (historyIndex >= index) {
                          setHistoryIndex(Math.max(-1, historyIndex - 1))
                        }
                        return newHistory
                      })
                    }}
                  >
                    ✕
                  </span>
                  {index < searchHistory.length - 1 && <span className="history-separator">|</span>}
                </span>
              ))}
            </div>
            <button 
              className="history-clear-btn"
              onClick={() => {
                setSearchHistory([])
                setHistoryIndex(-1)
              }}
            >
              Clear
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default Dictionary
