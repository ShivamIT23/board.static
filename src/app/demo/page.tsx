import type { Metadata } from "next";
import DemoBoard from "@/components/Demo/DemoBoard";

export const metadata: Metadata = {
    title: "Interactive Live Board Demo - WhiteBoardZone",
    description: "Try out the WhiteBoardZone interactive digital board, drawing tools, local video stream, and simulated classroom environment in demo mode.",
};

export default function DemoPage() {
    return <DemoBoard />;
}
