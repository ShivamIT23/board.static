"use client"

import { useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2 } from "lucide-react"

function EntryPageContent() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const sId = searchParams.get("session")
    const r = searchParams.get("role")

    // Determine status during render to avoid cascading renders
    const status = (sId && r) ? "Redirecting..." : "Please use a valid session link"

    useEffect(() => {
        if (sId && r) {
            const paramsStr = searchParams.toString();
            router.replace(`/${r}/${sId}?${paramsStr}`)
        }
    }, [router, sId, r, searchParams])

    return (
        <div className="flex flex-col items-center justify-center h-screen bg-zinc-950 text-white gap-4">
            <Loader2 className="animate-spin text-blue-500" size={40} />
            <p className="text-sm font-bold tracking-widest uppercase opacity-50">{status}</p>
        </div>
    )
}

export default function EntryPage() {
    return (
        <Suspense fallback={
            <div className="flex flex-col items-center justify-center h-screen bg-zinc-950 text-white gap-4">
                <Loader2 className="animate-spin text-blue-500" size={40} />
                <p className="text-sm font-bold tracking-widest uppercase opacity-50">Loading...</p>
            </div>
        }>
            <EntryPageContent />
        </Suspense>
    )
}
