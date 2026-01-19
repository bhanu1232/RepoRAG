import React from 'react';
import { FileCode, FileText, Code2, Terminal, TrendingUp } from 'lucide-react';

const getFileIcon = (filename) => {
    if (!filename) return <FileText className="h-3.5 w-3.5" />;
    if (filename.endsWith('.py')) return <img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/python/python-original.svg" className="h-3.5 w-3.5" alt="py" />;
    if (filename.endsWith('.js')) return <img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/javascript/javascript-original.svg" className="h-3.5 w-3.5" alt="js" />;
    if (filename.endsWith('.tsx') || filename.endsWith('.ts')) return <img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/typescript/typescript-original.svg" className="h-3.5 w-3.5" alt="ts" />;
    if (filename.endsWith('.jsx')) return <img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/react/react-original.svg" className="h-3.5 w-3.5" alt="react" />;
    if (filename.endsWith('.md')) return <FileText className="h-3.5 w-3.5 text-slate-400" />;
    if (filename.endsWith('.json')) return <Code2 className="h-3.5 w-3.5 text-yellow-500" />;
    return <Terminal className="h-3.5 w-3.5 text-slate-400" />;
};

const getRelevanceColor = (score) => {
    if (!score) return 'text-zinc-500';
    if (score >= 0.7) return 'text-emerald-400';
    if (score >= 0.4) return 'text-blue-400';
    return 'text-amber-400';
};

const getRelevanceBg = (score) => {
    if (!score) return 'bg-zinc-500/10 border-zinc-500/20';
    if (score >= 0.7) return 'bg-emerald-500/10 border-emerald-500/20';
    if (score >= 0.4) return 'bg-blue-500/10 border-blue-500/20';
    return 'bg-amber-500/10 border-amber-500/20';
};

const SourceList = ({ sources }) => {
    if (!sources || sources.length === 0) return null;

    // Deduplicate sources based on file and lines
    const uniqueSources = sources.filter((source, index, self) =>
        index === self.findIndex((t) => (
            t.file === source.file && t.lines === source.lines
        ))
    );

    // Sort by score (highest first)
    const sortedSources = [...uniqueSources].sort((a, b) => {
        const scoreA = a.score || 0;
        const scoreB = b.score || 0;
        return scoreB - scoreA;
    });

    return (
        <div className="mt-6 pt-4 border-t border-white/5 animate-fadeIn">
            <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                <FileCode className="h-3 w-3" />
                Reference Context ({sortedSources.length} sources)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {sortedSources.map((source, index) => (
                    <div
                        key={index}
                        className="group flex flex-col bg-zinc-900/50 hover:bg-zinc-800 border border-white/5 hover:border-white/10 rounded-lg p-2.5 transition-all duration-200 cursor-default"
                    >
                        <div className="flex items-start gap-2.5 mb-1.5">
                            <div className="mt-0.5 shrink-0 opacity-70 group-hover:opacity-100 transition-opacity">
                                {getFileIcon(source.file)}
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="text-xs font-medium text-zinc-300 truncate group-hover:text-emerald-400 transition-colors" title={source.file}>
                                    {source.file.split('/').pop()}
                                </div>
                                <div className="text-[10px] text-zinc-500 truncate" title={source.file}>
                                    {source.file}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 pl-6">
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-white/5 text-zinc-400 border border-white/5 group-hover:border-white/10 group-hover:bg-white/10 transition-colors font-mono">
                                L{source.lines}
                            </span>

                            {source.score !== null && source.score !== undefined && (
                                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border ${getRelevanceBg(source.score)} ${getRelevanceColor(source.score)} transition-colors`}>
                                    <TrendingUp className="h-2.5 w-2.5" />
                                    {Math.round(source.score * 100)}%
                                </span>
                            )}

                            {source.category === 'code' && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">
                                    CODE
                                </span>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default SourceList;
