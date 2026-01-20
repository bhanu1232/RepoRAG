import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { PrismAsyncLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';
import { User, Copy, Check } from 'lucide-react';
import SourceList from './SourceList';
import CollapsibleFileTree from './CollapsibleFileTree';
import logo from "../assets/logo.png"
const MessageBubble = ({ message }) => {
    const isUser = message.role === 'user';
    const [copied, setCopied] = useState(false);

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // Get confidence badge
    const getConfidenceBadge = () => {
        if (!message.confidence || isUser) return null;

        const { level, score } = message.confidence;

        const badges = {
            high: {
                color: 'text-emerald-700 dark:text-emerald-400',
                bg: 'bg-emerald-100 dark:bg-emerald-900/30',
                label: 'High Confidence'
            },
            medium: {
                color: 'text-blue-700 dark:text-blue-400',
                bg: 'bg-blue-100 dark:bg-blue-900/30',
                label: 'Medium Confidence'
            },
            low: {
                color: 'text-amber-700 dark:text-amber-400',
                bg: 'bg-amber-100 dark:bg-amber-900/30',
                label: 'Limited Confidence'
            }
        };

        const badge = badges[level] || badges.medium;

        return (
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${badge.bg} ${badge.color}`}>
                {Math.round(score * 100)}% confidence
            </span>
        );
    };

    return (
        <div className={`w-full border-b border-gray-100 dark:border-gray-800 ${isUser ? 'bg-white dark:bg-[#212121]' : 'bg-gray-50 dark:bg-[#2f2f2f]'}`}>
            <div className="max-w-3xl mx-auto px-4 py-6">
                <div className="flex items-start gap-4">
                    {/* Avatar */}
                    <div className="flex-shrink-0">
                        <div className={`w-8 h-8 rounded-sm flex items-center justify-center ${isUser ? 'bg-gray-200 dark:bg-gray-700' : 'bg-emerald-600'}`}>
                            {isUser ? (
                                <User className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                            ) : (
                                <img src={logo} alt="" />
                            )}
                        </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm mb-2 text-gray-900 dark:text-gray-100 flex items-center gap-2">
                            {isUser ? 'You' : 'RepoRAG'}
                            {!isUser && getConfidenceBadge()}
                        </div>

                        {isUser ? (
                            <div className="text-[15px] leading-7 text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                                {message.content}
                            </div>
                        ) : (
                            <div className="prose prose-sm md:prose-base dark:prose-invert max-w-none
                                prose-headings:font-bold prose-headings:text-gray-900 dark:prose-headings:text-gray-100 prose-headings:tracking-tight prose-headings:leading-tight
                                prose-h1:text-2xl prose-h1:mt-8 prose-h1:mb-5 prose-h1:border-b-2 prose-h1:border-gray-200 dark:prose-h1:border-gray-700 prose-h1:pb-3
                                prose-h2:text-xl prose-h2:mt-8 prose-h2:mb-4
                                prose-h3:text-lg prose-h3:mt-6 prose-h3:mb-3 prose-h3:text-emerald-700 dark:prose-h3:text-emerald-400
                                prose-h4:text-base prose-h4:mt-5 prose-h4:mb-2.5
                                prose-p:text-gray-800 dark:prose-p:text-gray-200 prose-p:leading-[1.8] prose-p:my-5 prose-p:text-[15px] prose-p:text-justify
                                prose-li:text-gray-800 dark:prose-li:text-gray-200 prose-li:my-3 prose-li:leading-[1.8] prose-li:text-[15px] prose-li:pl-2
                                prose-ul:my-5 prose-ul:space-y-3 prose-ul:list-disc prose-ul:pl-6 prose-ul:marker:text-emerald-600 dark:prose-ul:marker:text-emerald-400
                                prose-ol:my-5 prose-ol:space-y-3 prose-ol:list-decimal prose-ol:pl-6 prose-ol:marker:text-emerald-600 dark:prose-ol:marker:text-emerald-400 prose-ol:marker:font-semibold
                                prose-strong:text-gray-900 dark:prose-strong:text-gray-100 prose-strong:font-bold
                                prose-em:text-gray-800 dark:prose-em:text-gray-200 prose-em:italic
                                prose-code:bg-gray-200 dark:prose-code:bg-gray-800 prose-code:text-emerald-700 dark:prose-code:text-emerald-400 prose-code:px-2 prose-code:py-1 prose-code:rounded-md prose-code:text-[13px] prose-code:font-mono prose-code:before:content-none prose-code:after:content-none prose-code:font-semibold
                                prose-pre:bg-black dark:prose-pre:bg-black prose-pre:p-0 prose-pre:rounded-lg prose-pre:my-6 prose-pre:shadow-xl prose-pre:ring-1 prose-pre:ring-gray-800
                                prose-a:text-emerald-600 dark:prose-a:text-emerald-400 prose-a:no-underline hover:prose-a:underline prose-a:font-medium prose-a:transition-all
                                prose-blockquote:border-l-4 prose-blockquote:border-l-emerald-500 dark:prose-blockquote:border-l-emerald-400 prose-blockquote:pl-5 prose-blockquote:pr-4 prose-blockquote:italic prose-blockquote:text-gray-700 dark:prose-blockquote:text-gray-300 prose-blockquote:my-6 prose-blockquote:bg-gray-50 dark:prose-blockquote:bg-gray-800/50 prose-blockquote:py-4 prose-blockquote:rounded-r-md prose-blockquote:shadow-sm
                                prose-hr:border-gray-300 dark:prose-hr:border-gray-700 prose-hr:my-8 prose-hr:border-t-2
                                prose-table:border-collapse prose-table:my-6 prose-table:w-full prose-table:shadow-sm prose-table:rounded-lg prose-table:overflow-hidden
                                prose-thead:bg-gray-100 dark:prose-thead:bg-gray-800
                                prose-th:bg-gray-100 dark:prose-th:bg-gray-800 prose-th:p-3 prose-th:border prose-th:border-gray-300 dark:prose-th:border-gray-700 prose-th:font-bold prose-th:text-left
                                prose-td:p-3 prose-td:border prose-td:border-gray-300 dark:prose-td:border-gray-700 prose-td:align-top
                                prose-tr:even:bg-gray-50 dark:prose-tr:even:bg-gray-900/30
                                prose-img:rounded-lg prose-img:shadow-md prose-img:my-6
                            ">
                                <ReactMarkdown
                                    remarkPlugins={[remarkGfm]}
                                    components={{
                                        code({ node, inline, className, children, ...props }) {
                                            const match = /language-(\w+)/.exec(className || '');
                                            const codeString = String(children).replace(/\n$/, '');

                                            // Detect file tree structure - VERY strict
                                            const hasTreeChars = (codeString.includes('├──') || codeString.includes('└──')) &&
                                                codeString.includes('│');

                                            // Check if it looks like programming code (not a command)
                                            const hasProgrammingSyntax = codeString.includes('(') ||
                                                codeString.includes('{') ||
                                                codeString.includes('[') ||
                                                codeString.includes(';') ||
                                                codeString.includes('function') ||
                                                codeString.includes('class') ||
                                                codeString.includes('def ') ||
                                                codeString.includes('import ') ||
                                                codeString.includes('const ') ||
                                                codeString.includes('let ') ||
                                                codeString.includes('var ') ||
                                                codeString.includes('return ');

                                            // Only treat as command if it's explicitly marked as shell or looks like shell commands
                                            const isShellLanguage = match?.[1] === 'bash' ||
                                                match?.[1] === 'sh' ||
                                                match?.[1] === 'shell' ||
                                                match?.[1] === 'cmd' ||
                                                match?.[1] === 'powershell';

                                            const looksLikeShellCommand = !hasProgrammingSyntax && (
                                                codeString.startsWith('$ ') ||
                                                codeString.startsWith('npm ') ||
                                                codeString.startsWith('git ') ||
                                                codeString.startsWith('cd ') ||
                                                codeString.startsWith('mkdir ') ||
                                                codeString.startsWith('pip ') ||
                                                codeString.startsWith('python ') ||
                                                codeString.match(/^[a-z-]+\s+(install|run|start|build|test)/)
                                            );

                                            const isFileTree = !inline && hasTreeChars && !looksLikeShellCommand && (
                                                !match ||
                                                match[1] === 'tree' ||
                                                match[1] === 'text' ||
                                                match[1] === 'plaintext'
                                            );

                                            // Detect shell commands - ONLY if explicitly marked or clearly shell commands
                                            const isCommand = !inline && !hasTreeChars && (isShellLanguage || looksLikeShellCommand);

                                            // Render file tree with collapsible component
                                            if (isFileTree) {
                                                return <CollapsibleFileTree content={codeString} />;
                                            }

                                            // Render command block
                                            if (isCommand) {
                                                return (
                                                    <div className="my-4 rounded-lg overflow-hidden bg-[#0d1117] border border-emerald-900/50">
                                                        <div className="flex items-center justify-between px-4 py-2 bg-emerald-950/50 border-b border-emerald-900/50">
                                                            <span className="text-xs text-emerald-400 font-medium flex items-center gap-2">
                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                                </svg>
                                                                Command
                                                            </span>
                                                            <button
                                                                onClick={() => copyToClipboard(codeString)}
                                                                className="flex items-center gap-1.5 px-2 py-1 text-xs text-emerald-400 hover:text-emerald-300 hover:bg-emerald-900/30 rounded transition-colors"
                                                            >
                                                                {copied ? (
                                                                    <>
                                                                        <Check className="h-3.5 w-3.5" />
                                                                        Copied!
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <Copy className="h-3.5 w-3.5" />
                                                                        Copy command
                                                                    </>
                                                                )}
                                                            </button>
                                                        </div>
                                                        <pre className="p-4 overflow-x-auto">
                                                            <code className="text-sm font-mono text-emerald-300 leading-relaxed whitespace-pre">
                                                                {codeString}
                                                            </code>
                                                        </pre>
                                                    </div>
                                                );
                                            }

                                            // Regular code block
                                            return !inline && match ? (
                                                <div className="relative my-4 rounded-lg overflow-hidden bg-black">
                                                    {/* Code Header */}
                                                    <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800">
                                                        <span className="text-xs text-gray-400 font-medium">
                                                            {match[1]}
                                                        </span>
                                                        <button
                                                            onClick={() => copyToClipboard(codeString)}
                                                            className="flex items-center gap-1.5 px-2 py-1 text-xs text-gray-400 hover:text-gray-200 hover:bg-gray-800 rounded transition-colors"
                                                        >
                                                            {copied ? (
                                                                <>
                                                                    <Check className="h-3.5 w-3.5" />
                                                                    Copied!
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <Copy className="h-3.5 w-3.5" />
                                                                    Copy code
                                                                </>
                                                            )}
                                                        </button>
                                                    </div>
                                                    {/* Syntax Highlighter */}
                                                    <div className="overflow-x-auto">
                                                        <SyntaxHighlighter
                                                            {...props}
                                                            style={vscDarkPlus}
                                                            language={match[1]}
                                                            PreTag="div"
                                                            customStyle={{
                                                                margin: 0,
                                                                padding: '1rem',
                                                                background: '#000000',
                                                                fontSize: '14px',
                                                                lineHeight: '1.5',
                                                            }}
                                                        >
                                                            {codeString}
                                                        </SyntaxHighlighter>
                                                    </div>
                                                </div>
                                            ) : (
                                                <code className={className} {...props}>
                                                    {children}
                                                </code>
                                            )
                                        }
                                    }}
                                >
                                    {message.content}
                                </ReactMarkdown>

                                {/* Sources */}
                                {message.sources && <SourceList sources={message.sources} />}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MessageBubble;
