// src/astar.js
// Algoritma A* untuk pathfinding - V2 Node Centric

const { PrismaClient } = require('@prisma/client');

class AStarPathfinder {
    constructor() {
        this.prisma = new PrismaClient();
        this.nodes = {};
        this.adjacency = {};
        this.isLoaded = false;
    }

    async loadGraph() {
        if (this.isLoaded) return;

        console.log('Loading graph data (V2: Node-Centric)...');

        // 1. Load All Nodes (Vertices)
        const nodesData = await this.prisma.graphNode.findMany();
        nodesData.forEach((n) => {
            this.nodes[n.id] = {
                id: n.id,
                lat: n.latitude,
                lon: n.longitude,
                label: n.label,
            };
        });

        // 2. Load All Edges (Geometry Lines)
        const edgesData = await this.prisma.graphEdge.findMany();
        edgesData.forEach((e) => {
            // Forward Edge (Source -> Target)
            if (!this.adjacency[e.sourceId]) {
                this.adjacency[e.sourceId] = [];
            }
            this.adjacency[e.sourceId].push({
                target: e.targetId,
                weight: e.weight,
                originalSource: e.sourceId, // Store original direction
                originalTarget: e.targetId,
                geometry: e.geometry,       // Store the geometry
            });

            // Backward Edge (Target -> Source)
            if (!this.adjacency[e.targetId]) {
                this.adjacency[e.targetId] = [];
            }
            this.adjacency[e.targetId].push({
                target: e.sourceId,
                weight: e.weight,
                originalSource: e.sourceId,
                originalTarget: e.targetId,
                geometry: e.geometry,       // Same geometry
            });
        });

        this.isLoaded = true;
        console.log(
            `Graph loaded: ${Object.keys(this.nodes).length} nodes, ${edgesData.length} edges`
        );
    }

