# **UI/UX Design & Frontend Implementation Guide: EduRoute Bontang**

## **1\. Konsep Visual & Layout**

### **Filosofi Desain: "Clean & Map-Centric"**

Karena ini adalah aplikasi GIS, peta adalah aktor utamanya. UI (User Interface) akan bersifat "Floating" (melayang) di atas peta, bukan memotong layar secara kaku. Kita akan menggunakan gaya **Glassmorphism** halus pada panel kontrol agar peta di belakangnya tetap terasa menyatu.

### **Palet Warna (Tailwind)**

* **Primary:** emerald-600 (Merepresentasikan zona hijau/pertumbuhan/sekolah).  
* **Secondary:** sky-500 (Merepresentasikan laut Bontang & teknologi).  
* **Accent:** amber-400 (Untuk highlight rute bus/peringatan).  
* **Background UI:** slate-50/90 (Putih transparan).

### **Layout Structure (Z-Index Strategy)**

1. **Layer 0 (Bottom):** Leaflet Map Container (Fullscreen).  
2. **Layer 10 (Middle):** Floating Controls (Zoom, Layer Toggle).  
3. **Layer 20 (Top):** Sidebar/Drawer & Modals (shadcn components).  
4. **Layer 50 (Overlay):** Toast Notifications & Loading Screen.

## **2\. Pemanfaatan Komponen shadcn/ui**

Kita tidak perlu membuat komponen dari nol. Berikut adalah mapping fitur ke komponen shadcn:

| Fitur Aplikasi | Komponen shadcn/ui | Keterangan |
| :---- | :---- | :---- |
| **Search Bar** | Command / Combobox | Untuk pencarian sekolah dengan autocomplete. |
| **Sidebar Menu** | Sheet | Menu yang muncul dari kiri (Slide-in) berisi filter & list sekolah. |
| **Info Sekolah** | Card | Menampilkan foto, alamat, dan detail saat marker diklik. |
| **Tab Navigasi** | Tabs | Switch antara mode "Info Umum" dan "Cari Rute (A\*)". |
| **Filter Layer** | Switch & Label | Toggle ON/OFF untuk layer Zonasi, Rute Bus, Angkot. |
| **Notifikasi** | Toast (Sonner) | Feedback saat "Rute ditemukan" atau "Anda di luar zona". |
| **Loading State** | Skeleton | Placeholder saat data GeoJSON sedang di-fetch. |
| **Tombol Aksi** | Button | Style: Outline untuk sekunder, Solid untuk primary. |

## **3\. Strategi Animasi GSAP**

GSAP akan digunakan untuk memberikan kesan "hidup" dan "fluid", bukan sekadar transisi CSS biasa.

1. **Intro Sequence (Landing):**  
   * Logo dan Judul fade-in dari bawah.  
   * Peta scale-up dari 0.9 ke 1 (memberi kesan "membuka dunia").  
2. **Sidebar Interactions:**  
   * List Sekolah muncul dengan efek **Stagger** (muncul berurutan satu per satu) saat Sidebar dibuka.  
3. \**Route Finding (A* Execution):\*\*  
   * Saat tombol "Cari Rute" ditekan, panel hasil rute akan slide-up dari bawah dengan efek elastic (memantul sedikit).  
4. **Marker Selection:**  
   * Detail Card akan fade-in \+ y-move halus.

## **4\. Panduan Implementasi Kode**

Berikut adalah contoh implementasi struktur React menggunakan Vite, shadcn, dan GSAP.

### **A. Persiapan**

Install library yang dibutuhkan:

npm install gsap @gsap/react lucide-react clsx tailwind-merge  
npx shadcn-ui@latest init  
npx shadcn-ui@latest add button card sheet command tabs switch label toast skeleton input

### **B. Komponen: MapOverlay.jsx (Floating UI)**

Ini adalah komponen UI utama yang melayang di atas peta.

import React, { useRef } from 'react';  
import { useGSAP } from '@gsap/react';  
import gsap from 'gsap';  
import { Search, MapPin, Bus, Layers } from 'lucide-react';  
import { Button } from "@/components/ui/button";  
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";  
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";  
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";  
import { Switch } from "@/components/ui/switch";  
import { Label } from "@/components/ui/label";

