interface GeminiLogoProps {
  className?: string;
}

export default function GeminiLogo({ className }: GeminiLogoProps) {
  return (
    <svg 
      viewBox="0 0 24 24" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path 
        d="M12 0C12 6.62742 6.62742 12 0 12C6.62742 12 12 17.3726 12 24C12 17.3726 17.3726 12 24 12C17.3726 12 12 6.62742 12 0Z" 
        fill="url(#gemini-gradient)"
      />
      <defs>
        <linearGradient id="gemini-gradient" x1="0" y1="12" x2="24" y2="12" gradientUnits="userSpaceOnUse">
          <stop stopColor="#4E82EE" />
          <stop offset="1" stopColor="#A15EE3" />
        </linearGradient>
      </defs>
    </svg>
  );
}
