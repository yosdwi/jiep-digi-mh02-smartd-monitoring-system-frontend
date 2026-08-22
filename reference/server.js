const express = require('express');
const path = require('path');
const fs = require('fs');
const turf = require('./turf.min.js'); // Import Turf.js for buffer calculations
const mqtt = require('mqtt');
const { Server } = require('socket.io');
const http = require('http');
const crypto = require('crypto'); // For hash comparison
const Minio = require('minio'); // MinIO client
const ffmpeg = require('fluent-ffmpeg');

ffmpeg.setFfmpegPath("./bin/ffmpeg.exe");

const app = express();
const PORT = 3000;
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// MinIO client configuration
const minioClient = new Minio.Client({
    endPoint: 'localhost',
    port: 9000,
    useSSL: false,
    accessKey: 'smartd',
    secretKey: 'persada123'
});

// Middleware to parse JSON bodies
app.use(express.json());
app.use(express.raw({ type: 'text/plain', limit: '10mb' }));



// Function to check for line changes from RoverSegment
function checkRoverSegmentLineChanges() {
    try {
        const roverSegmentFilePath = MASTER_FILE_PATH;
        if (!fs.existsSync(roverSegmentFilePath)) {
            return;
        }

        const roverData = JSON.parse(fs.readFileSync(roverSegmentFilePath, 'utf8'));
        const mirDumpingPath = '../Mh02GenerateRoverSegment/MIR-DUMPING.json';

        // Read main MIR file for comparison
        let mainData = [];
        const mainMirDumpingPath = '../Mh02GenerateRoverSegment/MIR-DUMPING.json';
        if (fs.existsSync(mainMirDumpingPath)) {
            mainData = JSON.parse(fs.readFileSync(mainMirDumpingPath, 'utf8'));
        }

        roverData.forEach(roverArea => {
            if (roverArea.dumping_line && roverArea.dumping_line.length >= 2) {
                // Find corresponding area in main file
                const mainArea = mainData.find(area => area.dumping_area_code === roverArea.dumping_area_code);

                // Check if line is different between RoverSegment and main file
                let shouldNotify = false;

                if (!mainArea) {
                    // New area from RoverSegment
                    shouldNotify = true;
                    console.log(`🔔 New area ${roverArea.dumping_area_code} detected from RoverSegment`);
                } else if (!mainArea.dumping_line) {
                    // Area exists but no line in main file
                    shouldNotify = true;
                    console.log(`🔔 New dumping line detected for existing area ${roverArea.dumping_area_code}`);
                } else {
                    // Compare lines
                    const linesAreDifferent = !compareDumpingLines(roverArea.dumping_line, mainArea.dumping_line);
                    if (linesAreDifferent) {
                        shouldNotify = true;
                        console.log(`🔔 Dumping line changed for area ${roverArea.dumping_area_code}`);
                    }
                }

                if (shouldNotify) {
                    // Notify all connected clients about line change - DON'T update main file yet
                    io.emit('dumping_line_changed', {
                        areaCode: roverArea.dumping_area_code,
                        dumpingLine: roverArea.dumping_line,
                        timestamp: new Date().toISOString(),
                        source: 'rover_segment'
                    });

                    console.log(`📢 Notification sent to frontend for area ${roverArea.dumping_area_code} - waiting for user action`);
                    // NOTE: Main file will be updated only after user completes editing via frontend
                }
            }
        });
    } catch (error) {
        console.error('❌ Error checking RoverSegment line changes:', error);
    }
}

// Function to compare two dumping lines
function compareDumpingLines(line1, line2) {
    if (!line1 || !line2) return false;
    if (line1.length !== line2.length) return false;

    const tolerance = 0.000001;
    for (let i = 0; i < line1.length; i++) {
        if (Math.abs(line1[i][0] - line2[i][0]) > tolerance ||
            Math.abs(line1[i][1] - line2[i][1]) > tolerance) {
            return false;
        }
    }
    return true;
}

// Start monitoring RoverSegment file every 2 seconds
setInterval(checkRoverSegmentLineChanges, 2000);

// Serve static files from serverside directory
app.use(express.static(__dirname));

// API configuration endpoint
app.get('/api/config', (req, res) => {
    const config = {
        "OrthoService": {
            "BaseUrl": "http://smartd-mh02-ortho-service.apps.pamapersada.net"
        }
    };
    res.json(config);
});

// Serve the geofence JSON file from MIR-DUMPING.json with calculated warning zones
app.get('/dumping_geofence.json', (req, res) => {
    // Prevent caching to ensure fresh data
    res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
    });

    try {
        const mirDumpingPath = '../Mh02GenerateRoverSegment/MIR-DUMPING.json';
        const geofenceData = JSON.parse(fs.readFileSync(mirDumpingPath, 'utf8'));
        
        // Hardcoded MIR settings for warning zone calculations
        const mirSettings = {
            warning1: 15,
            warning2: 7,
            warning3: 5
        };


        // Calculate warning zones for each geofence area
        const enhancedGeofenceData = geofenceData.map(area => {
            const enhancedArea = { ...area };
            
            // Calculate warning zones if dumping line and dumping area exist
            if (area.dumping_line && area.dumping_line.length >= 2 && area.dumping_area && area.dumping_area.length >= 3) {
                try {
                    enhancedArea.warning_zones = calculateWarningZones(area.dumping_line, mirSettings, area.dumping_area);
                    console.log(`✅ Calculated warning zones for area ${area.dumping_area_code}`);
                } catch (error) {
                    console.error(`❌ Error calculating warning zones for area ${area.dumping_area_code}:`, error);
                    enhancedArea.warning_zones = null;
                }
            }
            
            return enhancedArea;
        });

        res.json(enhancedGeofenceData);
    } catch (error) {
        console.error('❌ Error serving geofence data:', error);
        res.status(500).json({ error: 'Failed to load geofence data' });
    }
});

