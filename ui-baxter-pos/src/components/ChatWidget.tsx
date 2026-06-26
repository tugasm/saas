'use client';

import { useEffect, useRef, useState } from 'react';
import { X, Send, Loader2, Sparkles, Trash2 } from 'lucide-react';
import api from '@/lib/api';
import InfoBaxterArtifacts, { Artifact } from './InfoBaxterArtifacts';

interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
    artifacts?: Artifact[];
}

const QUICK_PROMPTS = [
    'Bagaimana performa bisnis hari ini?',
    'Tampilkan grafik tren omzet 7 hari terakhir',
    'Top 5 service paling laku bulan ini',
    'Download CSV transaksi bulan ini',
    'Member yang expired dalam 14 hari',
];

function renderMarkdown(text: string) {
    const lines = text.split('\n');
    return lines.map((line, idx) => {
        if (line.startsWith('## ')) return <p key={idx} className="font-bold text-base mt-2 mb-1">{line.slice(3)}</p>;
        if (line.startsWith('# ')) return <p key={idx} className="font-bold text-lg mt-2 mb-1">{line.slice(2)}</p>;
        if (/^[-*]\s/.test(line)) {
            return <div key={idx} className="ml-3 leading-relaxed">• {renderInline(line.slice(2))}</div>;
        }
        if (line.trim() === '') return <div key={idx} className="h-1.5" />;
        return <div key={idx} className="leading-relaxed">{renderInline(line)}</div>;
    });
}

