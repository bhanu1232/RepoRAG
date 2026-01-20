import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

mermaid.initialize({
    startOnLoad: false,
    theme: 'dark',
    securityLevel: 'loose',
    fontFamily: 'Inter, system-ui, sans-serif'
});

const MermaidDiagram = ({ chart }) => {
    const mermaidRef = useRef(null);
    const [svg, setSvg] = useState('');
    const [error, setError] = useState(null);

    useEffect(() => {
        const renderDiagram = async () => {
            try {
                if (chart) {
                    const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
                    const { svg } = await mermaid.render(id, chart);
                    setSvg(svg);
                    setError(null);
                }
            } catch (err) {
                console.error('Mermaid rendering error:', err);
                setError('Failed to render diagram');
                // The diagram might be invalid while typing, so we can just show the raw code
            }
        };

        renderDiagram();
    }, [chart]);

    if (error) {
        return (
            <div className="p-4 bg-red-900/20 border border-red-800 rounded-lg text-red-200 text-sm font-mono whitespace-pre-wrap">
                {chart}
            </div>
        );
    }

    return (
        <div
            className="my-6 p-4 bg-[#1e1e1e] rounded-lg border border-gray-700 overflow-x-auto flex justify-center"
            dangerouslySetInnerHTML={{ __html: svg }}
        />
    );
};

export default MermaidDiagram;
