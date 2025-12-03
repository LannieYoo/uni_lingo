import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import './header.css'
import LogoIcon from './LogoIcon'

function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const location = useLocation()

  const menuItems = [
    { path: '/', label: 'Translator', name: 'home' },
    { path: '/dictionary', label: 'Dictionary', name: 'dictionary' },
    { path: '/text-to-speech', label: 'Text to Speech', name: 'textToSpeech' },
    { path: '/speech-to-text', label: 'Speech to Text', name: 'speechToText' },
    { path: '/speech-to-recording', label: 'Recording', name: 'recording' },
    { path: '/translator', label: 'Translate', name: 'translator' },
  ]

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen)
  }

  const closeMenu = () => {
    setIsMenuOpen(false)
  }

  return (
    <header className="header">
      <div className="header-container">
        <Link to="/" className="logo" onClick={closeMenu}>
          <div className="logo-icon-wrapper">
            <LogoIcon />
          </div>
          <span className="logo-text">Speaking to Text</span>
        </Link>

        <nav className={`nav ${isMenuOpen ? 'nav-open' : ''}`}>
          <ul className="nav-list">
            {menuItems.map((item) => (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={`nav-link ${location.pathname === item.path ? 'active' : ''}`}
                  onClick={closeMenu}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <button 
          className="hamburger"
          onClick={toggleMenu}
          aria-label="Toggle menu"
        >
          <span className={`hamburger-line ${isMenuOpen ? 'open' : ''}`}></span>
          <span className={`hamburger-line ${isMenuOpen ? 'open' : ''}`}></span>
          <span className={`hamburger-line ${isMenuOpen ? 'open' : ''}`}></span>
        </button>
      </div>
    </header>
  )
}

export default Header

