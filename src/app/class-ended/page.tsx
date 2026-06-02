"use client";
import { motion } from 'framer-motion';
import ThemeToggle from "@/components/theme-toggle";

export default function ClassEndedPage() {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 p-4 font-sans transition-colors duration-300">
            {/* Theme Toggle Button */}
            <div className="absolute top-8 right-8">
                <ThemeToggle />
            </div>

            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="max-w-md w-full text-center space-y-8"
            >
                <div className="flex justify-center">
                    <div className="bg-slate-100 dark:bg-zinc-900 p-4 rounded-full transition-colors">
                        <svg className="w-12 h-12 text-slate-400 dark:text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                </div>
                
                <div className="space-y-2">
                    <h1 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">Class Ended</h1>
                    <p className="text-xl text-slate-600 dark:text-zinc-400">This class has ended. Thank You.</p>
                </div>

                <div className="pt-8 border-t border-slate-200 dark:border-zinc-800">
                    <p className="text-sm text-slate-400 dark:text-zinc-600 italic">You can close this tab now.</p>
                </div>
            </motion.div>
        </div>
    );
}
