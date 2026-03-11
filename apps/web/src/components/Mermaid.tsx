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

  return <div ref={ref} className="mermaid flex justify-center my-4 overflow-x-auto bg-gray-800 p-4 rounded-lg" />;
}