    // Haversine Distance (in meters) - More accurate for Earth
    calculateHaversine(lat1, lon1, lat2, lon2) {
        const R = 6371e3; // Earth radius in meters
        const phi1 = (lat1 * Math.PI) / 180;
        const phi2 = (lat2 * Math.PI) / 180;
        const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
        const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

        const a =
            Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
            Math.cos(phi1) *
            Math.cos(phi2) *
            Math.sin(deltaLambda / 2) *
            Math.sin(deltaLambda / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c;
    }

    heuristic(nodeAId, nodeBId) {
        const nodeA = this.nodes[nodeAId];
        const nodeB = this.nodes[nodeBId];
        // Use Haversine for heuristic too for consistency
        return this.calculateHaversine(nodeA.lat, nodeA.lon, nodeB.lat, nodeB.lon);
    }

    // V2 Logic: Snap to Nearest Graph Node
    findNearestNode(lat, lon) {
        let minDist = Infinity;
        let nearestId = -1;

        for (const id in this.nodes) {
            const node = this.nodes[id];
            const dist = this.calculateHaversine(lat, lon, node.lat, node.lon);

            if (dist < minDist) {
                minDist = dist;
                nearestId = parseInt(id);
            }
        }

        // Log info for debugging
        if (nearestId !== -1) {
            console.log(`Snapped user location [${lat}, ${lon}] to Node ID ${nearestId} (${this.nodes[nearestId].label || 'No Label'}), Dist: ${Math.round(minDist)}m`);
        }

        return nearestId;
    }

    findPath(startLat, startLon, endLat, endLon) {
        // 1. Snap coordinates to nearest Nodes
        const startNodeId = this.findNearestNode(startLat, startLon);
        const endNodeId = this.findNearestNode(endLat, endLon);

        console.log(`Finding path V2 from Node ${startNodeId} to Node ${endNodeId}`);

        if (startNodeId === -1 || endNodeId === -1) {
            return null;
        }

        // 2. A* Algorithm
        let openSet = [{ id: startNodeId, f: 0 }];
        let cameFrom = {}; // Stores { nodeId: { from: fromNodeId, edgeGeometry: geometry, reversed: boolean } }

        let gScore = {};
        let fScore = {};

        Object.keys(this.nodes).forEach((k) => {
            gScore[k] = Infinity;
            fScore[k] = Infinity;
        });

        gScore[startNodeId] = 0;
        fScore[startNodeId] = this.heuristic(startNodeId, endNodeId);

        while (openSet.length > 0) {
            openSet.sort((a, b) => a.f - b.f);
            const current = openSet.shift();
            const currentId = current.id;

            if (currentId === endNodeId) {
                return this.reconstructPath(cameFrom, currentId, gScore[currentId]);
            }

            const neighbors = this.adjacency[currentId] || [];

            for (let neighbor of neighbors) {
                const neighborId = neighbor.target;
                const weight = neighbor.weight;

                const tentativeGScore = gScore[currentId] + weight;

                if (tentativeGScore < gScore[neighborId]) {
                    // Determine if we are traversing the edge forward or backward
                    // If we go from neighbor.originalSource (current) to neighbor.target (neighbor), it is forward
                    // Wait, 'neighbor' object in adjacency already tells us the target.
                    // originalSource/Target tells us how the geometry is stored.
                    // If currentId == originalSource, we are moving Forward along the geometry.
                    // If currentId == originalTarget, we are moving Backward.

                    const isReverse = (currentId !== neighbor.originalSource);

                    cameFrom[neighborId] = {
                        from: currentId,
                        geometry: neighbor.geometry,
                        isReverse: isReverse
                    };

                    gScore[neighborId] = tentativeGScore;
                    fScore[neighborId] = gScore[neighborId] + this.heuristic(neighborId, endNodeId);

                    if (!openSet.some((n) => n.id === neighborId)) {
                        openSet.push({ id: neighborId, f: fScore[neighborId] });
                    } else {
                        const index = openSet.findIndex((n) => n.id === neighborId);
                        openSet[index].f = fScore[neighborId];
                    }
                }
            }
        }
        return null;
    }

    reconstructPath(cameFrom, currentId, totalDistance) {
        // V2: Stitch together geometry segments
        let fullPath = [];
        let current = currentId;

        // Use a stack to reconstruct from start to end
        let segments = [];

        while (current in cameFrom) {
            const parentInfo = cameFrom[current];
            // parentInfo = { from, geometry, isReverse }

            let segmentGeometry = parentInfo.geometry; // Array of [lon, lat] usually in GeoJSON

            if (!Array.isArray(segmentGeometry)) {
                // Fallback if geometry missing
                const n1 = this.nodes[parentInfo.from];
                const n2 = this.nodes[current];
                segmentGeometry = [[n1.lon, n1.lat], [n2.lon, n2.lat]];
            }

            // GeoJSON is [lon, lat]. Leaflet needs [lat, lon].
            // AND we might need to reverse the order of points if isReverse is true.

            // 1. Deep copy to avoid mutating cache
            let points = JSON.parse(JSON.stringify(segmentGeometry));

            // 2. Reverse if needed (traversing Target -> Source)
            if (parentInfo.isReverse) {
                points.reverse();
            }

            // 3. Convert [lon, lat] -> [lat, lon]
            points = points.map(p => [p[1], p[0]]);

            segments.unshift(points); // Add to front
            current = parentInfo.from;
        }

        // Flatten segments into one long polyline
        // To make it smooth, we might want to deduplicate join points, but Leaflet handles overlapping points fine.
        segments.forEach(seg => {
            fullPath = fullPath.concat(seg);
        });

        // Asumsi kecepatan 30 km/jam = 500 meter/menit
        const speedMetersPerMinute = 500;
        const durationMinutes = totalDistance / speedMetersPerMinute;

        return {
            path: fullPath,
            distance_meters: Math.round(totalDistance),
            duration_minutes: durationMinutes
        };
    }

    async disconnect() {
        await this.prisma.$disconnect();
    }
}

module.exports = AStarPathfinder;
