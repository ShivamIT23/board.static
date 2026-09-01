import { Metadata } from "next";
import HomePageClient from "@/components/Home/HomePageClient";

export const metadata: Metadata = {
  title: "Online Teaching Board & Virtual Classroom | TutorArc Board",
  description:
    "Teach online with TutorArc Board, an interactive virtual classroom and digital whiteboard with live chat, file sharing, drawing tools, math symbols, graphs, audio, video and more.",
  keywords: [
    "online teaching board",
    "online whiteboard for teachers",
    "interactive online whiteboard",
    "virtual classroom",
    "digital teaching board",
    "online whiteboard for teachers and students",
    "interactive whiteboard for online classes",
    "virtual classroom with interactive whiteboard",
    "online teaching board with live chat",
    "online whiteboard with math tools",
    "online teaching board with graphing tools",
    "online classroom with file sharing",
    "real-time collaborative teaching board",
    "digital whiteboard for virtual classrooms",
    "online whiteboard for math teachers",
    "online teaching platform with live chat",
    "TutorArc Board"
  ],
  metadataBase: new URL("https://board.tutorarc.cloud"),
  alternates: {
    canonical: "https://board.tutorarc.cloud"
  },
  openGraph: {
    title: "Online Teaching Board & Virtual Classroom | TutorArc Board",
    description:
      "Teach online with TutorArc Board, an interactive virtual classroom and digital whiteboard with live chat, file sharing, drawing tools, math symbols, graphs, audio, video and more.",
    url: "https://board.tutorarc.cloud",
    siteName: "TutorArc Board",
    type: "website",
    locale: "en_US",
    images: [
      {
        url: "/home1.png",
        width: 1200,
        height: 800,
        alt: "TutorArc Board - Interactive Online Teaching Board and Virtual Classroom"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "Online Teaching Board & Virtual Classroom | TutorArc Board",
    description:
      "Teach online with TutorArc Board, an interactive virtual classroom and digital whiteboard with live chat, file sharing, drawing tools, math symbols, graphs, audio, video and more.",
    images: ["/home1.png"]
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1
    }
  }
};

export default function RootPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SoftwareApplication",
        "name": "TutorArc Board",
        "applicationCategory": "EducationalApplication",
        "operatingSystem": "Web Browser",
        "offers": {
          "@type": "Offer",
          "price": "0",
          "priceCurrency": "USD"
        },
        "description":
          "TutorArc Board is an interactive online teaching board and virtual classroom for teachers, featuring collaborative vector whiteboards, precision math and graphing tools, live chat, file sharing, and teacher audio and video streaming.",
        "url": "https://board.tutorarc.cloud",
        "publisher": {
          "@type": "Organization",
          "name": "TutorArc Cloud",
          "url": "https://tutorarc.cloud"
        },
        "featureList": [
          "Interactive online whiteboard",
          "Digital teaching board with pen, highlighter, eraser, and laser pointer",
          "Mathematical symbols and coordinate graphing tools",
          "Geometric shapes, lines, and directional arrows",
          "Live classroom chat with emoji reactions and file sharing",
          "Teacher-only live audio and one-way video streaming",
          "Role-based access control and student drawing permissions",
          "One-click classroom recording and replay"
        ]
      },
      {
        "@type": "FAQPage",
        "mainEntity": [
          {
            "@type": "Question",
            "name": "What is TutorArc Board?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "TutorArc Board is an interactive online teaching board and virtual classroom platform built for educators, tutors, and schools. It combines a real-time collaborative digital whiteboard, high-precision math and graphing tools, live classroom chat, file sharing, and teacher live audio and video streaming in a single browser-based application."
            }
          },
          {
            "@type": "Question",
            "name": "How does TutorArc Board support math, science, and STEM teachers?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "TutorArc Board includes specialized tools for STEM instruction, such as customizable coordinate graphing planes, mathematical symbols and notation, directional arrows, geometric shapes (rectangles, ellipses, triangles, parallelograms, stars), and a fluid vector drawing pen and highlighter."
            }
          },
          {
            "@type": "Question",
            "name": "Can teachers control student permissions during class?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Yes. TutorArc Board features robust role-based access control. Teachers can toggle drawing permissions per student or globally, restrict or enable live chat, approve student admission, lock the student canvas view to follow the teacher, and manage audio/video interactions."
            }
          },
          {
            "@type": "Question",
            "name": "How do audio, video, and screen sharing work?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "TutorArc Board features integrated teacher-only live video and audio broadcasting powered by WebRTC (LiveKit). This one-way video model ensures students can see and hear the instructor with ultra-low latency while keeping the whiteboard front and center without bandwidth bottlenecks."
            }
          },
          {
            "@type": "Question",
            "name": "Do students need to install software or create an account?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "No installation or registration is required for students. Students simply click the unique session link provided by the teacher and join the virtual classroom instantly from any modern web browser on PC, Mac, iPad, Chromebook, or mobile device."
            }
          },
          {
            "@type": "Question",
            "name": "Can I share files and record lessons for revision?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Yes. Teachers can upload and share document attachments and PDFs directly into the classroom chat. Additionally, teachers can record live whiteboard sessions with one click to generate replayable recordings for student revision."
            }
          }
        ]
      }
    ]
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <HomePageClient />
    </>
  );
}