const MapOverlay \= ({ onSearchRoute, toggleLayer, layersState }) \=\> {  
  const containerRef \= useRef();

  // GSAP Animation: Intro UI elements  
  useGSAP(() \=\> {  
    // Animate Search Bar turun dari atas  
    gsap.from(".floating-search", {  
      y: \-100,  
      opacity: 0,  
      duration: 1,  
      ease: "power3.out",  
      delay: 0.5  
    });

    // Animate Bottom Card (jika ada)  
    gsap.from(".floating-controls", {  
      y: 100,  
      opacity: 0,  
      duration: 1,  
      ease: "back.out(1.7)", // Efek memantul  
      delay: 0.8  
    });  
  }, { scope: containerRef });

  return (  
    \<div ref={containerRef} className="absolute inset-0 pointer-events-none z-\[1000\] flex flex-col justify-between p-4"\>  
        
      {/\* \--- TOP BAR: Search & Sidebar Trigger \--- \*/}  
      \<div className="floating-search flex gap-2 pointer-events-auto w-full max-w-md mx-auto md:mx-0"\>  
        \<Sheet\>  
          \<SheetTrigger asChild\>  
            \<Button variant="outline" size="icon" className="bg-white/90 backdrop-blur shadow-md"\>  
              \<Layers className="h-5 w-5 text-slate-700" /\>  
            \</Button\>  
          \</SheetTrigger\>  
          \<SheetContent side="left" className="w-\[350px\] sm:w-\[400px\]"\>  
            \<SheetHeader\>  
              \<SheetTitle className="text-emerald-600 font-bold text-2xl"\>EduRoute Menu\</SheetTitle\>  
            \</SheetHeader\>  
              
            {/\* Menu Content \*/}  
            \<div className="mt-6 space-y-6"\>  
              \<div className="space-y-4"\>  
                \<h4 className="text-sm font-medium text-slate-500 uppercase tracking-wider"\>Layer Peta\</h4\>  
                  
                \<div className="flex items-center justify-between"\>  
                  \<Label htmlFor="zonasi" className="flex items-center gap-2"\>\<MapPin className="w-4 h-4 text-red-500"/\> Area Zonasi\</Label\>  
                  \<Switch id="zonasi" checked={layersState.zones} onCheckedChange={() \=\> toggleLayer('zones')} /\>  
                \</div\>  
                  
                \<div className="flex items-center justify-between"\>  
                  \<Label htmlFor="bus" className="flex items-center gap-2"\>\<Bus className="w-4 h-4 text-amber-500"/\> Rute Bus Sekolah\</Label\>  
                  \<Switch id="bus" checked={layersState.bus} onCheckedChange={() \=\> toggleLayer('bus')} /\>  
                \</div\>

                \<div className="flex items-center justify-between"\>  
                  \<Label htmlFor="angkot" className="flex items-center gap-2"\>\<Bus className="w-4 h-4 text-green-600"/\> Rute Angkot\</Label\>  
                  \<Switch id="angkot" checked={layersState.angkot} onCheckedChange={() \=\> toggleLayer('angkot')} /\>  
                \</div\>  
              \</div\>  
            \</div\>  
          \</SheetContent\>  
        \</Sheet\>

        {/\* Fake Search Input (Trigger Command Dialog) \*/}  
        \<div className="flex-1 bg-white/90 backdrop-blur shadow-md rounded-md px-4 py-2 flex items-center gap-2 text-slate-500 cursor-pointer hover:bg-white transition-colors"\>  
          \<Search className="w-4 h-4" /\>  
          \<span className="text-sm"\>Cari Sekolah atau Alamat...\</span\>  
        \</div\>  
      \</div\>

      {/\* \--- BOTTOM RIGHT: Route Finder / Action Panel \--- \*/}  
      \<div className="floating-controls pointer-events-auto self-end md:w-96 w-full"\>  
        \<Card className="bg-white/95 backdrop-blur-md shadow-xl border-emerald-100/50"\>  
          \<CardHeader className="pb-2"\>  
            \<CardTitle className="text-lg text-emerald-700"\>Navigasi Sekolah\</CardTitle\>  
          \</CardHeader\>  
          \<CardContent\>  
            \<Tabs defaultValue="info" className="w-full"\>  
              \<TabsList className="grid w-full grid-cols-2"\>  
                \<TabsTrigger value="info"\>Info\</TabsTrigger\>  
                \<TabsTrigger value="route"\>Cari Rute\</TabsTrigger\>  
              \</TabsList\>  
                
              \<TabsContent value="info" className="text-sm text-slate-600 mt-4 min-h-\[100px\] flex items-center justify-center"\>  
                \<p\>Klik marker sekolah di peta untuk melihat detail zonasi.\</p\>  
              \</TabsContent\>  
                
              \<TabsContent value="route" className="mt-4 space-y-3"\>  
                \<div className="p-3 bg-slate-50 rounded border border-slate-100"\>  
                  \<p className="text-xs font-bold text-slate-400 mb-1"\>DARI\</p\>  
                  \<div className="flex items-center gap-2 text-sm font-medium"\>  
                    \<MapPin className="w-4 h-4 text-blue-500" /\>  
                    \<span\>Lokasi Anda (GPS)\</span\>  
                  \</div\>  
                \</div\>  
                \<div className="p-3 bg-slate-50 rounded border border-slate-100"\>  
                  \<p className="text-xs font-bold text-slate-400 mb-1"\>KE\</p\>  
                  \<div className="flex items-center gap-2 text-sm text-slate-400"\>  
                    \<MapPin className="w-4 h-4" /\>  
                    \<span\>Pilih Sekolah di Peta...\</span\>  
                  \</div\>  
                \</div\>  
                \<Button className="w-full bg-emerald-600 hover:bg-emerald-700" onClick={onSearchRoute}\>  
                  Mulai Navigasi  
                \</Button\>  
              \</TabsContent\>  
            \</Tabs\>  
          \</CardContent\>  
        \</Card\>  
      \</div\>  
    \</div\>  
  );  
};

