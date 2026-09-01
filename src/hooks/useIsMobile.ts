"use client";

import { useState, useEffect } from "react";

/**
 * Returns true when the viewport width is less than 768px (mobile).
 * SSR-safe: defaults to false on the server.
 */
export function useIsMobile(breakpoint = 768): boolean {
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
        const onChange = (e: MediaQueryListEvent | MediaQueryList) => {
            setIsMobile(e.matches);
        };
        // Set initial value
        onChange(mql);
        mql.addEventListener("change", onChange as (e: MediaQueryListEvent) => void);
        return () => mql.removeEventListener("change", onChange as (e: MediaQueryListEvent) => void);
    }, [breakpoint]);

    return isMobile;
}
