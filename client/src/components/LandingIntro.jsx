import React, { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

const LandingIntro = ({ onStart }) => {
    const comp = useRef();

    useGSAP(() => {
        const tl = gsap.timeline();

        tl.from(".title-text", {
            y: 50,
            opacity: 0,
            duration: 0.8,
            stagger: 0.2,
            ease: "power3.out"
        })
            .from(".subtitle", {
                opacity: 0,
                duration: 1
            }, "-=0.4")
            .from(".start-btn", {
                scale: 0,
                opacity: 0,
                duration: 0.5,
                ease: "back.out(1.7)"
            });

    }, { scope: comp });

    return (
        <div ref={comp} className="fixed inset-0 bg-gradient-to-br from-emerald-50 to-sky-50 z-[5000] flex flex-col items-center justify-center text-center p-6">
            <h1 className="title-text text-5xl md:text-7xl font-extrabold text-emerald-800 mb-2">
                EduRoute
            </h1>
            <h2 className="title-text text-3xl md:text-5xl font-bold text-sky-600 mb-6">
                Bontang
            </h2>
            <p className="subtitle text-slate-600 text-lg md:text-xl max-w-lg mb-10 leading-relaxed">
                Sistem Informasi Geografis Zonasi Sekolah & Rute Transportasi Terintegrasi.
            </p>

            <Button
                size="lg"
                className="start-btn bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-6 text-lg rounded-full shadow-lg shadow-emerald-200"
                onClick={onStart}
            >
                Buka Peta <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
        </div>
    );
};

export default LandingIntro;