// Calculate warning zones within dumping area using turf.js
function calculateWarningZones(dumpingLine, mirSettings, dumpingArea) {
    try {
        // Create line feature from dumping coordinates
        const lineFeature = turf.lineString(dumpingLine);
        
        // Create dumping area polygon for intersection
        const dumpingAreaPolygon = turf.polygon([dumpingArea]);
        
        const warningZones = {
            warning1_zone: null,
            warning2_zone: null, 
            warning3_zone: null,
            alert_zone: null,
            safe_zone: null
        };

        // Calculate buffers for each warning level as simple circles
        const zones = [
            { key: 'warning3_zone', distance: mirSettings.warning3, name: 'Warning 3', label: '5m' },
            { key: 'warning2_zone', distance: mirSettings.warning2, name: 'Warning 2', label: '7m' },
            { key: 'warning1_zone', distance: mirSettings.warning1, name: 'Warning 1', label: '15m' }
        ];

        zones.forEach(zone => {
            try {
                // Create parallel line offset from dumping line toward dumping area
                const offsetDistance = zone.distance / 111000; // Convert meters to degrees (approximate)

                // Calculate offset direction (perpendicular to dumping line, toward dumping area)
                const start = dumpingLine[0];
                const end = dumpingLine[1];

                // Get dumping area centroid to determine correct direction
                const dumpingAreaCentroid = turf.centroid(dumpingAreaPolygon);
                const dumingAreaCenter = dumpingAreaCentroid.geometry.coordinates;

                // Vector of dumping line
                const lineVector = [end[0] - start[0], end[1] - start[1]];

                // Two perpendicular vectors (both directions)
                const perpVector1 = [-lineVector[1], lineVector[0]];
                const perpVector2 = [lineVector[1], -lineVector[0]];

                // Test which direction points toward dumping area
                const lineMidpoint = [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2];

                // Test point 1 (small offset in direction 1)
                const testOffset = 0.0001;
                const testPoint1 = [
                    lineMidpoint[0] + perpVector1[0] * testOffset,
                    lineMidpoint[1] + perpVector1[1] * testOffset
                ];

                // Calculate distances to dumping area center
                const dist1 = Math.sqrt(
                    Math.pow(testPoint1[0] - dumingAreaCenter[0], 2) +
                    Math.pow(testPoint1[1] - dumingAreaCenter[1], 2)
                );

                const dist2 = Math.sqrt(
                    Math.pow(lineMidpoint[0] - dumingAreaCenter[0], 2) +
                    Math.pow(lineMidpoint[1] - dumingAreaCenter[1], 2)
                );

                // Choose direction that gets closer to dumping area center
                const perpVector = dist1 < dist2 ? perpVector1 : perpVector2;

                // Normalize perpendicular vector
                const perpLength = Math.sqrt(perpVector[0] * perpVector[0] + perpVector[1] * perpVector[1]);
                const unitPerpVector = [perpVector[0] / perpLength, perpVector[1] / perpLength];

                // Create offset line coordinates
                const offsetStart = [
                    start[0] + unitPerpVector[0] * offsetDistance,
                    start[1] + unitPerpVector[1] * offsetDistance
                ];
                const offsetEnd = [
                    end[0] + unitPerpVector[0] * offsetDistance,
                    end[1] + unitPerpVector[1] * offsetDistance
                ];

                warningZones[zone.key] = {
                    coordinates: [offsetStart, offsetEnd],
                    distance: zone.distance,
                    label: zone.label,
                    name: zone.name,
                    isLine: true
                };
            } catch (error) {
                console.warn(`Could not create zone:`, error);
                warningZones[zone.key] = null;
            }
        });

        // Calculate safe zone (rest of dumping area not covered by warning zones)
        try {
            let remainingArea = dumpingAreaPolygon;
            
            // Subtract all warning zones from dumping area
            zones.forEach(zone => {
                if (warningZones[zone.key] && warningZones[zone.key].coordinates) {
                    try {
                        const zonePolygon = turf.polygon([warningZones[zone.key].coordinates]);
                        const difference = turf.difference(remainingArea, zonePolygon);
                        if (difference && difference.geometry) {
                            remainingArea = difference;
                        }
                    } catch (error) {
                        console.warn(`⚠️ Could not subtract ${zone.name} from safe zone`);
                    }
                }
            });
            
            if (remainingArea && remainingArea.geometry && remainingArea.geometry.coordinates) {
                warningZones.safe_zone = {
                    coordinates: remainingArea.geometry.coordinates[0],
                    distance: null,
                    name: 'Safe'
                };
            }
        } catch (error) {
            console.warn('⚠️ Could not calculate safe zone:', error);
        }

        return warningZones;
    } catch (error) {
        console.error('❌ Error in calculateWarningZones:', error);
        return null;
    }
}


// Serve index.html at root
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Get list of available test units from hasiltesting folders
app.get('/units', (req, res) => {
    try {
        const hasiltestingPath = path.join(__dirname, '..', 'hasiltesting');
        const folders = fs.readdirSync(hasiltestingPath, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory())
            .map(dirent => dirent.name);
        
        console.log(`📁 Found ${folders.length} test units:`, folders);
        res.json(folders);
    } catch (error) {
        console.error('❌ Error reading hasiltesting directory:', error);
        res.status(500).json({ error: 'Failed to read test units' });
    }
});

// Get tracking data for selected units
app.post('/units/data', (req, res) => {
    try {
        const { selectedUnits } = req.body;
        
        if (!selectedUnits || !Array.isArray(selectedUnits)) {
            return res.status(400).json({ error: 'selectedUnits array is required' });
        }
        
        const unitsData = [];
        
        selectedUnits.forEach(unitName => {
            const unitPath = path.join(__dirname, '..', 'hasiltesting', unitName);
            const ndjsonFile = path.join(unitPath, `${unitName}.ndjson`);
            
            if (fs.existsSync(ndjsonFile)) {
                try {
                    const data = fs.readFileSync(ndjsonFile, 'utf8');
                    const lines = data.trim().split('\n');
                    const trackingData = lines.map(line => {
                        try {
                            return JSON.parse(line);
                        } catch (e) {
                            console.warn(`Warning: Invalid JSON line in ${unitName}:`, line);
                            return null;
                        }
                    }).filter(item => item !== null);
                    
                    unitsData.push({
                        unitName,
                        unitno: trackingData[0]?.unitno || unitName,
                        data: trackingData
                    });
                    
                    console.log(`📊 Loaded ${trackingData.length} data points for unit ${unitName}`);
                } catch (error) {
                    console.error(`❌ Error reading data for unit ${unitName}:`, error);
                }
            } else {
                console.warn(`⚠️ NDJSON file not found for unit ${unitName}`);
            }
        });
        
        console.log(`✅ Successfully loaded data for ${unitsData.length} units`);
        res.json(unitsData);
    } catch (error) {
        console.error('❌ Error loading units data:', error);
        res.status(500).json({ error: 'Failed to load units data' });
    }
});

