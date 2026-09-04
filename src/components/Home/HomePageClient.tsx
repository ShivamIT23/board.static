"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Loader2,
  Video,
  Layers,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Sparkles,
  Star,
  Phone,
  Mail,
  MapPin,
  Check,
  MessageSquare,
  ShieldCheck,
  Users,
  Pencil,
  Lock,
  X
} from "lucide-react";
import Image from "next/image";
import ThemeToggle from "@/components/theme-toggle";
import logo from "../../../public/logo.png";

const TUTORARC_MAIN_URL = "https://tutorarc.cloud";

function HomePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sId = searchParams?.get("session");
  const r = searchParams?.get("role");

  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [roomInput, setRoomInput] = useState("");

  useEffect(() => {
    if (sId && r) {
      const paramsStr = searchParams ? searchParams.toString() : "";
      router.replace(`/${r}/${sId}?${paramsStr}`);
    }
  }, [router, sId, r, searchParams]);

  const scrollToSection = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  if (sId && r) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-zinc-950 text-white gap-4">
        <Loader2 className="animate-spin text-blue-500" size={40} />
        <p className="text-sm font-bold tracking-widest uppercase opacity-80">
          Redirecting to live classroom session...
        </p>
      </div>
    );
  }

  const handleConnectLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (roomInput.trim()) {
      if (roomInput.includes("tutorarc.cloud/")) {
        window.location.href = roomInput.trim();
      } else {
        window.location.href = `${TUTORARC_MAIN_URL}/signup`;
      }
    } else {
      window.location.href = `${TUTORARC_MAIN_URL}/signup`;
    }
  };

  const testimonials = [
    {
      name: "David Miller",
      role: "Math Tutor • Oxford Online",
      avatar: "DM",
      text: "TutorArc Board has completely transformed how I teach geometry and calculus. The real-time vector shapes, coordinate graph axes, and math notation make complex concepts effortless to demonstrate."
    },
    {
      name: "Dr. Sarah Jenkins",
      role: "Physics Lead • Science Academy",
      avatar: "SJ",
      text: "Having teacher-only LiveKit video and the digital teaching board on the same screen with zero lag keeps my students completely focused. The one-click session recording is invaluable for revisions."
    },
    {
      name: "Marcus Vance",
      role: "Head Tutor • Apex Prep",
      avatar: "MV",
      text: "The granular student permission controls are exceptional. I can enable student drawing during discussions, restrict chat, or lock student view right from the teacher control panel."
    },
    {
      name: "Elena Rostova",
      role: "Chemistry Teacher • Elite Tutors",
      avatar: "ER",
      text: "The live classroom chat, instant document sharing, and math symbols keep my students fully engaged. It provides a real interactive virtual classroom without requiring student sign-ups."
    },
    {
      name: "Robert Chen",
      role: "STEM Instructor • Horizon Learning",
      avatar: "RC",
      text: "Multi-page tabs, background grids, and PDF imports allow me to prepare comprehensive STEM lessons in advance. The digital whiteboard runs seamlessly on iPads, tablets, and laptops."
    },
    {
      name: "Amara Nwosu",
      role: "Private Educator • Global Prep",
      avatar: "AN",
      text: "Classroom setup takes under 30 seconds. No heavy software to install. Students simply click the secure link and enter the interactive whiteboard session instantly from their browser."
    }
  ];

  const faqs = [
    {
      q: "What is TutorArc Board?",
      a: "TutorArc Board is an interactive online teaching board and virtual classroom platform built for educators, tutors, and schools. It combines a real-time collaborative digital whiteboard, high-precision math and graphing tools, live classroom chat, file sharing, and teacher live audio and video streaming in a single browser-based application."
    },
    {
      q: "How does TutorArc Board support math, science, and STEM teachers?",
      a: "TutorArc Board includes specialized tools for STEM instruction, such as customizable coordinate graphing planes, mathematical symbols and notation, directional arrows, geometric shapes (rectangles, ellipses, triangles, parallelograms, stars), and a fluid vector drawing pen and highlighter."
    },
    {
      q: "Can teachers control student permissions during class?",
      a: "Yes. TutorArc Board features robust role-based access control. Teachers can toggle drawing permissions per student or globally, restrict or enable live chat, approve student admission, lock the student canvas view to follow the teacher, and manage audio/video interactions."
    },
    {
      q: "How do audio, video, and screen sharing work?",
      a: "TutorArc Board features integrated teacher-only live video and audio broadcasting powered by WebRTC (LiveKit). This one-way video model ensures students can see and hear the instructor with ultra-low latency while keeping the whiteboard front and center without bandwidth bottlenecks."
    },
    {
      q: "Do students need to install software or create an account?",
      a: "No installation or registration is required for students. Students simply click the unique session link provided by the teacher and join the virtual classroom instantly from any modern web browser on PC, Mac, iPad, Chromebook, or mobile device."
    },
    {
      q: "Can I share files and record lessons for revision?",
      a: "Yes. Teachers can upload and share document attachments and PDFs directly into the classroom chat. Additionally, teachers can record live whiteboard sessions with one click to generate replayable recordings for student revision."
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 font-sans selection:bg-blue-500 selection:text-white relative overflow-x-clip transition-colors duration-200">
      {/* Background Subtle Gradient */}
      <div className="absolute inset-x-0 top-0 h-[600px] overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1100px] h-[550px] bg-linear-to-b from-blue-500/10 via-indigo-500/5 to-transparent dark:from-blue-600/15 dark:via-indigo-600/10 blur-3xl pointer-events-none" />
      </div>

      {/* ── 1. Top Navigation Header ───────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-slate-200/80 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Image src={logo} alt="TutorArc Board Logo" height={56} className="h-14 py-2 w-auto object-contain" priority />
            <span className="text-[8px] px-2.5 py-0.5 rounded-[5px] bg-blue-500/10 border border-blue-500/30 text-blue-600 dark:text-blue-400 font-bold uppercase tracking-wider">
              BOARD
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-xs font-semibold text-slate-600 dark:text-zinc-400">
            <a href="#features" onClick={(e) => scrollToSection(e, "features")} className="hover:text-blue-600 dark:hover:text-white transition-colors">Features</a>
            <a href="#drawing" onClick={(e) => scrollToSection(e, "drawing")} className="hover:text-blue-600 dark:hover:text-white transition-colors">Drawing & Math</a>
            <a href="#controls" onClick={(e) => scrollToSection(e, "controls")} className="hover:text-blue-600 dark:hover:text-white transition-colors">Classroom Controls</a>
            <a href="#testimonials" onClick={(e) => scrollToSection(e, "testimonials")} className="hover:text-blue-600 dark:hover:text-white transition-colors">Testimonials</a>
            <a href="#faq" onClick={(e) => scrollToSection(e, "faq")} className="hover:text-blue-600 dark:hover:text-white transition-colors">FAQ</a>
          </nav>

          <div className="flex items-center gap-3">
            <a
              href={`${TUTORARC_MAIN_URL}/login`}
              className="px-4 py-2 text-xs font-bold text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-900 rounded-[5px] transition-all border border-slate-300 dark:border-zinc-800"
            >
              Enter Session
            </a>
            <a
              href={`${TUTORARC_MAIN_URL}/signup`}
              className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 dark:bg-blue-600 dark:hover:bg-blue-500 rounded-[5px] transition-all shadow-md shadow-blue-600/25 flex items-center gap-1.5"
            >
              Sign Up Free
            </a>

            {/* Theme Toggle Button */}
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* ── 2. Hero Section ────────────────────────────────────────── */}
      <section className="pt-12 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-12">
        <div className="text-center space-y-6 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-[5px] bg-blue-500/10 border border-blue-500/30 text-blue-600 dark:text-blue-400 text-xs font-bold">
            <Sparkles size={14} /> Virtual Classroom & Online Teaching Board
          </div>

          <h1 className="text-4xl sm:text-6xl font-black text-slate-900 dark:text-white tracking-tight leading-[1.12]">
            An Interactive <span className="bg-linear-to-r from-blue-600 via-indigo-500 to-blue-600 bg-clip-text text-transparent">Online Teaching Board</span> for Modern Classrooms
          </h1>

          <p className="text-base text-slate-600 dark:text-zinc-400 leading-relaxed max-w-2xl mx-auto">
            TutorArc Board is a real-time collaborative digital teaching board and virtual classroom designed for educators. Deliver engaging online lessons with interactive whiteboards, precision drawing, math notation, graphing tools, live classroom chat, and teacher audio and video streaming.
          </p>

          {/* Room Link Quick Input */}
          <form onSubmit={handleConnectLink} className="space-y-3 max-w-md mx-auto">
            <div className="flex items-center p-1.5 rounded-[5px] bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-800 shadow-xl">
              <input
                type="text"
                value={roomInput}
                onChange={(e) => setRoomInput(e.target.value)}
                placeholder="Enter room name or class link..."
                className="flex-1 px-3 py-2 text-xs font-medium bg-transparent border-none outline-none text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500"
              />
              <button
                type="submit"
                className="px-5 py-2.5 text-xs font-extrabold text-white bg-blue-600 hover:bg-blue-500 rounded-[5px] transition-all shadow-md shrink-0 flex items-center gap-1.5 cursor-pointer"
              >
                Connect with Link <ArrowRight size={14} />
              </button>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-zinc-500">
              No credit card required. Fast room creation for free on{" "}
              <a href={`${TUTORARC_MAIN_URL}`} className="text-blue-600 dark:text-blue-400 font-bold underline">
                tutorarc.cloud
              </a>
            </p>
          </form>
        </div>

        {/* ── Hero Image with Descriptive Alt Text ─────────────────── */}
        <div className="relative max-w-5xl mx-auto pt-4">
          <div className="relative z-10 rounded-[5px] overflow-hidden shadow-2xl shadow-blue-900/10 dark:shadow-blue-900/40 border border-slate-200 dark:border-zinc-800">
            <Image
              src="/home1.png"
              alt="TutorArc Board - Interactive online whiteboard and virtual classroom for teachers"
              width={1200}
              height={800}
              className="w-full h-auto object-cover"
              priority
            />
          </div>
          {/* Decorative Glow */}
          <div className="absolute -bottom-6 -left-6 w-48 h-48 bg-blue-600/10 blur-3xl rounded-[5px] pointer-events-none" />
        </div>
      </section>

      {/* ── 3. Section: Complete Virtual Classroom Feature Grid ─────── */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-slate-200 dark:border-zinc-900 space-y-12 scroll-mt-20">
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-[5px] bg-blue-500/10 border border-blue-500/30 text-blue-600 dark:text-blue-400 text-xs font-bold uppercase tracking-wider">
            Complete Virtual Classroom
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white">
            Everything you need in an <span className="text-blue-600 dark:text-blue-400">online whiteboard</span> for teachers.
          </h2>
          <p className="text-sm text-slate-600 dark:text-zinc-400">
            Purpose-built for educators, tutors, and online academies to run productive, distraction-free virtual classes.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {/* Feature 1: Interactive Whiteboard */}
          <div className="p-8 rounded-[5px] bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800 shadow-xl space-y-4 text-left">
            <div className="w-12 h-12 rounded-[5px] bg-blue-600 text-white flex items-center justify-center font-bold text-lg shadow-lg shadow-blue-600/30">
              <Pencil size={22} />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Interactive Online Whiteboard</h3>
            <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
              Fluid freehand pen, vibrant highlighter, precision eraser, and laser pointer. Add text annotations, customize stroke widths, and switch between multi-page boards instantly.
            </p>
          </div>

          {/* Feature 2: Math & Graphing Tools */}
          <div className="p-8 rounded-[5px] bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800 shadow-xl space-y-4 text-left">
            <div className="w-12 h-12 rounded-[5px] bg-indigo-600 text-white flex items-center justify-center font-bold text-lg shadow-lg shadow-indigo-600/30">
              <Layers size={22} />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Math & Graphing Tools</h3>
            <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
              Designed for STEM educators. Insert mathematical symbols and notation, generate Cartesian coordinate graph planes, and draw geometric shapes with directional lines and arrows.
            </p>
          </div>

          {/* Feature 3: Live Classroom Chat & Files */}
          <div className="p-8 rounded-[5px] bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800 shadow-xl space-y-4 text-left">
            <div className="w-12 h-12 rounded-[5px] bg-cyan-600 text-white flex items-center justify-center font-bold text-lg shadow-lg shadow-cyan-600/30">
              <MessageSquare size={22} />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Live Chat & File Sharing</h3>
            <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
              Foster real-time classroom participation with built-in text chat, emoji reactions, and instant document and PDF attachment sharing for assignments and worksheets.
            </p>
          </div>

          {/* Feature 4: Teacher Audio & Video */}
          <div className="p-8 rounded-[5px] bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800 shadow-xl space-y-4 text-left">
            <div className="w-12 h-12 rounded-[5px] bg-purple-600 text-white flex items-center justify-center font-bold text-lg shadow-lg shadow-purple-600/30">
              <Video size={22} />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Teacher Live Audio & Video</h3>
            <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
              Broadcast teacher-only high-definition video and crystal-clear audio powered by LiveKit WebRTC. One-way video keeps student bandwidth low and learning attention high.
            </p>
          </div>

          {/* Feature 5: Role-Based Access & Permissions */}
          <div className="p-8 rounded-[5px] bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800 shadow-xl space-y-4 text-left">
            <div className="w-12 h-12 rounded-[5px] bg-emerald-600 text-white flex items-center justify-center font-bold text-lg shadow-lg shadow-emerald-600/30">
              <ShieldCheck size={22} />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Role-Based Permissions</h3>
            <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
              Stay in command with granular teacher and student permissions. Toggle drawing permissions, lock student canvas views, control chat access, and configure automatic student approvals.
            </p>
          </div>

          {/* Feature 6: Real-Time Collaboration & Zero Setup */}
          <div className="p-8 rounded-[5px] bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800 shadow-xl space-y-4 text-left">
            <div className="w-12 h-12 rounded-[5px] bg-amber-600 text-white flex items-center justify-center font-bold text-lg shadow-lg shadow-amber-600/30">
              <Users size={22} />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Real-Time Collaboration</h3>
            <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
              No software installations or accounts required for students. Share a secure lesson link for instant browser access on PCs, Macs, iPads, tablets, and smartphones.
            </p>
          </div>
        </div>

        <div className="text-center pt-4">
          <a
            href={`${TUTORARC_MAIN_URL}/register`}
            className="inline-flex items-center gap-2 px-8 py-3.5 text-xs font-extrabold text-white bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-[5px] transition-all shadow-xl shadow-blue-600/25"
          >
            Explore All Features on TutorArc →
          </a>
        </div>
      </section>

      {/* ── 4. Section: Powerful Drawing Engine ────────────────────── */}
      <section id="drawing" className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-slate-200 dark:border-zinc-900 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center scroll-mt-20">
        <div className="lg:col-span-6 space-y-6 text-left">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white leading-tight">
            Dedicated math symbols & tools, <br />
            <span className="text-blue-600 dark:text-blue-400">designed for online teaching.</span>
          </h2>

          <p className="text-sm text-slate-600 dark:text-zinc-400 leading-relaxed">
            TutorArc Board provides built-in mathematical notation and coordinate axes engineered specifically for tutors and STEM educators. Quickly insert standard notation, Greek characters, and coordinate planes to explain formulas and geometry with total clarity.
          </p>

          <div className="space-y-3 text-xs text-slate-700 dark:text-zinc-300 font-semibold">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="text-blue-600 dark:text-blue-400 shrink-0" size={18} />
              <span>One-click math symbol palette: ∑, π, ∞, ∫, √, θ, α, β, Δ, ±, ≠, ≈, ≥, ≤, [ ], | |</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle2 className="text-blue-600 dark:text-blue-400 shrink-0" size={18} />
              <span>Customizable Cartesian coordinate axes and grid backgrounds for problem solving</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle2 className="text-blue-600 dark:text-blue-400 shrink-0" size={18} />
              <span>Filled and outlined geometric shapes: rectangles, circles, triangles, stars & diamonds</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle2 className="text-blue-600 dark:text-blue-400 shrink-0" size={18} />
              <span>Directional lines and arrows with dynamic quadrant anchoring for precision diagrams</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle2 className="text-blue-600 dark:text-blue-400 shrink-0" size={18} />
              <span>Smooth vector pen & highlighter with customizable brush thickness and palette</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle2 className="text-blue-600 dark:text-blue-400 shrink-0" size={18} />
              <span>Laser pointer for guiding attention and versatile text annotations</span>
            </div>
          </div>
        </div>

        {/* Graph & Math Symbols Mockup */}
        <div className="lg:col-span-6">
          <div className="rounded-[5px] border border-slate-200 dark:border-zinc-800 bg-slate-100 dark:bg-zinc-950 p-3 sm:p-4 shadow-2xl space-y-3 relative">
            <div className="h-80 sm:h-96 bg-white dark:bg-zinc-900 rounded-[5px] border border-slate-200 dark:border-zinc-800 p-4 relative flex items-center justify-center overflow-hidden">
              
              {/* Background Canvas Grid Pattern */}
              <div
                className="absolute inset-0 opacity-20 dark:opacity-15 pointer-events-none"
                style={{
                  backgroundImage: "radial-gradient(#3b82f6 1px, transparent 1px)",
                  backgroundSize: "20px 20px"
                }}
              />

              {/* Coordinate Plane & Math Diagram */}
              <div className="w-full h-full relative flex items-center justify-center">
                {/* Axes */}
                <div className="absolute inset-x-8 top-1/2 h-[2px] bg-slate-300 dark:bg-zinc-700" />
                <div className="absolute inset-y-6 left-1/2 w-[2px] bg-slate-300 dark:bg-zinc-700" />
                
                {/* Axis Labels */}
                <span className="absolute right-6 top-1/2 -translate-y-4 text-[10px] font-mono text-slate-400 dark:text-zinc-500 font-bold">x</span>
                <span className="absolute left-1/2 top-4 translate-x-2 text-[10px] font-mono text-slate-400 dark:text-zinc-500 font-bold">y</span>
                
                {/* Geometric Shape Diagram: Circle with angle θ and radius vector */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 400 300" preserveAspectRatio="none">
                  <circle cx="200" cy="150" r="90" fill="none" stroke="#3b82f6" strokeWidth="2" strokeDasharray="4 4" className="opacity-40" />
                  <line x1="200" y1="150" x2="265" y2="85" stroke="#6366f1" strokeWidth="2.5" />
                  <polygon points="265,85 252,90 260,98" fill="#6366f1" />
                </svg>

                {/* Stamped Math Formulas */}
                <div className="absolute top-6 left-6 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-xs px-2.5 py-1 rounded border border-slate-200 dark:border-zinc-800 text-[11px] font-mono text-indigo-600 dark:text-indigo-400 font-semibold shadow-xs">
                  A = π r²
                </div>
                <div className="absolute bottom-6 left-8 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-xs px-2.5 py-1 rounded border border-slate-200 dark:border-zinc-800 text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold shadow-xs">
                  Δx = x₂ - x₁
                </div>
                <div className="absolute top-1/2 left-[53%] -translate-y-8 text-[11px] font-mono text-blue-500 font-bold">
                  θ = 45°
                </div>

                {/* Floating Math Symbols Palette Modal (Matches TutorArc Board interface) */}
                <div className="absolute right-3 sm:right-6 bottom-3 sm:bottom-6 w-48 sm:w-52 bg-zinc-950/95 dark:bg-zinc-900/95 border border-zinc-800 rounded-2xl p-2.5 shadow-2xl backdrop-blur-md z-20 transition-all hover:scale-[1.02]">
                  <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider px-1 pb-1.5 border-b border-zinc-800/80 flex items-center justify-between">
                    <span>Math Symbols</span>
                    <span className="text-[9px] text-blue-400 font-normal">16 tools</span>
                  </div>
                  <div className="grid grid-cols-4 gap-1 pt-1.5">
                    {[
                      { s: "∑", active: true },
                      { s: "π", active: false },
                      { s: "∞", active: false },
                      { s: "∫", active: false },
                      { s: "√", active: false },
                      { s: "θ", active: false },
                      { s: "α", active: false },
                      { s: "β", active: false },
                      { s: "Δ", active: false },
                      { s: "±", active: false },
                      { s: "≠", active: false },
                      { s: "≈", active: false },
                      { s: "≥", active: false },
                      { s: "≤", active: false },
                      { s: "[ ]", active: false },
                      { s: "| |", active: false },
                    ].map((item, idx) => (
                      <div
                        key={idx}
                        className={`h-8 sm:h-9 rounded-xl flex items-center justify-center hover:cursor-pointer text-sm font-medium transition-colors ${
                          item.active
                            ? "bg-zinc-100 text-zinc-950 font-bold shadow-md"
                            : "text-zinc-300 hover:text-white hover:bg-zinc-800/60"
                        }`}
                      >
                        {item.s}
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 5. Testimonials Grid Section ───────────────────────────── */}
      <section id="testimonials" className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-slate-200 dark:border-zinc-900 space-y-12 scroll-mt-20">
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-[5px] bg-blue-500/10 border border-blue-500/30 text-blue-600 dark:text-blue-400 text-xs font-bold uppercase tracking-wider">
            Testimonials
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white">
            Trusted by <span className="text-blue-600 dark:text-blue-400">500+</span> Educators & Academies
          </h2>
          <p className="text-sm text-slate-600 dark:text-zinc-400">
            Read how tutors, schools, and STEM educators use TutorArc Board for interactive online classes every day.
          </p>

          <div className="inline-flex items-center gap-1 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-bold mt-2">
            <div className="flex gap-0.5">
              {[...Array(5)].map((_, i) => (
                <Star key={i} size={14} className="fill-current text-amber-400" />
              ))}
            </div>
            <span>4.9/5 Average Rating</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {testimonials.map((item, idx) => (
            <div
              key={idx}
              className="p-6 rounded-[5px] bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800 shadow-lg space-y-4 text-left hover:border-blue-500/40 transition-all"
            >
              <div className="flex items-center gap-1 text-amber-400">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} size={13} className="fill-current" />
                ))}
              </div>
              <p className="text-xs text-slate-700 dark:text-zinc-300 leading-relaxed italic">
                &ldquo;{item.text}&rdquo;
              </p>
              <div className="flex items-center gap-3 pt-2 border-t border-slate-100 dark:border-zinc-800">
                <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                  {item.avatar}
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1">
                    {item.name} <Check size={12} className="text-blue-500" />
                  </h4>
                  <p className="text-[10px] text-slate-500 dark:text-zinc-500">{item.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── 6. Section: Classroom Controls & Permissions ──────────── */}
      <section id="controls" className="py-16 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto scroll-mt-20">
        <div className="rounded-[5px] bg-linear-to-r from-blue-600 via-indigo-600 to-[#6466F1] p-8 sm:p-14 text-white shadow-2xl text-left space-y-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-1/2 h-full bg-white/10 skew-x-12 translate-x-1/2 pointer-events-none" />
          <div className="max-w-2xl space-y-4 relative z-10">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-[5px] bg-white/20 border border-white/30 text-white text-xs font-bold uppercase tracking-wider">
              Classroom Management
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
              Granular Classroom Controls & Permissions for Teachers
            </h2>
            <p className="text-xs sm:text-sm text-blue-100 leading-relaxed">
              Stay in full control of your digital classroom. TutorArc Board gives teachers role-based permissions to grant or revoke drawing access, manage live classroom chat, enable file sharing, approve joining students automatically or manually, and lock student viewport for focused lectures.
            </p>
            <div className="flex flex-wrap gap-4 pt-2">
              <a
                href="#features"
                onClick={(e) => scrollToSection(e, "features")}
                className="px-6 py-3 text-xs font-extrabold text-blue-600 bg-white hover:bg-slate-100 rounded-[5px] transition-all shadow-md"
              >
                View Feature Details
              </a>
              <a
                href={`${TUTORARC_MAIN_URL}/login`}
                className="px-6 py-3 text-xs font-extrabold text-white bg-white/20 hover:bg-white/30 border border-white/40 rounded-[5px] transition-all backdrop-blur-md"
              >
                Go to Teacher Dashboard
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── 7. Section: Traditional Platforms vs TutorArc.cloud ────────── */}
      <section id="comparison" className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-slate-200 dark:border-zinc-900 space-y-12 scroll-mt-20">
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-[5px] bg-blue-500/10 border border-blue-500/30 text-blue-600 dark:text-blue-400 text-xs font-bold uppercase tracking-wider">
            Why Choose TutorArc
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white leading-tight">
            Traditional Platforms vs <span className="bg-linear-to-r from-blue-600 via-indigo-500 to-blue-600 bg-clip-text text-transparent">TutorArc.cloud</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 leading-relaxed">
            Generic video meeting tools and basic whiteboards were never designed for active teaching. Here is how TutorArc Board delivers the purpose-built features educators actually need.
          </p>
        </div>

        {/* 3 Standout Exclusive Highlights */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-5 rounded-[5px] bg-blue-50/70 dark:bg-zinc-900/50 border border-blue-200 dark:border-blue-900/30 flex items-start gap-3.5">
            <div className="w-9 h-9 rounded-[5px] bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Lock size={18} />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-slate-900 dark:text-white">Synchronized View-Lock</span>
                <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">ONLY WE GIVE</span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-zinc-400 leading-relaxed">
                Pin all student screens to your exact canvas viewpoint so no student wanders off or gets lost.
              </p>
            </div>
          </div>

          <div className="p-5 rounded-[5px] bg-indigo-50/70 dark:bg-zinc-900/50 border border-indigo-200 dark:border-indigo-900/30 flex items-start gap-3.5">
            <div className="w-9 h-9 rounded-[5px] bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <ShieldCheck size={18} />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-slate-900 dark:text-white">Granular Drawing Control</span>
                <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">ONLY WE GIVE</span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-zinc-400 leading-relaxed">
                Grant whiteboard pen access to a single student to solve a problem and revoke it with one tap.
              </p>
            </div>
          </div>

          <div className="p-5 rounded-[5px] bg-purple-50/70 dark:bg-zinc-900/50 border border-purple-200 dark:border-purple-900/30 flex items-start gap-3.5">
            <div className="w-9 h-9 rounded-[5px] bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Layers size={18} />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-slate-900 dark:text-white">16-Symbol Math Palette</span>
                <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">ONLY WE GIVE</span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-zinc-400 leading-relaxed">
                Built-in Greek letters, calculus symbols, and Cartesian coordinate graph axes ready in one click.
              </p>
            </div>
          </div>
        </div>

        {/* Detailed Side-by-Side Comparison Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Traditional Teaching Platforms Card */}
          <div className="p-6 sm:p-8 rounded-[5px] bg-white dark:bg-zinc-900/40 border border-slate-200 dark:border-zinc-800/80 shadow-md space-y-6 text-left relative">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-800 pb-4">
              <div>
                <span className="text-[10px] font-bold text-rose-500 uppercase tracking-wider">The Old Way</span>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Traditional Platforms</h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400">Zoom, Google Meet & Generic Whiteboards</p>
              </div>
              <div className="w-10 h-10 rounded-[5px] bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center">
                <X size={20} />
              </div>
            </div>

            <div className="space-y-4 text-xs text-slate-600 dark:text-zinc-400">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 w-4 h-4 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center shrink-0">
                  <X size={11} />
                </div>
                <div>
                  <strong className="text-slate-800 dark:text-zinc-200 block">Unsynced Student Navigation:</strong>
                  Students pan around, zoom in/out, or get lost on large boards while the teacher is lecturing.
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="mt-0.5 w-4 h-4 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center shrink-0">
                  <X size={11} />
                </div>
                <div>
                  <strong className="text-slate-800 dark:text-zinc-200 block">All-or-Nothing Annotation Chaos:</strong>
                  Enabling drawing allows every student to scribble, overwrite, or erase the teacher&apos;s lesson notes.
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="mt-0.5 w-4 h-4 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center shrink-0">
                  <X size={11} />
                </div>
                <div>
                  <strong className="text-slate-800 dark:text-zinc-200 block">Heavy Multi-Camera Grids:</strong>
                  Dozens of open video feeds consume high student bandwidth, causing frame drops, audio lag, and distractions.
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="mt-0.5 w-4 h-4 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center shrink-0">
                  <X size={11} />
                </div>
                <div>
                  <strong className="text-slate-800 dark:text-zinc-200 block">Zero Native Math or STEM Notation:</strong>
                  Tutors must awkwardly copy-paste Unicode characters or struggle with cumbersome formula extensions.
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="mt-0.5 w-4 h-4 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center shrink-0">
                  <X size={11} />
                </div>
                <div>
                  <strong className="text-slate-800 dark:text-zinc-200 block">High Friction & Downloads:</strong>
                  Students have to download desktop applications, update software, create accounts, or verify logins.
                </div>
              </div>
            </div>
          </div>

          {/* TutorArc.cloud Card */}
          <div className="p-6 sm:p-8 rounded-[5px] bg-white dark:bg-zinc-900/90 border-2 border-blue-500 dark:border-blue-500/80 shadow-2xl shadow-blue-500/10 space-y-6 text-left relative">
            <div className="absolute -top-3 right-6 px-3 py-1 rounded-[5px] bg-linear-to-r from-blue-600 to-indigo-600 text-white text-[10px] font-extrabold uppercase tracking-wider shadow-md">
              Purpose-Built for Teaching
            </div>

            <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-800 pb-4">
              <div>
                <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">The Modern Way</span>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">TutorArc Board</h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400">board.tutorarc.cloud</p>
              </div>
              <div className="w-10 h-10 rounded-[5px] bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-600/30">
                <Sparkles size={20} />
              </div>
            </div>

            <div className="space-y-4 text-xs text-slate-600 dark:text-zinc-400">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 w-4 h-4 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                  <Check size={11} />
                </div>
                <div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <strong className="text-slate-900 dark:text-white">1-Click View-Lock:</strong>
                    <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">ONLY WE GIVE</span>
                  </div>
                  Lock all student screens to follow the teacher&apos;s exact scroll and zoom level with a single button.
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="mt-0.5 w-4 h-4 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                  <Check size={11} />
                </div>
                <div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <strong className="text-slate-900 dark:text-white">Per-Student Granular Permissions:</strong>
                    <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">ONLY WE GIVE</span>
                  </div>
                  Assign drawing access to individual students to solve steps, while keeping everyone else view-only.
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="mt-0.5 w-4 h-4 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                  <Check size={11} />
                </div>
                <div>
                  <strong className="text-slate-900 dark:text-white block">Teacher-Only HD Live Broadcast:</strong>
                  One-way instructor video & audio powered by LiveKit WebRTC keeps bandwidth light and students 100% focused.
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="mt-0.5 w-4 h-4 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                  <Check size={11} />
                </div>
                <div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <strong className="text-slate-900 dark:text-white">Dedicated STEM & Math Palette:</strong>
                    <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">ONLY WE GIVE</span>
                  </div>
                  Instant stamp palette with 16 mathematical symbols (∑, π, ∞, ∫, √, θ...) and customizable coordinate graph axes.
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="mt-0.5 w-4 h-4 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                  <Check size={11} />
                </div>
                <div>
                  <strong className="text-slate-900 dark:text-white block">Zero Installation & Instant Join:</strong>
                  Students join via any browser on mobile, iPad, or desktop in 2 seconds with automatic teacher approval.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 8. Section: Start Your First Session Today ─────────────── */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto text-center space-y-6">
        <h2 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white">
          Start Teaching on TutorArc Board Today
        </h2>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400">
          No credit card required. Free 1-click virtual classroom setup in under 30 seconds.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
          <a
            href={`${TUTORARC_MAIN_URL}/signup`}
            className="px-8 py-3.5 text-xs font-extrabold text-white bg-blue-600 hover:bg-blue-500 rounded-[5px] transition-all shadow-xl shadow-blue-600/30"
          >
            Get Started for Free <span className="ml-1">→</span>
          </a>
          <a
            href={`${TUTORARC_MAIN_URL}/login`}
            className="px-8 py-3.5 text-xs font-extrabold text-slate-700 dark:text-zinc-300 bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-800 rounded-[5px] transition-all"
          >
            Sign In to Classroom
          </a>
        </div>
      </section>

      {/* ── 9. Section: FAQ ─────────────────────────────────────────── */}
      <section id="faq" className="py-16 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto border-t border-slate-200 dark:border-zinc-900 space-y-8 scroll-mt-20">
        <div className="text-center space-y-2">
          <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest">FAQ</p>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">Frequently Asked Questions</h2>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, index) => {
            const isOpen = openFaq === index;
            return (
              <div
                key={index}
                className="rounded-[5px] border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 overflow-hidden transition-all"
              >
                <button
                  onClick={() => setOpenFaq(isOpen ? null : index)}
                  className="w-full px-6 py-4 text-left font-bold text-xs sm:text-sm text-slate-900 dark:text-white flex items-center justify-between gap-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-zinc-800/40 transition-colors"
                >
                  <span>{faq.q}</span>
                  <ChevronDown
                    size={16}
                    className={`text-slate-400 dark:text-zinc-400 transition-transform duration-200 shrink-0 ${
                      isOpen ? "rotate-180 text-blue-600 dark:text-blue-400" : ""
                    }`}
                  />
                </button>
                <div
                  className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out ${
                    isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                  }`}
                >
                  <div className="overflow-hidden">
                    <div className="px-6 pb-4 pt-2 text-xs text-slate-600 dark:text-zinc-400 leading-relaxed border-t border-slate-100 dark:border-zinc-800/60">
                      {faq.a}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── 10. Footer (Theme-Adaptive with Contact Info) ───────────── */}
      <footer className="border-t border-slate-200 dark:border-zinc-900 bg-white dark:bg-zinc-950 text-slate-600 dark:text-zinc-400 py-12 px-4 sm:px-6 lg:px-8 transition-colors duration-200">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8 pb-10 border-b border-slate-200 dark:border-zinc-900">
          {/* Column 1: Logo & Description */}
          <div className="space-y-3 text-left">
            <div className="flex items-center gap-2">
              <Image src={logo} alt="TutorArc Board Logo" height={26} className="h-6.5 w-auto object-contain" />
              <span className="text-[10px] px-2 py-0.5 rounded-[5px] bg-blue-500/10 border border-blue-500/30 text-blue-600 dark:text-blue-400 font-bold uppercase tracking-wider">
                BOARD
              </span>
            </div>
            <p className="text-[11px] leading-relaxed text-slate-500 dark:text-zinc-500 max-w-sm">
              TutorArc Board is an interactive online teaching board and virtual classroom platform for tutors, schools, and academies—empowering educators with real-time whiteboarding, math graphing, and live engagement tools.
            </p>
          </div>

          {/* Column 2: PLATFORM */}
          <div className="space-y-2 text-left">
            <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px]">Platform</h4>
            <ul className="space-y-1.5 text-[11px]">
              <li><a href={`${TUTORARC_MAIN_URL}`} className="hover:text-blue-600 dark:hover:text-white transition-colors">TutorArc Cloud Home</a></li>
              <li><a href={`${TUTORARC_MAIN_URL}/login`} className="hover:text-blue-600 dark:hover:text-white transition-colors">Teacher Sign In</a></li>
              <li><a href={`${TUTORARC_MAIN_URL}/signup`} className="hover:text-blue-600 dark:hover:text-white transition-colors">Create Free Account</a></li>
            </ul>
          </div>

          {/* Column 3: LEGAL */}
          <div className="space-y-2 text-left">
            <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px]">Legal</h4>
            <ul className="space-y-1.5 text-[11px]">
              <li><a href={`${TUTORARC_MAIN_URL}/terms`} className="hover:text-blue-600 dark:hover:text-white transition-colors">Terms of Service</a></li>
              <li><a href={`${TUTORARC_MAIN_URL}/privacy`} className="hover:text-blue-600 dark:hover:text-white transition-colors">Privacy Policy</a></li>
              <li><a href={`${TUTORARC_MAIN_URL}/refund`} className="hover:text-blue-600 dark:hover:text-white transition-colors">Refund Policy</a></li>
            </ul>
          </div>

          {/* Column 4: CONTACT INFO */}
          <div className="space-y-2.5 text-left">
            <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px]">Contact Info</h4>
            <ul className="space-y-2.5 text-[11px]">
              <li className="flex items-start gap-2">
                <MapPin size={14} className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <span className="leading-relaxed text-slate-600 dark:text-zinc-400">Plot No - 22, B - Block, 25 Ft. Road, Amrit Vihar, Delhi - 110084</span>
              </li>
              <li className="flex items-center gap-2">
                <Mail size={14} className="text-blue-600 dark:text-blue-400 shrink-0" />
                <a href="mailto:digital@tutorarc.com" className="hover:text-blue-600 dark:hover:text-white transition-colors">digital@tutorarc.com</a>
              </li>
              <li className="flex items-center gap-2">
                <Phone size={14} className="text-blue-600 dark:text-blue-400 shrink-0" />
                <a href="tel:+911145671601" className="hover:text-blue-600 dark:hover:text-white transition-colors">+91-11-45671601</a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Sub-Footer */}
        <div className="max-w-7xl mx-auto pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-slate-500 dark:text-zinc-500">
          <p>© {new Date().getFullYear()} TutorArc Digital. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <p className="hover:text-slate-800 dark:hover:text-zinc-300 transition-colors inline-flex items-center gap-1">
              Theme Toggle <span className="text-[10px]">:</span>
            </p>
            <ThemeToggle iconSize={16} />
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function HomePageClient() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center h-screen bg-zinc-950 text-white gap-4">
          <Loader2 className="animate-spin text-blue-500" size={40} />
          <p className="text-sm font-bold tracking-widest uppercase opacity-80">Loading TutorArc Board...</p>
        </div>
      }
    >
      <HomePageContent />
    </Suspense>
  );
}
