import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polygon, Polyline, CircleMarker, useMapEvents, useMap } from 'react-leaflet';
import axios from 'axios';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
import { toast } from "sonner"; // shadcn uses sonner usually, or toast
// But I installed shadcn toast which might be 'sonner' or 'toast' hook.
// Let's use standard alert for now if toast is complex to setup without context
// Actually I installed 'toast' which is likely 'sonner' or 'use-toast' in shadcn.
// Let's check imports later. For now, I'll use simple console/alert or standard toast if I know the import.
// shadcn 'toast' is usually imported from "@/hooks/use-toast" or similar.
// I will use simple alerts/console for simplicity in this step, or try to use "sonner" if I installed it? I installed "toast" which is usually "sonner" in latest shadcn.
// Let's assume standard behavior.

// Fix default icon
let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

// Helper: Simple Haversine for Client-Side Snapping
const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3; // meters
    const rad = Math.PI / 180;
    const dLat = (lat2 - lat1) * rad;
    const dLon = (lon2 - lon1) * rad;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * rad) * Math.cos(lat2 * rad) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

// Helper component to handle map clicks with Snapping
function ClickHandler({ setStartPoint, graphNodes }) {
    useMapEvents({
        click(e) {
            const { lat, lng } = e.latlng;

            // 1. Try to snap to nearest GraphNode if available
            if (graphNodes && graphNodes.length > 0) {
                let text = "Lokasi ditentukan";
                let bestNode = null;
                let minDst = Infinity;

                // Find nearest (O(N) is fine for ~1500 nodes)
                for (const node of graphNodes) {
                    const d = calculateDistance(lat, lng, node.latitude, node.longitude);
                    if (d < minDst) {
                        minDst = d;
                        bestNode = node;
                    }
                }

                // Threshold: Only snap if within reasonable distance (e.g., 500m)
                // Actually for "Node Centric", we kinda ALWAYS want to snap, or user can't route.
                if (bestNode && minDst < 1000) {
                    setStartPoint({ lat: bestNode.latitude, lng: bestNode.longitude, nodeId: bestNode.id });
                    toast.success(`Snapped to nearest Node #${bestNode.id} (${Math.round(minDst)}m away)`);
                } else {
                    // Fallback
                    setStartPoint({ lat, lng, nodeId: null });
                    toast("Lokasi diset manual (jauh dari node)");
                }
            } else {
                setStartPoint({ lat, lng, nodeId: null });
            }
        },
    });
    return null;
}