function renderInline(line: string): React.ReactNode[] {
    const parts: React.ReactNode[] = [];
    const regex = /\*\*([^*]+)\*\*|`([^`]+)`/g;
    let lastIdx = 0;
    let match;
    let key = 0;
    while ((match = regex.exec(line)) !== null) {
        if (match.index > lastIdx) parts.push(line.slice(lastIdx, match.index));
        if (match[1]) parts.push(<strong key={key++} className="font-semibold">{match[1]}</strong>);
        else if (match[2]) parts.push(<code key={key++} className="bg-gray-100 text-pink-600 px-1 py-0.5 rounded text-xs font-mono">{match[2]}</code>);
        lastIdx = match.index + match[0].length;
    }
    if (lastIdx < line.length) parts.push(line.slice(lastIdx));
    return parts;
}

export default function ChatWidget() {
    const [open, setOpen] = useState(false);
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [loading, setLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }, [messages, loading]);

    const send = async (text: string) => {
        const content = text.trim();
        if (!content || loading) return;
        const newMessages: ChatMessage[] = [...messages, { role: 'user', content }];
        setMessages(newMessages);
        setInput('');
        setLoading(true);
        try {
            const payload = newMessages.map(({ role, content }) => ({ role, content }));
            const res = await api.post('/admin/ai/chat', { messages: payload });
            const reply = res.data?.reply || 'Maaf, tidak ada balasan.';
            const artifacts: Artifact[] = res.data?.artifacts || [];
            setMessages([...newMessages, { role: 'assistant', content: reply, artifacts }]);
        } catch (e: any) {
            const err = e?.response?.data?.error || e?.message || 'Gagal menghubungi AI';
            setMessages([...newMessages, { role: 'assistant', content: `⚠️ ${err}` }]);
        } finally {
            setLoading(false);
        }
    };

    const reset = () => { setMessages([]); setInput(''); };

    return (
        <>
            {!open && (
                <button
                    onClick={() => setOpen(true)}
                    className="fixed bottom-6 right-6 z-40 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-full shadow-soft-lg p-4 flex items-center gap-2 transition-all hover:scale-105"
                    aria-label="Open Info Baxter"
                >
                    <Sparkles size={20} />
                    <span className="font-bold text-sm pr-1">Info Baxter</span>
                </button>
            )}

            {open && (
                <div className="fixed bottom-6 right-6 z-40 w-[calc(100vw-2rem)] sm:w-[480px] h-[640px] max-h-[calc(100vh-3rem)] bg-white rounded-3xl shadow-soft-xl flex flex-col overflow-hidden border border-gray-100">
                    <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-5 py-4 flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-2">
                            <div className="bg-white/20 rounded-xl p-1.5 backdrop-blur-md">
                                <Sparkles size={18} />
                            </div>
                            <div>
                                <p className="font-bold text-sm">Info Baxter</p>
                                <p className="text-xs text-white/70">Tanya soal penjualan, member, transaksi</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-1">
                            {messages.length > 0 && (
                                <button onClick={reset} className="p-2 rounded-xl hover:bg-white/10 active:bg-white/20 transition" aria-label="Reset chat">
                                    <Trash2 size={16} />
                                </button>
                            )}
                            <button onClick={() => setOpen(false)} className="p-2 rounded-xl hover:bg-white/10 active:bg-white/20 transition" aria-label="Close">
                                <X size={18} />
                            </button>
                        </div>
                    </div>

                    <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-gray-50 custom-scrollbar">
                        {messages.length === 0 && !loading && (
                            <div className="space-y-3">
                                <div className="bg-white rounded-2xl p-4 shadow-soft">
                                    <p className="text-sm text-gray-700 leading-relaxed">
                                        Halo! Saya bisa bantu cek pendapatan, transaksi, member, cashflow, dan top services. Coba salah satu pertanyaan di bawah:
                                    </p>
                                </div>
                                {QUICK_PROMPTS.map((q, i) => (
                                    <button
                                        key={i}
                                        onClick={() => send(q)}
                                        className="w-full text-left bg-white hover:bg-blue-50 active:bg-blue-100 rounded-2xl px-4 py-3 text-sm text-gray-700 shadow-soft transition border border-gray-100"
                                    >
                                        {q}
                                    </button>
                                ))}
                            </div>
                        )}

                        {messages.map((m, i) => {
                            const hasArtifacts = m.role === 'assistant' && m.artifacts && m.artifacts.length > 0;
                            return (
                                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`${hasArtifacts ? 'max-w-[95%] w-full' : 'max-w-[85%]'} ${
                                        m.role === 'user'
                                            ? 'bg-blue-600 text-white rounded-2xl rounded-br-sm px-4 py-2.5 text-sm shadow-soft'
                                            : 'text-gray-800'
                                    }`}>
                                        {m.role === 'assistant' ? (
                                            <>
                                                {m.content && (
                                                    <div className="bg-white rounded-2xl rounded-bl-sm px-4 py-2.5 text-sm shadow-soft">
                                                        {renderMarkdown(m.content)}
                                                    </div>
                                                )}
                                                {hasArtifacts && <InfoBaxterArtifacts artifacts={m.artifacts!} />}
                                            </>
                                        ) : m.content}
                                    </div>
                                </div>
                            );
                        })}

                        {loading && (
                            <div className="flex justify-start">
                                <div className="bg-white rounded-2xl rounded-bl-sm px-4 py-3 shadow-soft flex items-center gap-2">
                                    <Loader2 size={14} className="animate-spin text-blue-500" />
                                    <span className="text-xs text-gray-500">Mengetik...</span>
                                </div>
                            </div>
                        )}
                    </div>

                    <form
                        onSubmit={(e) => { e.preventDefault(); send(input); }}
                        className="px-3 py-3 border-t border-gray-100 bg-white shrink-0 flex gap-2"
                    >
                        <input
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Tanyakan sesuatu..."
                            disabled={loading}
                            className="flex-1 bg-gray-50 border-0 rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-200 focus:bg-white outline-none transition disabled:opacity-50"
                        />
                        <button
                            type="submit"
                            disabled={!input.trim() || loading}
                            className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-40 text-white p-3 rounded-2xl transition shrink-0"
                            aria-label="Send"
                        >
                            {loading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                        </button>
                    </form>
                </div>
            )}
        </>
    );
}