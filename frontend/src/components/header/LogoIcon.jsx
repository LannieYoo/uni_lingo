import './header.css'

function LogoIcon() {
  return (
    <svg 
      viewBox="0 0 80 48" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className="logo-svg"
    >
      <defs>
        <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#60a5fa" />
        </linearGradient>
      </defs>
      
      {/* 왼쪽 말풍선 */}
      <path 
        d="M8 12 C8 8 12 4 16 4 L28 4 C32 4 36 8 36 12 L36 20 C36 24 32 28 28 28 L20 28 L12 36 L12 28 L16 28 C12 28 8 24 8 20 Z" 
        fill="url(#logoGradient)"
      />
      
      {/* 왼쪽 말풍선 내부 텍스트 */}
      <text 
        x="22" 
        y="18" 
        fontSize="12" 
        fontWeight="700" 
        fill="white"
        textAnchor="middle"
        fontFamily="system-ui, -apple-system, sans-serif"
      >
        한
      </text>
      
      {/* 화살표 */}
      <path 
        d="M40 24 L48 24 M44 20 L48 24 L44 28" 
        stroke="url(#logoGradient)" 
        strokeWidth="3.5" 
        strokeLinecap="round" 
        strokeLinejoin="round"
        fill="none"
      />
      
      {/* 오른쪽 말풍선 */}
      <path 
        d="M52 12 C52 8 56 4 60 4 L72 4 C76 4 80 8 80 12 L80 20 C80 24 76 28 72 28 L64 28 L56 36 L56 28 L60 28 C56 28 52 24 52 20 Z" 
        fill="url(#logoGradient)"
      />
      
      {/* 오른쪽 말풍선 내부 텍스트 */}
      <text 
        x="66" 
        y="18" 
        fontSize="12" 
        fontWeight="700" 
        fill="white"
        textAnchor="middle"
        fontFamily="system-ui, -apple-system, sans-serif"
      >
        A
      </text>
    </svg>
  )
}

export default LogoIcon

