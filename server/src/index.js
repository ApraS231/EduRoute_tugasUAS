// src/index.js
// Express Server untuk EduRoute Bontang

const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const AStarPathfinder = require('./astar');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Prisma and Pathfinder
const prisma = new PrismaClient();
const pathfinder = new AStarPathfinder();

// Load graph data saat server start
(async () => {
    await pathfinder.loadGraph();
})();

// ==========================================
// API ENDPOINTS
// ==========================================

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'EduRoute Bontang Server is running' });
});

// Endpoint 1: Get GIS Data (Schools & Zones)
app.get('/api/gis-data', async (req, res) => {
    try {
        // Get schools with their zones
        const schools = await prisma.school.findMany({
            include: {
                zones: true,
            },
        });

        // Convert to GeoJSON format
        const schoolsGeoJSON = {
            type: 'FeatureCollection',
            features: schools.map((school) => ({
                type: 'Feature',
                properties: {
                    id: school.id,
                    name: school.name,
                    type: school.type,
                    address: school.address,
                    description: school.description,
                    photoUrl: school.photoUrl,
                },
                geometry: {
                    type: 'Point',
                    coordinates: [school.longitude, school.latitude],
                },
            })),
        };

        // Convert zones to GeoJSON format
        const zonesGeoJSON = {
            type: 'FeatureCollection',
            features: schools.flatMap((school) =>
                school.zones.map((zone) => ({
                    type: 'Feature',
                    properties: {
                        id: zone.id,
                        name: zone.name,
                        color: zone.color,
                        schoolId: school.id,
                        schoolName: school.name,
                    },
                    geometry: {
                        type: 'Polygon',
                        coordinates: zone.coordinates,
                    },
                }))
            ),
        };

        res.json({
            schools: schoolsGeoJSON,
            zones: zonesGeoJSON,
        });
    } catch (error) {
        console.error('Error fetching GIS data:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Endpoint 2: Find Path (A* Algorithm)
app.post('/api/find-path', async (req, res) => {
    const { startLat, startLon, endLat, endLon } = req.body;

    // Validate input
    if (
        startLat === undefined ||
        startLon === undefined ||
        endLat === undefined ||
        endLon === undefined
    ) {
        return res.status(400).json({
            success: false,
            message: 'Missing required parameters: startLat, startLon, endLat, endLon',
        });
    }

    console.log(
        `Mencari rute dari [${startLat}, ${startLon}] ke [${endLat}, ${endLon}]`
    );

    try {
        const result = pathfinder.findPath(
            parseFloat(startLat),
            parseFloat(startLon),
            parseFloat(endLat),
            parseFloat(endLon)
        );

        if (result) {
            res.json({
                success: true,
                distance_meters: result.distance_meters,
                path: result.path,
            });
        } else {
            res.json({
                success: false,
                message: 'Rute tidak ditemukan',
            });
        }
    } catch (error) {
        console.error('Error finding path:', error);
        res.status(500).json({
            success: false,
            error: 'Terjadi kesalahan server',
        });
    }
});

// Endpoint 3: Get all schools (simple list)
app.get('/api/schools', async (req, res) => {
    try {
        const schools = await prisma.school.findMany({
            select: {
                id: true,
                name: true,
                type: true,
                address: true,
                latitude: true,
                longitude: true,
                description: true,
            },
        });
        res.json(schools);
    } catch (error) {
        console.error('Error fetching schools:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Endpoint 4: Get graph nodes (for debugging)
app.get('/api/graph/nodes', async (req, res) => {
    try {
        const nodes = await prisma.graphNode.findMany();
        res.json(nodes);
    } catch (error) {
        console.error('Error fetching graph nodes:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Endpoint 5: Get graph edges (for debugging)
app.get('/api/graph/edges', async (req, res) => {
    try {
        const edges = await prisma.graphEdge.findMany();
        res.json(edges);
    } catch (error) {
        console.error('Error fetching graph edges:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 EduRoute Bontang Server berjalan di http://localhost:${PORT}`);
    console.log(`📍 API Endpoints:`);
    console.log(`   GET  /api/health     - Health check`);
    console.log(`   GET  /api/gis-data   - Get schools & zones GeoJSON`);
    console.log(`   POST /api/find-path  - Find route using A*`);
    console.log(`   GET  /api/schools    - Get all schools`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
    await prisma.$disconnect();
    await pathfinder.disconnect();
    process.exit(0);
});