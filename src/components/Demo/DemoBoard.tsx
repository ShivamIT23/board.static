"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import DemoToolbar from "./DemoToolbar";
import DemoWhiteboard from "./DemoWhiteboard";
import DemoChatRoom from "./DemoChatRoom";
import DemoTopBar from "./DemoTopBar";
import DemoPollModal from "./DemoPollModal";
import DemoQuizModal from "./DemoQuizModal";
import DemoStream from "./DemoStream";
import DemoMobileTool from "./DemoMobileTool";
import { toast } from "sonner";
import Swal from "sweetalert2";
import { MessageCircle } from "lucide-react";
import { useIsMobile } from "@/hooks/useIsMobile";
import type { Poll, QuizState } from "@/types/chat";

const DEMO_PAGES_KEY = "demo_board_pages_state";

export default function DemoBoard() {
    // Board State
    const [tool, setTool] = useState("pen:pen");
    const [imageStampData, setImageStampData] = useState<string | null>(null);
    const [color, setColor] = useState("#FFFFFF");
    const [brushSize, setBrushSize] = useState(3);
    const [isChatOpen, setIsChatOpen] = useState(true);
    const [isVideoExpanded, setIsVideoExpanded] = useState(false);
    const [isViewLocked, setIsViewLocked] = useState(true);
    const [isFullscreen, setIsFullscreen] = useState(false);

    const isMobile = useIsMobile();

    // Close chat sidebar on mobile, open on desktop
    useEffect(() => {
        if (isMobile) setIsChatOpen(false);
        else setIsChatOpen(true);
    }, [isMobile]);

    // Initial State Loaded from sessionStorage
    const [savedData] = useState(() => {
        if (typeof window !== "undefined") {
            try {
                const item = sessionStorage.getItem(DEMO_PAGES_KEY);
                if (item) return JSON.parse(item);
            } catch (e) {
                console.error("Failed to load demo board state from sessionStorage:", e);
            }
        }
        return null;
    });

    // Page Management
    const [currentPage, setCurrentPage] = useState<number>(() => savedData?.currentPage || 1);
    const [totalPages, setTotalPages] = useState<number>(() => savedData?.totalPages || 1);
    const [pageBgColors, setPageBgColors] = useState<Record<number, string>>(
        () => savedData?.pageBgColors || { 1: "#18181b" }
    );
    const [pageBgImages, setPageBgImages] = useState<Record<number, string[]>>(
        () => savedData?.pageBgImages || {}
    );
    const [pageNames, setPageNames] = useState<Record<number, string>>(
        () => savedData?.pageNames || {}
    );

    // Text font settings
    const [fontSize, setFontSize] = useState(24);
    const [fontFamily, setFontFamily] = useState("Inter, sans-serif");

    // Shape colors
    const shapeBorderColor = color;
    const textColor = color;



    // Demo Poll & Quiz states — not auto-launched initially
    const [isPollOpen, setIsPollOpen] = useState(false);
    const [isQuizOpen, setIsQuizOpen] = useState(false);
    const [poll, setPoll] = useState<Poll | null>(null);
    const [pollsHistory, setPollsHistory] = useState<Poll[]>([]);
    const [currentQuiz, setCurrentQuiz] = useState<QuizState | null>(null);

    // Demo Poll handlers
    const handleLaunchPoll = useCallback((newPoll: Poll) => {
        setPoll(newPoll);
        setPollsHistory((prev) => [newPoll, ...prev]);
    }, []);

    const handleEndPoll = useCallback(() => {
        setPoll((prev) => {
            if (!prev) return null;
            const ended = { ...prev, isActive: false };
            setPollsHistory((hPrev) => hPrev.map((p) => (p.id === ended.id ? ended : p)));
            return ended;
        });
    }, []);

    const handleVotePoll = useCallback((optionId: string) => {
        setPoll((prev) => {
            if (!prev || !prev.isActive) return prev;
            const updatedOpts = prev.options.map((opt) =>
                opt.id === optionId ? { ...opt, votes: [...opt.votes, "teacher-user"] } : opt
            );
            const updated = { ...prev, options: updatedOpts };
            setPollsHistory((hPrev) => hPrev.map((p) => (p.id === updated.id ? updated : p)));
            return updated;
        });
    }, []);

    // Demo Quiz handlers
    const handleLaunchQuiz = useCallback((newQuiz: QuizState) => {
        setCurrentQuiz(newQuiz);
    }, []);

    const handleEndQuiz = useCallback(() => {
        setCurrentQuiz((prev) => (prev ? { ...prev, isActive: false } : null));
    }, []);

    const handleDeleteQuiz = useCallback(() => {
        setCurrentQuiz(null);
    }, []);

    const handleSubmitQuiz = useCallback((answers: Record<string, string>) => {
        setCurrentQuiz((prev) => {
            if (!prev || !prev.isActive) return prev;
            const updatedQuestions = prev.questions.map((q) => {
                const votedOptId = answers[q.id];
                if (!votedOptId) return q;
                return {
                    ...q,
                    options: q.options.map((opt) =>
                        opt.id === votedOptId ? { ...opt, votes: [...opt.votes, "teacher-user"] } : opt
                    ),
                };
            });
            return {
                ...prev,
                questions: updatedQuestions,
                submittedUsers: [...prev.submittedUsers, "teacher-user"],
            };
        });
    }, []);

    const mainContainerRef = useRef<HTMLDivElement>(null);

    // Save pages & PDFs to sessionStorage whenever state updates
    useEffect(() => {
        if (typeof window !== "undefined") {
            try {
                sessionStorage.setItem(
                    DEMO_PAGES_KEY,
                    JSON.stringify({
                        totalPages,
                        currentPage,
                        pageBgColors,
                        pageBgImages,
                        pageNames,
                    })
                );
            } catch (err) {
                console.error("Failed to save demo pages to sessionStorage:", err);
            }
        }
    }, [totalPages, currentPage, pageBgColors, pageBgImages, pageNames]);

    // Derived current color
    const currentBoardColor = pageBgColors[currentPage] || "#18181b";
    const currentBgImages = pageBgImages[currentPage];

    // Compute dynamic labels for all pages (e.g. "B-1", "B-2" or PDF filename)
    const pageLabels = React.useMemo(() => {
        const labels: Record<number, string> = {};
        let boardCount = 0;
        for (let p = 1; p <= totalPages; p++) {
            const isPdf = !!(pageBgImages[p] && pageBgImages[p].length > 0);
            if (isPdf) {
                labels[p] = pageNames[p] || "PDF";
            } else {
                boardCount++;
                labels[p] = `B-${boardCount}`;
            }
        }
        return labels;
    }, [totalPages, pageBgImages, pageNames]);

    // Handle tool change and clear imageStampData when switching away
    const handleToolChange = (newTool: string) => {
        if (newTool !== "image-stamp") {
            setImageStampData(null);
        }
        setTool(newTool);
    };

    // Add Page
    const handleAddPage = () => {
        const newPageNum = totalPages + 1;
        setTotalPages(newPageNum);
        setCurrentPage(newPageNum);
        setPageBgColors((prev) => ({ ...prev, [newPageNum]: currentBoardColor }));
    };

    // Delete Page
    const handleDeletePage = async (pageToDelete: number) => {
        if (totalPages <= 1) return;

        const label = pageLabels[pageToDelete] || `Page ${pageToDelete}`;
        const { isConfirmed } = await Swal.fire({
            title: `Delete "${label}"?`,
            text: "This action cannot be undone. All drawings on this page will be lost.",
            icon: "warning",
            showCancelButton: true,
            confirmButtonColor: "#ef4444",
            cancelButtonColor: "#6b7280",
            confirmButtonText: "Yes, delete it!",
        });
        if (!isConfirmed) return;

        const newBgColors: Record<number, string> = {};
        const newBgImages: Record<number, string[]> = {};
        const newPageNames: Record<number, string> = {};

        for (let i = 1; i <= totalPages; i++) {
            if (i < pageToDelete) {
                newBgColors[i] = pageBgColors[i] || "#18181b";
                newBgImages[i] = pageBgImages[i] || [];
                if (pageNames[i]) newPageNames[i] = pageNames[i];
            } else if (i > pageToDelete) {
                newBgColors[i - 1] = pageBgColors[i] || "#18181b";
                newBgImages[i - 1] = pageBgImages[i] || [];
                if (pageNames[i]) newPageNames[i - 1] = pageNames[i];
            }
        }

        const newTotal = totalPages - 1;
        let newCurrent = currentPage;
        if (pageToDelete < currentPage) {
            newCurrent = currentPage - 1;
        } else if (pageToDelete === currentPage) {
            newCurrent = Math.min(currentPage, newTotal);
        }

        setTotalPages(newTotal);
        setPageBgColors(newBgColors);
        setPageBgImages(newBgImages);
        setPageNames(newPageNames);
        setCurrentPage(newCurrent);

        document.dispatchEvent(new CustomEvent("delete-page-local", { detail: { page: pageToDelete } }));
    };

    // ── Full PDF Upload Handler & sessionStorage Storage ──────────────────
    const handlePdfUpload = useCallback(async (file: File) => {
        toast.info(`Processing PDF: "${file.name}"... Please wait.`);

        try {
            const pdfjsLib = await import("pdfjs-dist");
            pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
                "pdfjs-dist/build/pdf.worker.mjs",
                import.meta.url
            ).toString();

            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            const numPages = pdf.numPages;

            const dataUrls: string[] = [];
            for (let i = 1; i <= numPages; i++) {
                const page = await pdf.getPage(i);
                const viewport = page.getViewport({ scale: 1.75 });

                const offscreen = document.createElement("canvas");
                offscreen.width = viewport.width;
                offscreen.height = viewport.height;
                const ctx = offscreen.getContext("2d")!;

                await page.render({ canvasContext: ctx, viewport, canvas: offscreen }).promise;
                dataUrls.push(offscreen.toDataURL("image/jpeg", 0.85));
            }

            const pageIdx = totalPages + 1;
            const newBgImages = { [pageIdx]: dataUrls };
            const newBgColors = { [pageIdx]: "#ffffff" };
            const newPageNames = { [pageIdx]: file.name };

            setTotalPages(pageIdx);
            setCurrentPage(pageIdx);
            setPageBgImages((prev) => ({ ...prev, ...newBgImages }));
            setPageBgColors((prev) => ({ ...prev, ...newBgColors }));
            setPageNames((prev) => ({ ...prev, ...newPageNames }));

            toast.success(`PDF "${file.name}" loaded with ${numPages} page(s)! Saved to session.`);
        } catch (err) {
            console.error("Demo PDF processing error:", err);
            toast.error("Failed to render PDF. Please try another file.");
        }
    }, [totalPages]);

    // Handle end session in demo
    const handleEndSession = () => {
        Swal.fire({
            title: "Exit Demo Session?",
            text: "Your session drawings, PDF pages, and chats are saved in this browser session.",
            icon: "question",
            showCancelButton: true,
            confirmButtonColor: "#f97316",
            cancelButtonColor: "#6b7280",
            confirmButtonText: "Exit Demo",
            cancelButtonText: "Stay in Demo",
        }).then((result) => {
            if (result.isConfirmed) {
                window.location.href = "https://tutorarc.cloud";
            }
        });
    };

    // Toggle fullscreen
    const toggleFullscreen = useCallback(async () => {
        try {
            if (!document.fullscreenElement) {
                await mainContainerRef.current?.requestFullscreen();
                setIsFullscreen(true);
            } else {
                await document.exitFullscreen();
                setIsFullscreen(false);
            }
        } catch (err) {
            console.error("Fullscreen error:", err);
        }
    }, []);

    // Dynamic Marquee Message from DB/API
    const DEFAULT_MARQUEE_MSG = "THIS IS A DEMO SESSION THAT'S WHY SOME FEATURES ARE DISABLED. FOR MORE DETAILS, CALL AT +91-7503663732";
    const [marqueeText, setMarqueeText] = useState<string>(DEFAULT_MARQUEE_MSG);

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                let res = await fetch("/api/site-settings", { cache: "no-store" });
                if (!res.ok) {
                    const mainSiteUrl = process.env.NEXT_PUBLIC_MAIN_SITE_URL ||
                        (typeof window !== "undefined" && window.location.hostname === "localhost"
                            ? "http://localhost:3000"
                            : "https://tutorarc.cloud");
                    res = await fetch(`${mainSiteUrl}/api/site-settings`, { cache: "no-store" });
                }
                if (res.ok) {
                    const data = await res.json();
                    if (data.marqueeText) {
                        setMarqueeText(data.marqueeText);
                    }
                }
            } catch {
                // Keep default marqueeText
            }
        };
        fetchSettings();
    }, []);

    return (
        <div ref={mainContainerRef} className="flex flex-col w-screen h-screen bg-background text-foreground overflow-hidden font-sans">
            {/* Top Marquee Banner — visible on all devices */}
            <div className="w-full bg-amber-500/10 border-b border-amber-500/20 text-amber-600 dark:text-amber-400 py-0.5 sm:py-1 px-2 sm:px-3 overflow-hidden select-none shrink-0 flex items-center">
                <div className="animate-marquee whitespace-nowrap flex items-center gap-6 sm:gap-12 text-[10px] sm:text-xs font-black uppercase tracking-widest">
                    <span className="flex items-center gap-1.5 sm:gap-2">
                        <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-amber-500 animate-ping" />
                        {marqueeText}
                    </span>
                    <span className="flex items-center gap-1.5 sm:gap-2">
                        <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-amber-500 animate-ping" />
                        THIS IS A DEMO CLASS — ALL DRAWINGS & CHATS ARE SAVED LOCALLY IN SESSION
                    </span>
                    <span className="flex items-center gap-1.5 sm:gap-2">
                        <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-amber-500 animate-ping" />
                        {marqueeText}
                    </span>
                    <span className="flex items-center gap-1.5 sm:gap-2">
                        <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-amber-500 animate-ping" />
                        THIS IS A DEMO CLASS — ALL DRAWINGS & CHATS ARE SAVED LOCALLY IN SESSION
                    </span>
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
                <div className="flex flex-col flex-1 overflow-hidden">
                    {/* Top Bar */}
                    <DemoTopBar
                        tool={tool}
                        setTool={handleToolChange}
                        isOpen={isChatOpen}
                        isVideoExpanded={isVideoExpanded}
                        boardColor={currentBoardColor}
                        setBoardColor={(newCol) => setPageBgColors((prev) => ({ ...prev, [currentPage]: newCol }))}
                        userName="Teacher"
                        isViewLocked={isViewLocked}
                        onToggleViewLocked={setIsViewLocked}
                        onPdfUpload={handlePdfUpload}
                        onEndSession={handleEndSession}
                        isFullscreen={isFullscreen}
                        onToggleFullscreen={toggleFullscreen}
                        onImageStamp={(dataUrl) => {
                            setImageStampData(dataUrl);
                            setTool("image-stamp");
                        }}
                        isMobile={isMobile}
                    />

                    {/* Canvas & Sidebar Main Area */}
                    <div className="flex-1 overflow-hidden relative flex">
                        {/* Left Floating Toolbar (desktop only) */}
                        {!isMobile && (
                            <DemoToolbar
                                tool={tool}
                                setTool={handleToolChange}
                                role="teacher"
                                color={color}
                                setColor={setColor}
                                brushSize={brushSize}
                                setBrushSize={setBrushSize}
                                onClearCanvas={() => {
                                    document.dispatchEvent(new CustomEvent("clear-canvas-emit"));
                                }}
                                isClassEnded={false}
                            />
                        )}

                        {/* Whiteboard Area with Chrome Tabs Pagination */}
                        <div className="flex-1 relative flex flex-col overflow-hidden">
                            {/* Chrome Tabs Style Pagination */}
                            <div className="flex items-end px-3 pt-1.5 overflow-x-auto no-scrollbar gap-1 bg-muted/30 border-b border-border/50">
                                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                                    <div
                                        key={pageNum}
                                        onClick={() => setCurrentPage(pageNum)}
                                        className={`
                                            relative flex items-center h-6 px-2 min-w-12.5 max-w-44 cursor-pointer 
                                            transition-all duration-200 rounded-t-lg group
                                            ${currentPage === pageNum
                                                ? "bg-background text-foreground shadow-[0_-4px_8px_rgba(0,0,0,0.1)] z-10"
                                                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                                            }
                                        `}
                                    >
                                        <span
                                            className="text-[11px] font-bold truncate flex-1 min-w-0 mr-1"
                                            title={pageLabels[pageNum]}
                                        >
                                            {pageLabels[pageNum]}
                                        </span>
                                        {totalPages > 1 && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDeletePage(pageNum);
                                                }}
                                                className={`ml-1 shrink-0 p-0.5 rounded-full transition-colors
                                                    ${currentPage === pageNum
                                                        ? "opacity-60 hover:opacity-100 hover:bg-destructive/20 hover:text-destructive"
                                                        : "opacity-0 group-hover:opacity-60 hover:opacity-100! hover:bg-destructive/20 hover:text-destructive"
                                                    }
                                                `}
                                                title={`Close ${pageLabels[pageNum]}`}
                                            >
                                                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                            </button>
                                        )}
                                        {/* Tab curve styling */}
                                        {currentPage === pageNum && (
                                            <>
                                                <div className="absolute -left-2.5 bottom-0 w-2.5 h-2.5 bg-background overflow-hidden">
                                                    <div className="w-full h-full bg-muted/30 rounded-br-lg" />
                                                </div>
                                                <div className="absolute -right-2.5 bottom-0 w-2.5 h-2.5 bg-background overflow-hidden">
                                                    <div className="w-full h-full bg-muted/30 rounded-bl-lg" />
                                                </div>
                                            </>
                                        )}
                                    </div>
                                ))}

                                <button
                                    onClick={handleAddPage}
                                    className="mb-1 ml-1.5 p-1 rounded-full hover:bg-muted/50 text-muted-foreground transition-all shrink-0 cursor-pointer"
                                    title="Add New Page"
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                                    </svg>
                                </button>
                            </div>

                            {/* Whiteboard Canvas */}
                            <DemoWhiteboard
                                sessionId="demo-session"
                                role="teacher"
                                tool={tool}
                                color={color}
                                boardColor={currentBoardColor}
                                bgImages={currentBgImages}
                                brushSize={brushSize}
                                isViewLocked={isViewLocked}
                                drawingEnabled={true}
                                currentPage={currentPage}
                                onToolChange={handleToolChange}
                                shapeBorderColor={shapeBorderColor}
                                textColor={textColor}
                                fontSize={fontSize}
                                setFontSize={setFontSize}
                                fontFamily={fontFamily}
                                setFontFamily={setFontFamily}
                                imageStampData={imageStampData || undefined}
                            />
                        </div>

                        {/* Right Sidebar (Chat & Local Video Stream) — desktop only */}
                        {!isMobile && (
                            <DemoChatRoom
                                userName="Teacher"
                                isOpen={isChatOpen}
                                setIsOpen={setIsChatOpen}
                                isVideoExpanded={isVideoExpanded}
                                onOpenPoll={() => setIsPollOpen(true)}
                                onOpenQuiz={() => setIsQuizOpen(true)}
                                onExpandChange={(exp) => setIsVideoExpanded(exp)}
                            />
                        )}
                    </div>
                </div>
            </div>

            {/* ── Mobile-only floating elements ─────────────────── */}
            {isMobile && (
                <>
                    {/* All Mobile Tools Bottom Dock */}
                    <DemoMobileTool
                        tool={tool}
                        setTool={handleToolChange}
                        role="teacher"
                        color={color}
                        setColor={setColor}
                        boardColor={currentBoardColor}
                        setBoardColor={(newCol) => setPageBgColors((prev) => ({ ...prev, [currentPage]: newCol }))}
                        brushSize={brushSize}
                        setBrushSize={setBrushSize}
                        onClearCanvas={() => {
                            document.dispatchEvent(new CustomEvent("clear-canvas-emit"));
                        }}
                        isClassEnded={false}
                        isViewLocked={isViewLocked}
                        onToggleViewLocked={setIsViewLocked}
                        onPdfUpload={handlePdfUpload}
                        onImageStamp={(dataUrl) => {
                            setImageStampData(dataUrl);
                            setTool("image-stamp");
                        }}
                    />

                    {/* Floating PiP Video Stream */}
                    <DemoStream
                        userName="Teacher"
                        isChatOpen={isChatOpen}
                        isVideoExpanded={isVideoExpanded}
                        onExpandChange={(exp) => setIsVideoExpanded(exp)}
                        onToggleChat={() => setIsChatOpen(!isChatOpen)}
                        isMobile={true}
                    />

                    {/* Chat FAB Button */}
                    {!isChatOpen && (
                        <button
                            type="button"
                            onClick={() => setIsChatOpen(true)}
                            className="fixed bottom-24 right-3 z-40 p-3 rounded-full bg-primary text-primary-foreground shadow-2xl shadow-primary/30 hover:scale-110 active:scale-95 transition-all cursor-pointer"
                            title="Open Chat"
                        >
                            <MessageCircle className="w-5 h-5" />
                        </button>
                    )}

                    {/* Full-screen Chat Overlay */}
                    <DemoChatRoom
                        userName="Teacher"
                        isOpen={isChatOpen}
                        setIsOpen={setIsChatOpen}
                        isVideoExpanded={isVideoExpanded}
                        onOpenPoll={() => setIsPollOpen(true)}
                        onOpenQuiz={() => setIsQuizOpen(true)}
                        onExpandChange={(exp) => setIsVideoExpanded(exp)}
                        isMobile={true}
                    />
                </>
            )}

            {/* Poll Modal */}
            {isPollOpen && (
                <DemoPollModal
                    sessionId="demo-session"
                    role="teacher"
                    isOpen={isPollOpen}
                    onClose={() => setIsPollOpen(false)}
                    poll={poll}
                    pollsHistory={pollsHistory}
                    onLaunchPoll={handleLaunchPoll}
                    onEndPoll={handleEndPoll}
                    onVotePoll={handleVotePoll}
                />
            )}

            {/* Quiz Modal */}
            {isQuizOpen && (
                <DemoQuizModal
                    sessionId="demo-session"
                    role="teacher"
                    isOpen={isQuizOpen}
                    onClose={() => setIsQuizOpen(false)}
                    currentQuiz={currentQuiz}
                    classId={1}
                    userName="Teacher"
                    onLaunchQuiz={handleLaunchQuiz}
                    onEndQuiz={handleEndQuiz}
                    onDeleteQuiz={handleDeleteQuiz}
                    onSubmitQuiz={handleSubmitQuiz}
                />
            )}
        </div>
    );
}
