import { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, prism } from 'react-syntax-highlighter/dist/esm/styles/prism';

export default function CollapsibleCode({ language, value }: { language: string, value: string }) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [copied, setCopied] = useState(false);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const checkDark = () => {
      setIsDark(document.documentElement.classList.contains('dark'));
    };
    checkDark();
    
    const observer = new MutationObserver(checkDark);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-4 bg-[var(--surface)] rounded-[var(--radius)] overflow-hidden border border-[var(--border)] shadow-sm">
      <div className="flex items-center justify-between px-4 py-2 bg-[var(--surface)] text-xs text-gray-500 dark:text-gray-400 select-none border-b border-[var(--border)]">
        <div className="flex items-center gap-2 cursor-pointer hover:text-[var(--foreground)] transition-colors" onClick={() => setIsExpanded(!isExpanded)}>
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          <span className="font-medium uppercase tracking-wider">{language || 'text'}</span>
        </div>
        <button onClick={handleCopy} className="hover:text-[var(--foreground)] flex items-center gap-1 transition-colors">
          {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      {isExpanded && (
        <div className="bg-[var(--surface)]">
          <SyntaxHighlighter
            style={isDark ? vscDarkPlus : prism}
            language={language}
            PreTag="div"
            customStyle={{ 
              margin: 0, 
              padding: '1.25rem', 
              background: 'transparent',
              fontSize: '13px',
              lineHeight: '1.6'
            }}
            className="scrollbar-thin"
          >
            {value}
          </SyntaxHighlighter>
        </div>
      )}
    </div>
  );
}