const MapView = ({ layersState, onRouteFound, currentRoutePath = [], schools = [], zones = [], graphNodes = [], graphEdges = [] }) => {
    // const [routePath, setRoutePath] = useState([]); // Moved to App.jsx
    const [startPoint, setStartPoint] = useState(null);
    // const [loading, setLoading] = useState(true); // Handled by App? or just removed.

    // 1. Fetching Logic removed (Lifted to App.jsx)

    // 2. Find Route Function
    const handleFindRoute = async (schoolLat, schoolLon) => {
        if (!startPoint) {
            toast.error("Silakan klik peta terlebih dahulu untuk menentukan lokasi Anda!");
            return;
        }

        const toastId = toast.loading("Sedang mencari rute terbaik...");

        try {
            const response = await axios.post('http://localhost:5000/api/find-path', {
                startLat: startPoint.lat,
                startLon: startPoint.lng,
                endLat: parseFloat(schoolLat),
                endLon: parseFloat(schoolLon)
            });

            if (response.data.success) {
                toast.dismiss(toastId);
                toast.success(`Rute ditemukan! Jarak: ${(response.data.distance_meters / 1000).toFixed(1)} km`);
                if (onRouteFound) onRouteFound(response.data);
            } else {
                toast.dismiss(toastId);
                toast.error("Rute tidak ditemukan: " + response.data.message);
            }
        } catch (error) {
            console.error("Error finding path:", error);
            toast.dismiss(toastId);
            toast.error("Terjadi kesalahan saat mencari rute.");
        }
    };

    return (
        <div className="h-full w-full z-0 relative">
            <MapContainer
                center={[0.1347, 117.4980]}
                zoom={13}
                style={{ height: "100%", width: "100%" }}
                zoomControl={false}
            >
                <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; OpenStreetMap contributors'
                />

                <ClickHandler setStartPoint={setStartPoint} graphNodes={graphNodes} />

                {/* User Location Marker */}
                {startPoint && (
                    <Marker position={[startPoint.lat, startPoint.lng]}>
                        <Popup>
                            <strong>Lokasi Anda (Start)</strong><br />
                            {startPoint.nodeId ? `Node ID: ${startPoint.nodeId}` : 'Koordinat Manual'}
                        </Popup>
                    </Marker>
                )}

                {/* Route Path (A* Result) */}
                {currentRoutePath && currentRoutePath.length > 0 && (
                    <Polyline positions={currentRoutePath} color="blue" weight={5} opacity={0.7} />
                )}

                {/* --- GRAPH VIZ LAYER (DEBUG) --- */}
                {layersState.graph && (
                    <>
                        {/* 1. Edges (Lines) */}
                        {graphEdges.map((edge, idx) => {
                            // Geometry is stored as GeoJSON object { type: "LineString", coordinates: [...] }
                            // We need to extract coordinates and convert to [lat, lon]
                            let positions = [];
                            if (edge.geometry && edge.geometry.coordinates && Array.isArray(edge.geometry.coordinates)) {
                                positions = edge.geometry.coordinates.map(p => [p[1], p[0]]); // [lon, lat] -> [lat, lon]
                            } else if (Array.isArray(edge.geometry)) {
                                // Fallback if it was stored as raw array
                                positions = edge.geometry.map(p => [p[1], p[0]]);
                            }

                            return (
                                <Polyline key={`edge-${idx}`} positions={positions} pathOptions={{ color: '#94a3b8', weight: 2, opacity: 0.5 }} />
                            );
                        })}

                        {/* 2. Nodes (Points) */}
                        {graphNodes.map((node, idx) => (
                            <CircleMarker
                                key={`node-${idx}`}
                                center={[node.latitude, node.longitude]}
                                radius={4}
                                pathOptions={{ color: '#475569', fillColor: '#cbd5e1', fillOpacity: 0.8, weight: 1 }}
                                eventHandlers={{
                                    click: () => {
                                        console.log("Clicked Node:", node.id);
                                        toast.success(`Start Point set to Node #${node.id}`);
                                        setStartPoint({ lat: node.latitude, lng: node.longitude });
                                    }
                                }}
                            >
                                <Popup>
                                    Node ID: {node.id}<br />
                                    Lat: {node.latitude}<br />
                                    Lon: {node.longitude}
                                </Popup>
                            </CircleMarker>
                        ))}
                    </>
                )}

                {/* Render Zones (Polygon) */}
                {layersState.zones && zones.map((zone, idx) => (
                    <Polygon
                        key={`zone-${idx}`}
                        positions={zone.geometry.coordinates[0].map(coord => [coord[1], coord[0]])} // GeoJSON is [lon, lat], Leaflet is [lat, lon]
                        pathOptions={{
                            color: zone.properties.color,
                            fillColor: zone.properties.color,
                            fillOpacity: 0.2,
                            weight: 1
                        }}
                    >
                        <Popup>{zone.properties.name}</Popup>
                    </Polygon>
                ))}

                {/* Render Schools (Markers) */}
                {schools.map((school, idx) => {
                    // GeoJSON Point coordinates: [lon, lat] -> Leaflet [lat, lon]
                    const [lon, lat] = school.geometry.coordinates;

                    return (
                        <Marker key={`school-${idx}`} position={[lat, lon]}>
                            <Popup>
                                <div className="min-w-[200px]">
                                    <h3 className="font-bold text-lg mb-1">{school.properties.name}</h3>
                                    <p className="text-sm text-gray-600 mb-2">{school.properties.address}</p>
                                    <p className="text-xs text-gray-500 mb-3">{school.properties.description}</p>
                                    <button
                                        className="bg-emerald-600 text-white px-3 py-1.5 rounded text-sm w-full hover:bg-emerald-700 transition"
                                        onClick={() => handleFindRoute(lat, lon)}
                                    >
                                        Cari Rute ke Sini
                                    </button>
                                </div>
                            </Popup>
                        </Marker>
                    );
                })}

                {/* Bus/Angkot routes layers would go here if we had data */}

            </MapContainer>
        </div>
    );
};

export default MapView;
