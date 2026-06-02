"use client";

import { FileQuestion, Home, ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-4 relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px]" />
        <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-secondary-bg/5 rounded-full blur-[120px]" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-md w-full bg-card border border-border rounded-3xl shadow-2xl p-8 md:p-12 text-center relative z-10"
      >
        <div className="flex justify-center mb-6">
          <div className="p-4 bg-primary/10 rounded-2xl">
            <FileQuestion className="w-12 h-12 text-primary" />
          </div>
        </div>

        <h1 className="text-4xl font-bold tracking-tight text-foreground mb-3">
          404
        </h1>
        
        <h2 className="text-xl font-semibold text-foreground mb-3">
          Page not found
        </h2>
        
        <p className="text-muted-foreground mb-8 text-lg">
          The page you are looking for doesn&apos;t exist or has been moved to another URL.
        </p>

        <div className="grid grid-cols-1 gap-3">
          <Link
            href="/"
            className="flex items-center justify-center gap-2 px-6 py-3.5 bg-primary text-primary-foreground font-semibold rounded-xl hover:opacity-90 transition-all active:scale-95 shadow-lg shadow-primary/20"
          >
            <Home className="w-5 h-5" />
            Go back home
          </Link>
          
          <button 
            onClick={() => window.history.back()}
            className="flex items-center justify-center gap-2 px-6 py-3.5 bg-secondary text-secondary-foreground font-semibold rounded-xl hover:bg-secondary/80 transition-all active:scale-95 border border-border"
          >
            <ArrowLeft className="w-5 h-5" />
            Go back
          </button>
        </div>
      </motion.div>
    </div>
  );
}