export default MapOverlay;

### **C. Komponen: LandingIntro.jsx (Splash Screen)**

Halaman pembuka sebelum masuk ke peta, menggunakan GSAP Timeline.

import React, { useRef } from 'react';  
import { useGSAP } from '@gsap/react';  
import gsap from 'gsap';  
import { Button } from "@/components/ui/button";  
import { ArrowRight } from "lucide-react";

const LandingIntro \= ({ onStart }) \=\> {  
  const comp \= useRef();

  useGSAP(() \=\> {  
    const tl \= gsap.timeline();

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
    \<div ref={comp} className="fixed inset-0 bg-gradient-to-br from-emerald-50 to-sky-50 z-\[5000\] flex flex-col items-center justify-center text-center p-6"\>  
      \<h1 className="title-text text-5xl md:text-7xl font-extrabold text-emerald-800 mb-2"\>  
        EduRoute  
      \</h1\>  
      \<h2 className="title-text text-3xl md:text-5xl font-bold text-sky-600 mb-6"\>  
        Bontang  
      \</h2\>  
      \<p className="subtitle text-slate-600 text-lg md:text-xl max-w-lg mb-10 leading-relaxed"\>  
        Sistem Informasi Geografis Zonasi Sekolah & Rute Transportasi Terintegrasi.  
      \</p\>  
        
      \<Button   
        size="lg"   
        className="start-btn bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-6 text-lg rounded-full shadow-lg shadow-emerald-200"  
        onClick={onStart}  
      \>  
        Buka Peta \<ArrowRight className="ml-2 w-5 h-5" /\>  
      \</Button\>  
    \</div\>  
  );  
};

export default LandingIntro;

### **D. Integrasi di App.jsx**

Menggabungkan Landing, Map, dan Overlay.

import React, { useState } from 'react';  
import { useGSAP } from '@gsap/react';  
import gsap from 'gsap';  
import MapView from './components/MapView'; // Komponen Leaflet Anda  
import MapOverlay from './components/MapOverlay';  
import LandingIntro from './components/LandingIntro';

const App \= () \=\> {  
  const \[showMap, setShowMap\] \= useState(false);  
  const \[layersState, setLayersState\] \= useState({  
    zones: true,  
    bus: true,  
    angkot: true  
  });

  const handleStart \= () \=\> {  
    // Animasi transisi keluar Landing page  
    gsap.to(".landing-container", {  
      y: "-100%",  
      duration: 1,  
      ease: "power4.inOut",  
      onComplete: () \=\> setShowMap(true)  
    });  
  };

  const handleToggleLayer \= (layerName) \=\> {  
    setLayersState(prev \=\> ({ ...prev, \[layerName\]: \!prev\[layerName\] }));  
  };

  return (  
    \<div className="h-screen w-full overflow-hidden relative font-sans"\>  
        
      {/\* 1\. Landing Page Layer \*/}  
      {\!showMap && (  
        \<div className="landing-container absolute inset-0 z-50"\>  
          \<LandingIntro onStart={handleStart} /\>  
        \</div\>  
      )}

      {/\* 2\. Main App Layer \*/}  
      \<div className={\`absolute inset-0 transition-opacity duration-1000 ${showMap ? 'opacity-100' : 'opacity-0'}\`}\>  
          
        {/\* UI Overlay (shadcn \+ GSAP) \*/}  
        \<MapOverlay   
          layersState={layersState}  
          toggleLayer={handleToggleLayer}  
          onSearchRoute={() \=\> console.log("Trigger A\* Logic in Backend")}  
        /\>

        {/\* Leaflet Map (Z-Index 0\) \*/}  
        \<MapView layersState={layersState} /\>  
          
      \</div\>  
    \</div\>  
  );  
};

export default App;  
