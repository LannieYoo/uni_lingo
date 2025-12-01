import { useState, useEffect, useRef } from 'react'
import './dictionary.css'
// @ts-ignore
import config from './dictionary-config.json'

function Dictionary() {
  const [searchTerm, setSearchTerm] = useState('')
  const [searchDirection, setSearchDirection] = useState(config.defaultSearchDirection)
  const [results, setResults] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [isManualChange, setIsManualChange] = useState(false)
  const [detectedLanguage, setDetectedLanguage] = useState(null)
  
  const abortControllerRef = useRef(null)
  const currentSearchTermRef = useRef('')

  const directions = config.directions

  const getLanguageName = (lang) => {
    return config.languageNames[lang] || lang
  }
