import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import MapView from './components/MapView';
import MapOverlay from './components/MapOverlay';
import LandingIntro from './components/LandingIntro';
import { Toaster } from "@/components/ui/sonner"; // If installing shadcn toast (sonner)

const App = () => {
  const [showMap, setShowMap] = useState(false);
  const [layersState, setLayersState] = useState({
    zones: true,
    bus: true,
    angkot: true,
    graph: false // Default off to avoid clutter
  });

  const [schools, setSchools] = useState([]);
  const [zones, setZones] = useState([]);
  const [graphNodes, setGraphNodes] = useState([]); // Nodes for visualization
  const [graphEdges, setGraphEdges] = useState([]); // Edges for visualization
  const [routeData, setRouteData] = useState(null); // { path, distance_meters, duration_minutes }

  // Fetch Data Global
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [gisRes, nodesRes, edgesRes] = await Promise.all([
          axios.get('http://localhost:5000/api/gis-data'),
          axios.get('http://localhost:5000/api/graph/nodes'),
          axios.get('http://localhost:5000/api/graph/edges')
        ]);

        setSchools(gisRes.data.schools.features);
        setZones(gisRes.data.zones.features);
        setGraphNodes(nodesRes.data);
        setGraphEdges(edgesRes.data);
      } catch (error) {
        console.error("Error fetching data:", error);
        toast.error("Gagal memuat data dari server.");
      }
    };
    fetchData();
  }, []);

  const handleStart = () => {
    // Animasi transisi keluar Landing page
    gsap.to(".landing-container", {
      y: "-100%",
      duration: 1,
      ease: "power4.inOut",
      onComplete: () => setShowMap(true)
    });
  };

  const handleToggleLayer = (layerName) => {
    setLayersState(prev => ({ ...prev, [layerName]: !prev[layerName] }));
  };

  const handleRouteFound = (data) => {
    console.log("Route Found:", data);
    setRouteData(data);
  };

  // Function to fly to school (passed to overlay)
  const handleSelectSchool = (school) => {
    // We can pass a "selectedLocation" state to MapView to trigger a FlyTo
    // For now, let's just log or maybe set a "focusedSchool" state if we want to implement FlyTo
    console.log("Selected School:", school.properties.name);
    // TODO: Implement FlyTo logic in MapView
  };

  return (
    <div className="h-screen w-full overflow-hidden relative font-sans bg-slate-50">

      {/* 1. Landing Page Layer (Z-Index 5000 inside component) */}
      <div className="landing-container absolute inset-0 z-50">
        <LandingIntro onStart={handleStart} />
      </div>

      {/* 2. Main App Layer */}
      {/* Opacity transition for smooth appearance after landing */}
      <div className={`absolute inset-0 transition-opacity duration-1000 delay-500`}>

        {/* UI Overlay (shadcn + GSAP) */}
        <MapOverlay
          layersState={layersState}
          toggleLayer={handleToggleLayer}
          routeData={routeData} // Pass route statistics
          schools={schools}     // Pass schools list
          onSelectSchool={handleSelectSchool}
          onSearchRoute={() => {
            console.log("Trigger Route Search");
            // Optional: We can clear route here
            setRouteData(null);
          }}
        />

        {/* Leaflet Map (Z-Index 0) */}
        {/* We pass handleRouteFound to let MapView update the global state */}
        <MapView
          layersState={layersState}
          schools={schools} // Pass data down
          zones={zones}     // Pass data down
          graphNodes={graphNodes} // Pass graph data
          graphEdges={graphEdges} // Pass graph data
          onRouteFound={handleRouteFound}
          currentRoutePath={routeData?.path || []} // Pass path back to MapView for rendering
        />

      </div>

      <Toaster />
    </div>
  );
};

export default App;
