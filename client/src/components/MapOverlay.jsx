import React, { useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { Search, MapPin, Bus, Layers, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

const MapOverlay = ({ onSearchRoute, toggleLayer, layersState, routeData, schools = [], onSelectSchool }) => {
    const containerRef = useRef();
    const [isExpanded, setIsExpanded] = useState(true);

    // GSAP Animation: Intro UI elements
    useGSAP(() => {
        gsap.from(".floating-search", {
            y: -100,
            opacity: 0,
            duration: 1,
            ease: "power3.out",
            delay: 0.5
        });

        gsap.from(".floating-controls", {
            y: 100,
            opacity: 0,
            duration: 1,
            ease: "back.out(1.7)",
            delay: 0.8
        });
    }, { scope: containerRef });

    return (
        <div ref={containerRef} className="absolute inset-0 pointer-events-none z-[10] flex flex-col justify-between p-4">

            {/* --- TOP BAR: Search & Sidebar Trigger --- */}
            <div className="floating-search flex gap-2 pointer-events-auto w-full max-w-md mx-auto md:mx-0">
                <Sheet>
                    <SheetTrigger asChild>
                        <Button variant="outline" size="icon" className="bg-white/90 backdrop-blur shadow-md h-10 w-10 shrink-0">
                            <Layers className="h-5 w-5 text-slate-700" />
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="w-[300px] sm:w-[400px] z-[100]">
                        <SheetHeader>
                            <SheetTitle className="text-emerald-600 font-bold text-2xl">EduRoute Menu</SheetTitle>
                            <SheetDescription>
                                Atur tampilan peta dan filter informasi yang ingin ditampilkan.
                            </SheetDescription>
                        </SheetHeader>

                        {/* Menu Content */}
                        <div className="mt-6 space-y-6">
                            <div className="space-y-4">
                                <h4 className="text-sm font-medium text-slate-500 uppercase tracking-wider">Layer Peta</h4>

                                <div className="flex items-center justify-between">
                                    <Label htmlFor="zonasi" className="flex items-center gap-2 cursor-pointer"><MapPin className="w-4 h-4 text-red-500" /> Area Zonasi</Label>
                                    <Switch id="zonasi" checked={layersState.zones} onCheckedChange={() => toggleLayer('zones')} />
                                </div>

                                <div className="flex items-center justify-between">
                                    <Label htmlFor="bus" className="flex items-center gap-2 cursor-pointer"><Bus className="w-4 h-4 text-amber-500" /> Rute Bus Sekolah</Label>
                                    <Switch id="bus" checked={layersState.bus} onCheckedChange={() => toggleLayer('bus')} />
                                </div>

                                <div className="flex items-center justify-between">
                                    <Label htmlFor="angkot" className="flex items-center gap-2 cursor-pointer"><Bus className="w-4 h-4 text-green-600" /> Rute Angkot</Label>
                                    <Switch id="angkot" checked={layersState.angkot} onCheckedChange={() => toggleLayer('angkot')} />
                                </div>

                                <div className="flex items-center justify-between pt-2 border-t border-slate-100 mt-2">
                                    <Label htmlFor="graph" className="flex items-center gap-2 cursor-pointer text-slate-400 text-xs uppercase font-bold tracking-wider">
                                        <Layers className="w-3 h-3" /> Debug Graph
                                    </Label>
                                    <Switch id="graph" checked={layersState.graph} onCheckedChange={() => toggleLayer('graph')} />
                                </div>
                            </div>

                            {/* New Section: List of Schools */}
                            <div className="space-y-4 pt-4 border-t border-slate-100">
                                <h4 className="text-sm font-medium text-slate-500 uppercase tracking-wider">Data Sekolah ({schools.length})</h4>

                                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                                    {schools.length === 0 ? (
                                        <p className="text-sm text-slate-400 italic">Memuat data...</p>
                                    ) : (
                                        schools.map((school, idx) => (
                                            <div
                                                key={idx}
                                                className="p-3 bg-slate-50 hover:bg-emerald-50 border border-slate-100 rounded-md cursor-pointer transition-colors group"
                                                onClick={() => onSelectSchool && onSelectSchool(school)}
                                            >
                                                <div className="flex items-start gap-3">
                                                    <div className="mt-1 w-2 h-2 rounded-full bg-emerald-500 shrink-0 group-hover:scale-125 transition-transform" />
                                                    <div>
                                                        <h5 className="text-sm font-bold text-slate-700">{school.properties.name}</h5>
                                                        <p className="text-xs text-slate-500 line-clamp-1">{school.properties.address}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    </SheetContent>
                </Sheet>

                {/* Search Bar */}
                <div className="flex-1 bg-white/90 backdrop-blur shadow-md rounded-md px-4 h-10 flex items-center gap-2 text-slate-500 cursor-pointer hover:bg-white transition-colors overflow-hidden">
                    <Search className="w-4 h-4 shrink-0" />
                    <span className="text-sm truncate">Cari Sekolah / Alamat...</span>
                </div>
            </div>

            {/* --- BOTTOM RIGHT: Route Finder / Action Panel --- */}
            <div className="floating-controls pointer-events-auto self-end md:w-96 w-full mt-auto">
                <Card className="bg-white/95 backdrop-blur-md shadow-xl border-emerald-100/50 transition-all duration-300">
                    <CardHeader className="py-3 px-4 flex flex-row items-center justify-between space-y-0 cursor-pointer border-b border-slate-100" onClick={() => setIsExpanded(!isExpanded)}>
                        <CardTitle className="text-base text-emerald-700 font-bold flex items-center gap-2">
                            Navigasi Sekolah
                        </CardTitle>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-slate-100 rounded-full">
                            {isExpanded ? <ChevronDown className="h-4 w-4 text-slate-500" /> : <ChevronUp className="h-4 w-4 text-slate-500" />}
                        </Button>
                    </CardHeader>

                    {isExpanded && (
                        <CardContent className="p-4 pt-4">
                            {/* Route Stats (Visible if route exists) */}
                            {routeData && (
                                <div className="mb-4 bg-emerald-50 border border-emerald-200 rounded p-3 flex justify-between items-center animate-in fade-in slide-in-from-bottom-2">
                                    <div className="text-center">
                                        <div className="text-xs text-slate-500 uppercase tracking-wide">Jarak</div>
                                        <div className="font-bold text-emerald-700 text-lg">{(routeData.distance_meters / 1000).toFixed(1)} km</div>
                                    </div>
                                    <div className="h-8 w-px bg-emerald-200"></div>
                                    <div className="text-center">
                                        <div className="text-xs text-slate-500 uppercase tracking-wide">Estimasi</div>
                                        <div className="font-bold text-emerald-700 text-lg">
                                            {routeData.duration_minutes ? Math.ceil(routeData.duration_minutes) : Math.ceil((routeData.distance_meters / 1000) / 30 * 60)} min
                                        </div>
                                    </div>
                                </div>
                            )}

                            <Tabs defaultValue="route" className="w-full">
                                <TabsList className="grid w-full grid-cols-2 h-9 mb-3">
                                    <TabsTrigger value="info" className="text-xs">Info</TabsTrigger>
                                    <TabsTrigger value="route" className="text-xs">Rute</TabsTrigger>
                                </TabsList>

                                <TabsContent value="info" className="text-sm text-slate-600 min-h-[80px] flex items-center justify-center text-center px-4">
                                    <p>Klik marker sekolah di peta untuk melihat detail zonasi.</p>
                                </TabsContent>

                                <TabsContent value="route" className="space-y-3">
                                    <div className="p-2.5 bg-slate-50 rounded border border-slate-100 flex items-center gap-3">
                                        <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0"></div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase leading-none mb-1">DARI</p>
                                            <p className="text-sm font-medium truncate text-slate-700">Lokasi Anda</p>
                                        </div>
                                    </div>
                                    <div className="p-2.5 bg-slate-50 rounded border border-slate-100 flex items-center gap-3">
                                        <div className="w-2 h-2 rounded-full bg-red-500 shrink-0"></div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase leading-none mb-1">KE</p>
                                            <p className="text-sm font-medium truncate text-slate-700">Target Sekolah...</p>
                                        </div>
                                    </div>
                                    <Button className="w-full bg-emerald-600 hover:bg-emerald-700 h-10 shadow-lg shadow-emerald-600/20" onClick={onSearchRoute}>
                                        Mulai Navigasi
                                    </Button>
                                </TabsContent>
                            </Tabs>
                        </CardContent>
                    )}
                </Card>
            </div>
        </div>
    );
};

export default MapOverlay;