// Function to recalculate areas based on new dumping line
function recalculateAreas(newDumpingLine, safeThreshold = 10) {
    try {
        // Create line from dumping coordinates
        const dumpingLineFeature = turf.lineString(newDumpingLine);
        
        // Create buffer for dumping area (larger buffer - 20m)
        const dumpingAreaBuffer = turf.buffer(dumpingLineFeature, safeThreshold * 2, { units: 'meters' });
        
        // Create buffer for unsafe area (smaller buffer around the line - 10m)
        const unsafeAreaBuffer = turf.buffer(dumpingLineFeature, safeThreshold, { units: 'meters' });
        
        return {
            dumping_area: dumpingAreaBuffer.geometry.coordinates[0],
            dumping_unsafe_area: unsafeAreaBuffer.geometry.coordinates[0]
        };
    } catch (error) {
        console.error('❌ Error recalculating areas:', error);
        return null;
    }
}

// // Update dumping line endpoint
// app.post('/update_dumping_line', (req, res) => {
//     try {
//         const { areaCode, newDumpingLine } = req.body;
        
//         console.log(`📝 Updating dumping line for area: ${areaCode}`);
//         console.log(`New coordinates:`, newDumpingLine);
        
//         // Read the current geofence data from MIR-DUMPING.json
//         const geofenceFilePath = './MIR-DUMPING_202511010330.json';
//         const geofenceData = JSON.parse(fs.readFileSync(geofenceFilePath, 'utf8'));
        
//         // Find the area to update
//         const areaIndex = geofenceData.findIndex(item => item.dumping_area_code === areaCode);
        
//         if (areaIndex !== -1) {
//             const area = geofenceData[areaIndex];
//             const safeThreshold = area.dumping_safe_threshold_meters || 10;
            
//             // Update the dumping line
//             area.dumping_line = newDumpingLine;
            
//             // Recalculate and update areas
//             console.log(`🔄 Recalculating areas with ${safeThreshold}m threshold`);
//             const newAreas = recalculateAreas(newDumpingLine, safeThreshold);
            
//             if (newAreas) {
//                 area.dumping_area = newAreas.dumping_area;
//                 area.dumping_unsafe_area = newAreas.dumping_unsafe_area;
//                 console.log(`✅ Updated dumping_area and dumping_unsafe_area coordinates`);
//             }
            
//             // Write back to file
//             fs.writeFileSync(geofenceFilePath, JSON.stringify(geofenceData, null, 2));
            
//             console.log(`✅ Successfully updated dumping line for area ${areaCode}`);
//             console.log('🚀 MIR calculations will now use the new dumping line automatically');
            
//             res.json({ 
//                 success: true, 
//                 message: `Dumping line updated for area ${areaCode}. Areas will be recalculated automatically.`,
//                 areaCode,
//                 newDumpingLine,
//                 realTimeRecalculation: true
//             });
//         } else {
//             console.log(`❌ Area code ${areaCode} not found`);
//             res.status(404).json({ 
//                 success: false, 
//                 error: `Area code ${areaCode} not found` 
//             });
//         }
        
//     } catch (error) {
//         console.error('❌ Error updating dumping line:', error);
//         res.status(500).json({ 
//             success: false, 
//             error: error.message 
//         });
//     }
// });

