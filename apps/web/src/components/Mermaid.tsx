import { useEffect, useRef } from 'react';
import mermaid from 'mermaid';
import { v4 as uuidv4 } from 'uuid';

mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  securityLevel: 'loose',
});

export default function Mermaid({ chart }: { chart: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useRef(`mermaid-${uuidv4()}`);

  useEffect(() => {
    const isDark = document.documentElement.classList.contains('dark');
    mermaid.initialize({
      startOnLoad: false,
      theme: isDark ? 'dark' : 'neutral',
      securityLevel: 'loose',
    });

    if (ref.current) {
      try {
        mermaid.render(id.current, chart).then((result) => {
          if (ref.current) {
            ref.current.innerHTML = result.svg;
          }
        });
      } catch (e) {
        console.error(e);
      }
    }
  }, [chart]);

  return <div ref={ref} className="mermaid flex justify-center my-4 overflow-x-auto bg-[var(--surface)] p-4 rounded-[var(--radius)] border border-[var(--border)]" />;
}
