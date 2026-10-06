import React, { useEffect, useState } from 'react';
import mermaid from 'mermaid';
import { PrismAsyncLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

// Initialize mermaid with suppressErrorRendering to prevent error DOM pollution
mermaid.initialize({
    startOnLoad: false,
    theme: 'dark',
    securityLevel: 'loose',
    suppressErrorRendering: true,
    fontFamily: 'Inter, system-ui, sans-serif'
});

/**
 * Sanitize common LLM Mermaid syntax quirks:
 * 1. Strip code fence wrappers (```mermaid ... ```)
 * 2. Auto-quote node labels containing parentheses/brackets: A[Text (Detail)] -> A["Text (Detail)"]
 * 3. Remove Markdown bold/italic within node labels
 */
const sanitizeMermaidChart = (rawChart) => {
    if (!rawChart) return '';
    let chart = rawChart.trim();
    
    // Remove markdown code fences if present
    chart = chart.replace(/^```(?:mermaid)?\n?/, '').replace(/\n?```$/, '').trim();
    
    // Auto-fix unquoted node labels with special characters like parentheses
    chart = chart.replace(/\[([^[\]"']*\([^)]+\)[^[\]"']*)\]/g, '["$1"]');
    
    // Ensure chart starts with valid mermaid graph keyword
    const validKeywords = ['graph', 'flowchart', 'sequenceDiagram', 'classDiagram', 'stateDiagram', 'erDiagram', 'gantt', 'pie', 'mindmap', 'timeline', 'gitGraph', 'C4Context'];
    const firstWord = chart.split(/[\s\n]+/)[0];
    
    if (!validKeywords.some(k => chart.startsWith(k))) {
        // If it looks like nodes/arrows without header, default to graph TD
        if (chart.includes('-->') || chart.includes('---|') || chart.includes('-.->')) {
            chart = `graph TD\n${chart}`;
        }
    }
    
    return chart;
};

const MermaidDiagram = ({ chart }) => {
    const [svg, setSvg] = useState('');
    const [renderFailed, setRenderFailed] = useState(false);

    useEffect(() => {
        let isMounted = true;
        const cleanChart = sanitizeMermaidChart(chart);

        if (!cleanChart) {
            setRenderFailed(true);
            return;
        }

        const renderDiagram = async () => {
            const uniqueId = `mermaid-${Math.random().toString(36).substring(2, 9)}`;
            
            try {
                // Validate syntax first
                const isValid = await mermaid.parse(cleanChart).catch(() => false);
                if (!isValid) {
                    if (isMounted) setRenderFailed(true);
                    return;
                }

                // Render valid diagram
                const { svg: renderedSvg } = await mermaid.render(uniqueId, cleanChart);
                if (isMounted) {
                    setSvg(renderedSvg);
                    setRenderFailed(false);
                }
            } catch (err) {
                // Silently fallback without polluting DOM
                if (isMounted) {
                    setRenderFailed(true);
                }
            } finally {
                // Clean up any stray temporary elements created by mermaid
                const strayEl = document.getElementById(uniqueId) || document.getElementById(`d${uniqueId}`);
                if (strayEl && strayEl.parentNode) {
                    strayEl.parentNode.removeChild(strayEl);
                }
            }
        };

        renderDiagram();

        return () => {
            isMounted = false;
        };
    }, [chart]);

    // Graceful fallback to formatted code block if mermaid syntax is invalid
    if (renderFailed || !svg) {
        return (
            <div className="rounded-lg overflow-hidden my-3 border border-white/10 bg-[#0d1117]">
                <div className="flex items-center justify-between px-3 py-1.5 bg-white/5 border-b border-white/10 text-xs text-zinc-400">
                    <span className="font-mono">diagram (syntax preview)</span>
                </div>
                <SyntaxHighlighter
                    style={vscDarkPlus}
                    language="markdown"
                    customStyle={{
                        margin: 0,
                        padding: '1rem',
                        background: 'transparent',
                        fontSize: '13px',
                        lineHeight: '1.5'
                    }}
                >
                    {chart}
                </SyntaxHighlighter>
            </div>
        );
    }

    return (
        <div
            className="my-4 p-4 bg-[#18181b]/90 rounded-xl border border-white/10 overflow-x-auto flex justify-center shadow-lg"
            dangerouslySetInnerHTML={{ __html: svg }}
        />
    );
};

export default React.memo(MermaidDiagram);
