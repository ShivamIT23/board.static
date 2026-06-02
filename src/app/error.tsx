"use client";

import { useEffect } from "react";
import { AlertCircle, RefreshCcw, Home, ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error);
  }, [error]);

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
          <div className="p-4 bg-destructive/10 rounded-2xl">
            <AlertCircle className="w-12 h-12 text-destructive" />
          </div>
        </div>

        <h1 className="text-3xl font-bold tracking-tight text-foreground mb-3">
          Something went wrong
        </h1>
        
        <p className="text-muted-foreground mb-8 text-lg">
          We encountered an unexpected error. Don&apos;t worry, it&apos;s not your fault. 
          {process.env.NODE_ENV === 'development' && (
            <span className="block mt-2 text-sm font-mono bg-muted p-2 rounded border border-border overflow-x-auto text-left">
              {error.message || "Unknown error"}
            </span>
          )}
        </p>

        <div className="grid grid-cols-1 gap-3">
          <button
            onClick={() => reset()}
            className="flex items-center justify-center gap-2 px-6 py-3.5 bg-primary text-primary-foreground font-semibold rounded-xl hover:opacity-90 transition-all active:scale-95 shadow-lg shadow-primary/20"
          >
            <RefreshCcw className="w-5 h-5" />
            Try again
          </button>
          
          <Link
            href="/"
            className="flex items-center justify-center gap-2 px-6 py-3.5 bg-secondary text-secondary-foreground font-semibold rounded-xl hover:bg-secondary/80 transition-all active:scale-95 border border-border"
          >
            <Home className="w-5 h-5" />
            Go back home
          </Link>
        </div>

        <div className="mt-10 pt-8 border-t border-border flex justify-center">
          <button 
            onClick={() => window.history.back()}
            className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Previous page
          </button>
        </div>
      </motion.div>
    </div>
  );
}
