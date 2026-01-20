import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Folder, Copy, Check } from 'lucide-react';

const CollapsibleFileTree = ({ content }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [copied, setCopied] = useState(false);

    const copyToClipboard = () => {
        navigator.clipboard.writeText(content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // Show first 5 lines as preview
    const lines = content.split('\n');
    const previewLines = lines.slice(0, 5);
    const hasMore = lines.length > 5;

    return (
        <div className="my-4 rounded-lg overflow-hidden bg-[#1e1e1e] border border-gray-700">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2 bg-[#2d2d30] border-b border-gray-700">
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="flex items-center gap-2 text-xs text-gray-400 font-medium hover:text-gray-200 transition-colors"
                >
                    {isExpanded ? (
                        <ChevronDown className="w-4 h-4" />
                    ) : (
                        <ChevronRight className="w-4 h-4" />
                    )}
                    <Folder className="w-4 h-4" />
                    <span>File Structure {hasMore && !isExpanded && `(${lines.length} lines)`}</span>
                </button>
                <button
                    onClick={copyToClipboard}
                    className="flex items-center gap-1.5 px-2 py-1 text-xs text-gray-400 hover:text-gray-200 hover:bg-gray-700 rounded transition-colors"
                >
                    {copied ? (
                        <>
                            <Check className="h-3.5 w-3.5" />
                            Copied!
                        </>
                    ) : (
                        <>
                            <Copy className="h-3.5 w-3.5" />
                            Copy
                        </>
                    )}
                </button>
            </div>

            {/* Content */}
            <pre className="p-4 overflow-x-auto">
                <code className="text-sm font-mono text-gray-300 leading-relaxed whitespace-pre">
                    {isExpanded ? content : previewLines.join('\n')}
                    {!isExpanded && hasMore && (
                        <span className="block mt-2 text-gray-500 italic">
                            ... {lines.length - 5} more lines (click to expand)
                        </span>
                    )}
                </code>
            </pre>
        </div>
    );
};

export default CollapsibleFileTree;