// Update complete geofence area endpoint
app.post('/update_geofence_area', (req, res) => {
    try {
        const { areaCode, areaData } = req.body;
        
        console.log(`📝 Updating complete geofence area: ${areaCode}`);
        console.log(`New area data:`, areaData);
        
        // Read the current geofence data from MIR-DUMPING.json
        const geofenceFilePath = './MIR-DUMPING_202511010330.json';
        const geofenceData = JSON.parse(fs.readFileSync(geofenceFilePath, 'utf8'));
        
        // Find the area to update
        const areaIndex = geofenceData.findIndex(item => item.dumping_area_code === areaCode);
        
        if (areaIndex !== -1) {
            // Get the latest dumping line from RoverSegment
            let latestDumpingLine = areaData.dumping_line; // Default from frontend

            try {
                if (fs.existsSync(MASTER_FILE_PATH)) {
                    const roverData = JSON.parse(fs.readFileSync(MASTER_FILE_PATH, 'utf8'));
                    const roverArea = roverData.find(area => area.dumping_area_code === areaCode);

                    if (roverArea && roverArea.dumping_line) {
                        latestDumpingLine = roverArea.dumping_line;
                        console.log(`🔄 Using latest dumping line from RoverSegment for area ${areaCode}`);
                    }
                }
            } catch (error) {
                console.error('❌ Error reading RoverSegment file, using frontend data:', error);
            }

            // Update the area with frontend dumping_area + unsafe_area, but latest line from RoverSegment
            geofenceData[areaIndex] = {
                dumping_area_code: areaCode,
                dumping_area: areaData.dumping_area,
                dumping_line: latestDumpingLine, // Use latest from RoverSegment
                dumping_unsafe_area: areaData.dumping_unsafe_area,
                dumping_safe_threshold_meters: areaData.dumping_safe_threshold_meters
            };
            
            // Write back to file
            fs.writeFileSync(geofenceFilePath, JSON.stringify(geofenceData, null, 2));
            
            console.log(`✅ Successfully updated complete geofence area ${areaCode}`);
            console.log('🚀 MIR calculations will now use the new geofence data automatically');
            
            res.json({
                success: true,
                message: `Geofence area ${areaCode} updated successfully.`,
                areaCode,
                areaData
            });
        } else {
            // Area doesn't exist in main file - create new area with latest line from RoverSegment
            console.log(`📝 Creating new area ${areaCode} in main MIR file`);

            let latestDumpingLine = areaData.dumping_line; // Default from frontend

            try {
                if (fs.existsSync(MASTER_FILE_PATH)) {
                    const roverData = JSON.parse(fs.readFileSync(MASTER_FILE_PATH, 'utf8'));
                    const roverArea = roverData.find(area => area.dumping_area_code === areaCode);

                    if (roverArea && roverArea.dumping_line) {
                        latestDumpingLine = roverArea.dumping_line;
                        console.log(`🔄 Using latest dumping line from RoverSegment for new area ${areaCode}`);
                    }
                }
            } catch (error) {
                console.error('❌ Error reading RoverSegment file for new area, using frontend data:', error);
            }

            // Create new area with latest dumping line
            const newArea = {
                dumping_area_code: areaCode,
                dumping_area: areaData.dumping_area,
                dumping_line: latestDumpingLine, // Use latest from RoverSegment
                dumping_unsafe_area: areaData.dumping_unsafe_area,
                dumping_safe_threshold_meters: areaData.dumping_safe_threshold_meters
            };

            geofenceData.push(newArea);

            // Write back to file
            fs.writeFileSync(geofenceFilePath, JSON.stringify(geofenceData, null, 2));

            console.log(`✅ Successfully created new geofence area ${areaCode}`);
            console.log('🚀 MIR calculations will now include the new geofence data automatically');

            res.json({
                success: true,
                message: `New geofence area ${areaCode} created successfully.`,
                areaCode,
                areaData: newArea
            });
        }
        
    } catch (error) {
        console.error('❌ Error updating geofence area:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// MQTT Configuration
// const MQTT_BROKER = 'mqtt://10.2.189.217:1883';
const MQTT_BROKER = 'mqtt://172.31.202.83:1883';
const MQTT_TOPIC = 'SMARTD_DEVICE_STATUS_NEW';

// Connect to MQTT broker
const mqttClient = mqtt.connect(MQTT_BROKER);

// Store latest device data
let latestDeviceData = {};

// File paths for MIR dumping files - use single master file
const MASTER_FILE_PATH = '../Mh02GenerateRoverSegment/MIR-DUMPING.json';

// Store notification state
let notificationState = {
    hasChanges: false,
    lastChecked: null,
    lastFileHash: null
};

// Store last file hash to detect changes
let lastKnownHash = null;

// Function to generate file hash
function generateFileHash(filePath) {
    try {
        if (!fs.existsSync(filePath)) {
            return null;
        }
        const fileBuffer = fs.readFileSync(filePath);
        const hashSum = crypto.createHash('sha256');
        hashSum.update(fileBuffer);
        return hashSum.digest('hex');
    } catch (error) {
        console.error(`❌ Error generating hash for ${filePath}:`, error);
        return null;
    }
}

// Function to check if master file has changed
function checkMasterFileChanges() {
    try {
        if (!fs.existsSync(MASTER_FILE_PATH)) {
            console.log(`Master file not found: ${MASTER_FILE_PATH}`);
            return { hasChanges: false };
        }

        const currentHash = generateFileHash(MASTER_FILE_PATH);

        if (!currentHash) {
            console.log('Could not generate hash for master file');
            return { hasChanges: false };
        }

        const hasChanges = lastKnownHash !== null && lastKnownHash !== currentHash;

        console.log(`Hash check: ${currentHash.substring(0, 16)}... (Changed: ${hasChanges ? 'YES' : 'NO'})`);

        if (hasChanges) {
            console.log('Master file changed - triggering sound alert');
            triggerSoundAlert();
        }

        lastKnownHash = currentHash;

        return {
            hasChanges: hasChanges,
            currentHash: currentHash
        };

    } catch (error) {
        console.error('Error checking master file changes:', error);
        return { hasChanges: false, error: error.message };
    }
}

// Function to trigger sound alert
function triggerSoundAlert() {
    try {
        // Broadcast sound alert to all connected clients
        io.emit('sound_alert', {
            soundFile: '/lib/notifikasi-changes.wav',
            message: 'MIR-DUMPING.json has been updated',
            timestamp: new Date().toISOString()
        });

        console.log('Sound alert sent to clients');

    } catch (error) {
        console.error('Error triggering sound alert:', error);
    }
}


// Function to update notification state and broadcast to clients
function updateNotificationState() {
    const fileCheck = checkMasterFileChanges();
    const previousState = notificationState.hasChanges;

    notificationState = {
        hasChanges: fileCheck.hasChanges,
        lastChecked: new Date().toISOString(),
        lastFileHash: fileCheck.currentHash,
        error: fileCheck.error || null
    };

    // Broadcast to all connected clients if notification state changed
    if (fileCheck.hasChanges !== previousState) {
        io.emit('notification_update', notificationState);

        if (fileCheck.hasChanges) {
            console.log('Broadcasting notification: Master file changed');
        } else {
            console.log('Broadcasting notification: No changes detected');
        }
    }
}



// Function to check if device is synchronized with geofencing
function checkDeviceSyncStatus(segment_mir) {
    try {
        if (!segment_mir) return { isSynced: true };
        
        // Extract datetime from segment_mir (format: "MIR-DUMPING_20250810_10521212.json")
        const match = segment_mir.match(/MIR-DUMPING_(\d{8}_\d{8})\.json/);
        if (!match) return { isSynced: true };
        
        const deviceDatetime = match[1];
        
        // Read geofencing file and check pid
        const geofenceFilePath = MASTER_FILE_PATH;
        
        if (!fs.existsSync(geofenceFilePath)) {
            return { isSynced: false, reason: 'Geofence file not found' };
        }
        
        const geofenceData = JSON.parse(fs.readFileSync(geofenceFilePath, 'utf8'));
        
        // Check if any geofence area has matching pid
        const hasMatchingPid = geofenceData.some(area => area.pid === deviceDatetime);
        
        return {
            isSynced: hasMatchingPid,
            deviceDatetime: deviceDatetime,
            reason: hasMatchingPid ? 'Synchronized' : 'Datetime mismatch with geofencing'
        };
        
    } catch (error) {
        console.error('Error checking device sync status:', error);
        return { isSynced: false, reason: 'Error checking sync status' };
    }
}

// Global variable to store last valid MIR classification state
let lastValidMIRState = {
    color: '#2196F3', // Blue
    alertLevel: 'safe',
    isAlert: false,
    isWarning: false,
    warningLevel: 0,
    syncStatus: null
};

// MIR color classification based on MIRDetector.py logic
function getMIRColorClassification(mir_distance, mir_in_area, mir_unsafe, numsat, mirSettings, syncStatus = null) {
    // Check sync status first - if not synced, return grey
    if (syncStatus && !syncStatus.isSynced) {
        return {
            color: '#9e9e9e', // Grey
            alertLevel: 'unsync',
            isAlert: false,
            isWarning: false,
            warningLevel: 0,
            syncStatus: syncStatus
        };
    }

    // Check if data is invalid/incomplete - return last valid state
    if (mir_in_area !== 1 || mir_distance === -9999 || mir_distance < 0) {
        // Update sync status on last valid state and return it
        lastValidMIRState.syncStatus = syncStatus;
        return lastValidMIRState;
    }

    // Initialize result with current sync status
    let result = {
        color: '#2196F3', // Blue
        alertLevel: 'safe',
        isAlert: false,
        isWarning: false,
        warningLevel: 0,
        syncStatus: syncStatus
    };

    // Check numsat requirement
    // if (numsat < mirSettings.minNumSat) {
    //     return result; // Keep normal/blue if GPS quality insufficient
    // }

    // Check if unsafe (alert condition)
    if (mir_unsafe === 1) {
        result.color = '#f44336'; // Red
        result.alertLevel = 'alert';
        result.isAlert = true;
        return result;
    }

    mir_distance = parseInt(mir_distance);

    // Check MIR distance warnings (only if in area and valid distance)
    if (mir_in_area === 1 && mir_distance !== -9999 && mir_distance >= 0) {
        // Check for very close distance (alert)
        if (mir_distance >= 0 && mir_distance <= 2) {
            result.color = '#f44336'; // Red
            result.alertLevel = 'alert';
            result.isAlert = true;
            return result;
        }

        // Warning 3 (Critical)
        if (mir_distance >= mirSettings.warning3Min && mir_distance <= mirSettings.warning3Max) {
            result.color = '#ff5722'; // Deep orange
            result.alertLevel = 'warning3';
            result.isWarning = true;
            result.warningLevel = 3;
            return result;
        }

        // Warning 2 (Medium)
        if (mir_distance >= mirSettings.warning2Min && mir_distance <= mirSettings.warning2Max) {
            result.color = '#ff9800'; // Orange
            result.alertLevel = 'warning2';
            result.isWarning = true;
            result.warningLevel = 2;
            return result;
        }

        // Warning 1 (Low)
        if (mir_distance >= mirSettings.warning1Min && mir_distance <= mirSettings.warning1Max) {
            result.color = '#ffc107'; // Yellow
            result.alertLevel = 'warning1';
            result.isWarning = true;
            result.warningLevel = 1;
            return result;
        }

        // Safe (in area but no warnings)
        result.color = '#4caf50'; // Green
        result.alertLevel = 'safe';
    }

    // Update last valid state with current result before returning
    lastValidMIRState = { ...result };
    return result;
}

mqttClient.on('connect', () => {
    console.log('🔗 Connected to MQTT broker');
    
    mqttClient.subscribe(MQTT_TOPIC, (err) => {
        if (err) {
            console.error('❌ MQTT subscription error:', err);
        } else {
            console.log(`📡 Subscribed to MQTT topic: ${MQTT_TOPIC}`);
        }
    });
});

mqttClient.on('message', (topic, message) => {
    try {
        const deviceData = JSON.parse(message.toString());
        console.log(`📊 Received device data for: ${deviceData.deviceid || 'Unknown'}`);

        // Only process data with devicetype = "DT", skip all others
        // if (deviceData.devicetype !== 'DT') {
        //     if (deviceData.unitno === 'EX1865'){
        //         console.log(`INI ADA LOADERNYA-==================================`, deviceData);
        //     }
        //     return;
        // }
        // if (deviceData.unitno !== "DT5851" || deviceData.unitno !== "DT4153"){
        //     return;
        // }


        // Hardcoded MIR settings for color classification
        const mirSettings = {
            warning1Min: 8, warning1Max: 15,
            warning2Min: 5, warning2Max: 7,
            warning3Min: 0, warning3Max: 4,
            minNumSat: 4
        };
        
        // Check device sync status
        const syncStatus = checkDeviceSyncStatus(deviceData.segment_mir);
        
        // Classify MIR distance and get color
        const mirClassification = getMIRColorClassification(
            deviceData.mir_distance,
            deviceData.mir_in_area,
            deviceData.mir_unsafe,
            deviceData.numsat,
            mirSettings,
            syncStatus
        );
        
        // Store latest data by device ID with color classification
        const deviceId = deviceData.deviceid || deviceData.unitno || 'unknown';
        latestDeviceData[deviceId] = {
            ...deviceData,
            mirClassification: mirClassification,
            timestamp: new Date(),
            receivedAt: Date.now()
        };
        
        // Broadcast to all connected WebSocket clients
        io.emit('device_update', {
            deviceId: deviceId,
            data: latestDeviceData[deviceId]
        });
        
        // Emit MIR-specific data if available
        if (deviceData.mir_distance !== undefined && deviceData.mir_distance !== -9999) {
            io.emit('mir_update', {
                deviceId: deviceId,
                mir_distance: deviceData.mir_distance,
                mir_in_area: deviceData.mir_in_area,
                mir_unsafe: deviceData.mir_unsafe,
                mir_point: deviceData.mir_point,
                mir_line: deviceData.mir_line,
                mirClassification: mirClassification,
                gpslat: deviceData.gpslat,
                gpslong: deviceData.gpslong,
                unitno: deviceData.unitno,
                timestamp: new Date()
            });
        }
        
    } catch (error) {
        console.error('❌ Error parsing MQTT message:', error);
    }
});

mqttClient.on('error', (error) => {
    console.error('❌ MQTT connection error:', error);
});

// WebSocket connections
io.on('connection', (socket) => {
    console.log(`🔌 WebSocket client connected: ${socket.id}`);
    
    // Send latest device data to new client
    socket.emit('latest_devices', latestDeviceData);
    
    // Send current notification state to new client
    socket.emit('notification_update', notificationState);
    
    socket.on('disconnect', () => {
        console.log(`🔌 WebSocket client disconnected: ${socket.id}`);
    });
    
    socket.on('get_device_data', (deviceId) => {
        if (latestDeviceData[deviceId]) {
            socket.emit('device_data', latestDeviceData[deviceId]);
        }
    });
    
    // Handle manual notification check request
    socket.on('check_notification', () => {
        updateNotificationState();
    });
});

// API endpoint to get latest device data
app.get('/api/devices', (req, res) => {
    res.json(latestDeviceData);
});

// API endpoint to get specific device data
app.get('/api/devices/:deviceId', (req, res) => {
    const deviceId = req.params.deviceId;
    if (latestDeviceData[deviceId]) {
        res.json(latestDeviceData[deviceId]);
    } else {
        res.status(404).json({ error: 'Device not found' });
    }
});

// API endpoint to get live rover data
app.get('/api/rover-data', (req, res) => {
    try {
        // Make a request to the UDP server's HTTP endpoint
        const http = require('http');

        const options = {
            hostname: 'localhost',
            port: 3005,
            path: '/liveroverdata',
            method: 'GET',
            timeout: 5000
        };

        const request = http.request(options, (response) => {
            let data = '';

            response.on('data', (chunk) => {
                data += chunk;
            });

            response.on('end', () => {
                try {
                    const roverData = JSON.parse(data);
                    res.json({
                        success: true,
                        data: roverData,
                        timestamp: new Date().toISOString()
                    });
                } catch (error) {
                    console.error('❌ Error parsing rover data:', error);
                    res.status(500).json({
                        success: false,
                        error: 'Failed to parse rover data'
                    });
                }
            });
        });

        request.on('error', (error) => {
            console.error('❌ Error connecting to UDP server:', error);
            res.status(503).json({
                success: false,
                error: 'UDP server not available'
            });
        });

        request.on('timeout', () => {
            console.error('❌ Timeout connecting to UDP server');
            request.destroy();
            res.status(504).json({
                success: false,
                error: 'UDP server timeout'
            });
        });

        request.end();

    } catch (error) {
        console.error('❌ Error in rover data endpoint:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// API endpoint to get MIR parameters from mh02_mir.json
app.get('/api/get-mir-settings', (req, res) => {
    try {
        // Hardcoded MIR settings
        const settings = {
            warning1Min: 10, warning1Max: 15,
            warning2Min: 5, warning2Max: 9,
            warning3Min: 3, warning3Max: 4,
            minNumSat: 4
        };

        console.log('📖 Retrieved hardcoded MIR settings:', settings);

        res.json({
            success: true,
            settings: settings
        });

    } catch (error) {
        console.error('❌ Error getting MIR settings:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// API endpoint to save MIR parameters to mh02_mir.json
app.post('/api/save-mir-settings', (req, res) => {
    try {
        console.log('📝 Received MIR settings save request (hardcoded mode)');
        console.log('📝 Settings (ignored):', req.body);

        res.json({
            success: true,
            message: 'Settings received but using hardcoded values'
        });

    } catch (error) {
        console.error('❌ Error in MIR settings save:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// API endpoint to get notification state
app.get('/api/notification-state', (req, res) => {
    res.json(notificationState);
});

// API endpoint to reset notification state
app.post('/api/approve-changes', (req, res) => {
    try {
        notificationState = {
            hasChanges: false,
            lastChecked: new Date().toISOString(),
            lastFileHash: lastKnownHash
        };

        io.emit('notification_update', notificationState);

        res.json({
            success: true,
            message: 'Notification cleared successfully'
        });

    } catch (error) {
        console.error('Error clearing notification:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// API endpoint to cancel/dismiss notification
app.post('/api/dismiss-notification', (req, res) => {
    try {
        notificationState = {
            hasChanges: false,
            lastChecked: new Date().toISOString(),
            lastFileHash: lastKnownHash
        };

        io.emit('notification_update', notificationState);

        console.log('Notification dismissed');

        res.json({
            success: true,
            message: 'Notification dismissed'
        });

    } catch (error) {
        console.error('Error dismissing notification:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ============ PLAYBACK TRACKING API ENDPOINTS ============

// Create upload directory if it doesn't exist
const uploadDir = './upload/alertlog/';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
    console.log('📁 Created upload directory:', uploadDir);
}

// Upload MIR_ALERT file
app.post('/api/upload-alert-file', (req, res) => {
    try {
        const filename = req.headers['x-filename'];
        const content = req.body;

        if (!filename || !filename.endsWith('.txt')) {
            return res.status(400).json({ error: 'Invalid filename. Must be .txt file' });
        }

        if (!content || content.length === 0) {
            return res.status(400).json({ error: 'File content is empty' });
        }

        const filePath = path.join(uploadDir, filename);
        fs.writeFileSync(filePath, content);

        console.log(`📤 Uploaded file: ${filename} (${content.length} bytes)`);

        res.json({
            success: true,
            filename: filename,
            size: content.length,
            path: filePath
        });

    } catch (error) {
        console.error('❌ Error uploading file:', error);
        res.status(500).json({ error: error.message });
    }
});

// List uploaded files
app.get('/api/list-alert-files', (req, res) => {
    try {
        if (!fs.existsSync(uploadDir)) {
            return res.json([]);
        }

        const files = fs.readdirSync(uploadDir)
            .filter(file => file.endsWith('.txt'))
            .map(file => {
                const filePath = path.join(uploadDir, file);
                const stats = fs.statSync(filePath);
                return {
                    name: file,
                    size: stats.size,
                    date: stats.mtime.toISOString(),
                    path: filePath
                };
            })
            .sort((a, b) => new Date(b.date) - new Date(a.date));

        res.json(files);

    } catch (error) {
        console.error('❌ Error listing files:', error);
        res.status(500).json({ error: error.message });
    }
});

// Parse MIR_ALERT file and return tracking data
app.get('/api/parse-alert-file/:filename', (req, res) => {
    try {
        const filename = req.params.filename;
        const filePath = path.join(uploadDir, filename);

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'File not found' });
        }

        const content = fs.readFileSync(filePath, 'utf8');
        console.log(`📊 Parsing file: ${filename} (${content.length} chars)`);

        // Parse MIR_ALERT data - robust server-side parsing
        const trackingData = parseMirAlertData(content);

        console.log(`✅ Parsed ${trackingData.length} tracking points from ${filename}`);

        res.json({
            filename: filename,
            totalPoints: trackingData.length,
            data: trackingData,
            units: [...new Set(trackingData.map(point => point.unitno))],
            timespan: trackingData.length > 0 ? {
                start: new Date(trackingData[0].timestamp * 1000).toISOString(),
                end: new Date(trackingData[trackingData.length - 1].timestamp * 1000).toISOString(),
                duration: Math.round((trackingData[trackingData.length - 1].timestamp - trackingData[0].timestamp) / 60)
            } : null
        });

    } catch (error) {
        console.error('❌ Error parsing file:', error);
        res.status(500).json({ error: error.message });
    }
});

// Delete uploaded file
app.delete('/api/delete-alert-file/:filename', (req, res) => {
    try {
        const filename = req.params.filename;
        const filePath = path.join(uploadDir, filename);

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'File not found' });
        }

        fs.unlinkSync(filePath);
        console.log(`🗑️ Deleted file: ${filename}`);

        res.json({ success: true, message: 'File deleted successfully' });

    } catch (error) {
        console.error('❌ Error deleting file:', error);
        res.status(500).json({ error: error.message });
    }
});

// Load dumping areas data
function loadDumpingAreas() {
    try {
        const filePath = '../Mh02GenerateRoverSegment/MIR-DUMPING.json';
        if (fs.existsSync(filePath)) {
            const data = fs.readFileSync(filePath, 'utf8');
            return JSON.parse(data);
        } else {
            console.warn('⚠️ MIR-DUMPING.json not found, distance calculation disabled');
            return [];
        }
    } catch (error) {
        console.error('❌ Error loading MIR-DUMPING.json:', error);
        return [];
    }
}

// Calculate distance to dumping line using turf.js (same logic as smartd_mir.js)
function calculateDistanceToDumpingLine(lat, lng) {
    try {
        const dumpingAreas = loadDumpingAreas();
        const gpsPos = [lng, lat]; // turf uses [lng, lat] format

        for (let area of dumpingAreas) {
            if (!area.dumping_area || !area.dumping_line) continue;

            // Check if point is inside dumping area
            const polyArea = turf.polygon([area.dumping_area], { name: area.dumping_area_code });
            const isInArea = turf.booleanPointInPolygon(gpsPos, polyArea);

            if (isInArea && area.dumping_line.length >= 2) {
                // Calculate distance to dumping line using turf
                const pt = turf.point(gpsPos);
                const line = turf.lineString(area.dumping_line);

                // Find nearest point on line
                const snapped = turf.nearestPointOnLine(line, pt, { units: "meters" });
                const distance = snapped.properties.dist; // distance in meters

                return {
                    distance: distance,
                    areaCode: area.dumping_area_code,
                    mirPoint: snapped.geometry.coordinates
                };
            }
        }

        return { distance: null, areaCode: null, mirPoint: null };

    } catch (error) {
        console.warn('⚠️ Error calculating distance:', error.message);
        return { distance: null, areaCode: null, mirPoint: null };
    }
}

// Parse MIR_ALERT data function with distance calculation
function parseMirAlertData(content) {
    const data = [];

    try {
        // Split by pattern where each record typically starts with "MIR_ALERT"
        const pattern = /MIR_ALERT,[^,]+,\d+,[^,]+,\d+/g;
        const matches = [];
        let match;

        while ((match = pattern.exec(content)) !== null) {
            matches.push({
                match: match[0],
                index: match.index
            });
        }

        console.log(`🔍 Found ${matches.length} MIR_ALERT records`);

        matches.forEach((matchInfo, index) => {
            try {
                // Get complete record until next MIR_ALERT or end
                const startPos = matchInfo.index;
                const nextMatch = matches[index + 1];
                const endPos = nextMatch ? nextMatch.index : content.length;

                const record = content.substring(startPos, endPos);
                const parts = record.split(',');

                if (parts.length >= 10) {
                    // Extract fields based on MIR_ALERT format
                    // MIR_ALERT,filename,seq,status,timestamp,'device','unitno','speed',lat,lng,...
                    const lat = parseFloat(parts[8]);
                    const lng = parseFloat(parts[9]);
                    const unitno = parts[6] ? parts[6].replace(/'/g, '').trim() : 'Unknown';
                    const timestamp = parseInt(parts[4]);
                    const speed = parts[7] ? parseFloat(parts[7].replace(/'/g, '')) : 0;

                    // Validate coordinates
                    if (!isNaN(lat) && !isNaN(lng) &&
                        lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 &&
                        lat !== 0 && lng !== 0) {

                        // Calculate distance to dumping line using turf.js
                        const distanceResult = calculateDistanceToDumpingLine(lat, lng);

                        data.push({
                            lat: lat,
                            lng: lng,
                            unitno: unitno,
                            timestamp: timestamp,
                            speed: speed,
                            distanceToDumping: distanceResult.distance,
                            areaCode: distanceResult.areaCode,
                            mirPoint: distanceResult.mirPoint,
                            recordNumber: index + 1
                        });
                    }
                }
            } catch (e) {
                console.warn(`⚠️ Error parsing record ${index + 1}:`, e.message);
            }
        });

        // Sort by timestamp
        data.sort((a, b) => a.timestamp - b.timestamp);

        console.log(`✅ Successfully parsed ${data.length} valid tracking points`);
        if (data.length > 0) {
            console.log(`📍 Units found: ${[...new Set(data.map(p => p.unitno))].join(', ')}`);
            console.log(`📏 Points with distance: ${data.filter(p => p.distanceToDumping !== null).length}`);
            console.log(`⏱️ Duration: ${Math.round((data[data.length-1].timestamp - data[0].timestamp) / 60)} minutes`);
        }

        return data;

    } catch (error) {
        console.error('❌ Error in parseMirAlertData:', error);
        return [];
    }
}

// Initialize periodic hash checker
function initializeHashChecker() {
    console.log('Initializing file monitoring...');
    console.log(`Master file path: ${MASTER_FILE_PATH}`);
    setTimeout(updateNotificationState, 2000);

    setInterval(() => {
        updateNotificationState();
    }, 5000);

    console.log('File monitoring initialized (checks every 5 seconds)');
}

// API endpoint to list minio objects for playback tracking
app.get('/api/playback/list', async (req, res) => {
    try {
        const objects = [];
        const stream = minioClient.listObjects('mirevidenceuploader', '', true);

        for await (const obj of stream) {
            // Parse object name: deviceid/deviationid/filename
            const pathParts = obj.name.split('/');
            if (pathParts.length === 3) {
                const [deviceid, deviationid, filename] = pathParts;
                objects.push({
                    deviceid,
                    deviationid,
                    filename,
                    fullPath: obj.name,
                    size: obj.size,
                    lastModified: obj.lastModified
                });
            }
        }

        // Group by deviceid and deviationid
        const groupedData = {};
        objects.forEach(obj => {
            const key = `${obj.deviceid}_${obj.deviationid}`;
            if (!groupedData[key]) {
                groupedData[key] = {
                    deviceid: obj.deviceid,
                    deviationid: obj.deviationid,
                    files: []
                };
            }
            groupedData[key].files.push(obj);
        });

        res.json(Object.values(groupedData));
    } catch (error) {
        console.error('Error listing minio objects:', error);
        res.status(500).json({ error: 'Failed to list objects' });
    }
});

// API endpoint to get NDJSON file from minio
app.get('/api/playback/ndjson/:deviceid/:deviationid', async (req, res) => {
    try {
        const { deviceid, deviationid } = req.params;
        const objectName = `${deviceid}/${deviationid}/${deviationid}.ndjson`;

        const stream = await minioClient.getObject('mirevidenceuploader', objectName);
        let data = '';

        stream.on('data', chunk => {
            data += chunk;
        });

        stream.on('end', () => {
            // Parse NDJSON format
            const lines = data.trim().split('\n').filter(line => line.trim());
            const trackingData = lines.map(line => JSON.parse(line));
            res.json(trackingData);
        });

        stream.on('error', (error) => {
            console.error('Error reading NDJSON file:', error);
            res.status(404).json({ error: 'File not found' });
        });

    } catch (error) {
        console.error('Error getting NDJSON file:', error);
        res.status(500).json({ error: 'Failed to get tracking data' });
    }
});
app.get('/api/playback/video/:deviceid/:deviationid', async (req, res) => {
    try {
        const { deviceid, deviationid } = req.params;
        const bucket = "mirevidenceuploader";
        const objectName = `${deviceid}/${deviationid}/${deviationid}.mp4`;

        const tempDir = path.join(__dirname, "temp");
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        const localRawFile = path.join(tempDir, `${deviceid}_${deviationid}_raw.mp4`);
        const localStreamFile = path.join(tempDir, `${deviceid}_${deviationid}_streamable.mp4`);

        console.log(`📹 Requested video: ${objectName}`);

        // If cached streamable file exists → stream
        if (fs.existsSync(localStreamFile)) {
            console.log("🚀 Serving cached streamable video");
            return streamLocalVideo(localStreamFile, req, res);
        }

        console.log("⬇ Downloading raw video from MinIO...");
        const minioStream = await minioClient.getObject(bucket, objectName);

        await new Promise((resolve, reject) => {
            const writeStream = fs.createWriteStream(localRawFile);
            minioStream.pipe(writeStream);
            writeStream.on("finish", resolve);
            writeStream.on("error", reject);
        });

        console.log("🔄 Converting video to browser-compatible streaming MP4...");
        await new Promise((resolve, reject) => {
            ffmpeg(localRawFile)
                .outputOptions([
                    "-movflags +faststart",  // enable streaming
                    "-vf scale=1280:-2",     // keep aspect ratio, limit size
                    "-c:v libx264",          // enforce compatible video codec
                    "-preset veryfast",
                    "-c:a aac",              // enforce audio codec
                    "-b:a 128k",
                    "-pix_fmt yuv420p"       // required for browser support
                ])
                .on("end", resolve)
                .on("error", reject)
                .save(localStreamFile);
        });

        console.log("⚡ Conversion complete. Streaming to client...");
        return streamLocalVideo(localStreamFile, req, res);

    } catch (error) {
        console.error("❌ Video processing error:", error);
        return res.status(404).send("Video not available");
    }
});


function streamLocalVideo(filePath, req, res) {
    const stat = fs.statSync(filePath);
    const total = stat.size;

    if (req.headers.range) {
        const range = req.headers.range;
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : total - 1;
        const chunksize = (end - start) + 1;

        res.writeHead(206, {
            'Content-Range': `bytes ${start}-${end}/${total}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunksize,
            'Content-Type': 'video/mp4',
        });

        fs.createReadStream(filePath, { start, end }).pipe(res);
    } else {
        res.writeHead(200, {
            'Content-Length': total,
            'Content-Type': 'video/mp4',
            'Accept-Ranges': 'bytes',
        });

        fs.createReadStream(filePath).pipe(res);
    }
}

server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running at:`);
    console.log(`   - Local:     http://localhost:${PORT}`);
    console.log(`   - WSL Host:  http://172.31.202.83:${PORT}`);
    console.log(`   - Network:   http://0.0.0.0:${PORT}`);
    console.log('📡 MQTT consumer active');
    console.log('🔌 WebSocket server ready');
    console.log('💡 Open browser on Windows host and navigate to WSL Host URL above');
    
    // Initialize hash-based file monitoring
    initializeHashChecker();
});