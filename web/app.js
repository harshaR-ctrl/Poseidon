// Zone Data with realistic per-zone terrain features
const ZONES = [
    { id: 'Z0', name: 'PANAMBUR',     lat: 12.950, lon: 74.810, elev: 0.4, dist_coast: 0.2, imperv: 0.7, drainage: 0.35, pop: 12400, facilities: 'Panambur Port, NH-66 Bridge' },
    { id: 'Z1', name: 'SURATHKAL',    lat: 12.980, lon: 74.790, elev: 1.8, dist_coast: 0.3, imperv: 0.6, drainage: 0.55, pop: 35000, facilities: 'NITK Campus Clinic' },
    { id: 'Z2', name: 'KULOOR',       lat: 12.910, lon: 74.830, elev: 0.6, dist_coast: 0.8, imperv: 0.85, drainage: 0.25, pop: 18000, facilities: 'Kuloor Bridge, Chemical Zone' },
    { id: 'Z3', name: 'KOTTARA',      lat: 12.900, lon: 74.840, elev: 1.0, dist_coast: 1.2, imperv: 0.75, drainage: 0.40, pop: 22000, facilities: 'Infosys Campus Road' },
    { id: 'Z4', name: 'BUNDER',       lat: 12.860, lon: 74.830, elev: 0.3, dist_coast: 0.15, imperv: 0.90, drainage: 0.20, pop: 45000, facilities: 'Central Market, SBI HQ, Old Port' },
    { id: 'Z5', name: 'HAMPANKATTA',  lat: 12.870, lon: 74.850, elev: 3.5, dist_coast: 2.0, imperv: 0.70, drainage: 0.65, pop: 50000, facilities: 'District Hospital' },
    { id: 'Z6', name: 'MANGALADEVI',  lat: 12.840, lon: 74.840, elev: 0.8, dist_coast: 0.6, imperv: 0.80, drainage: 0.30, pop: 28000, facilities: 'Temple Road, Primary School' },
    { id: 'Z7', name: 'ULLAL',        lat: 12.800, lon: 74.850, elev: 0.5, dist_coast: 0.1, imperv: 0.65, drainage: 0.35, pop: 32000, facilities: 'Ullal Bridge, Fishing Harbor' }
];

let map, circles = {}, rpiMarkers = {}, nameLabels = {}, heatLayer = null, timelineChart;
let currentTime = 14;
let selectedZoneId = 'Z4';
let currentScenario = 'mixed';
let lastState = null;
let overlapGroups = [];
let overlapLayerGroup = null;
let shelterLayerGroup = null;
let proposedShelterLayerGroup = null;
let defaultProposedLayerGroup = null;
let proposedShelter = null;
let proposedShelterMarker = null;
let defaultProposedShelters = [];
let defaultProposedMarkersById = new Map();
let shelterPlacementMode = false;
let ngoPlacementMode = false;
let routePlacementMode = false;
let ngoBaseMarker = null;
let routeStartMarker = null;
let selectedHouseholdShelter = null;
let shelterMarkersByKey = new Map();
let latestMappedShelters = [];
let latestWaterFeatures = [];
let hasFetchedMappedShelters = false;
let hasShelterMapData = false;
let shelterRefreshTimer = null;
let shelterRequestId = 0;
let routeLayers = { consumer: null, ngo: null };
let routeEndpointLayer = null;
let routeRequestId = 0;
let dashboardMode = 'consumer';

const SCENARIOS = {
    'mixed': { name: 'Mixed Impact Demo', desc: 'Custom simulation designed to show all flood severities simultaneously.', rain_max: 42, rain_peak: 12.6, tide: 1.8, wind: 25 },
    'monsoon': { name: 'Monsoon Surge', desc: 'Heavy sustained rainfall (180mm) combined with high spring tide (1.8m).', rain_max: 180, rain_peak: 45, tide: 1.8, wind: 45 },
    'cyclone': { name: 'Cyclone Landfall', desc: 'Extreme short-duration rain (250mm) and massive storm surge (2.8m).', rain_max: 250, rain_peak: 80, tide: 2.8, wind: 120 },
    'king_tide': { name: 'King Tide + Rain', desc: 'Minimal rain (40mm) but exceptionally high astronomical tide (2.2m).', rain_max: 40, rain_peak: 10, tide: 2.2, wind: 20 },
    'cloudburst': { name: 'Urban Cloudburst', desc: 'Sudden, extreme localized rainfall (120mm in 2 hrs) during low tide.', rain_max: 120, rain_peak: 90, tide: 0.5, wind: 35 },
    'calm': { name: 'Baseline Conditions', desc: 'Normal sunny day. No significant weather events.', rain_max: 0, rain_peak: 0, tide: 0.8, wind: 10 },
    'live': { name: 'Live Terminal Simulation', desc: 'Waiting for terminal input...', rain_max: 0, rain_peak: 0, tide: 0.8, wind: 10 }
};

// Severity mapping
function getSeverity(depth) {
    if (depth < 0.1)  return { label: 'LOW',       color: '#00F0FF', css: 'bg-low' };       // Blue
    if (depth < 0.30) return { label: 'MODERATE',  color: '#FFC000', css: 'bg-moderate' };  // Yellow
    if (depth < 1.2)  return { label: 'HIGH',      color: '#FF7000', css: 'bg-high' };      // Orange
    return            { label: 'SEVERE',    color: '#FF003C', css: 'bg-severe' };    // Red
}

function formatTime(hr) {
    if (hr > 23.9) return 'N/A';
    return `${Math.floor(hr).toString().padStart(2,'0')}:${Math.round((hr%1)*60).toString().padStart(2,'0')}`;
}

// Initialize Map
function initMap() {
    if (typeof L === 'undefined') {
        console.error("Leaflet (L) is not defined. The map cannot load without an internet connection.");
        document.getElementById('map').innerHTML = "<div style='color: #FF3366; padding: 20px; text-align: center; font-weight: bold;'>MAP UNAVAILABLE<br><br>You are currently offline, so map tiles and scripts could not be downloaded. The rest of the dashboard (Alerts & RPI) will continue to function normally.</div>";
        return;
    }

    const initialZoom = window.innerWidth <= 760 ? 11 : 12;
    map = L.map('map', { zoomControl: false }).setView([12.88, 74.83], initialZoom);
    routeEndpointLayer = L.layerGroup().addTo(map);
    overlapLayerGroup = L.layerGroup().addTo(map);
    shelterLayerGroup = L.layerGroup().addTo(map);
    proposedShelterLayerGroup = L.layerGroup().addTo(map);
    defaultProposedLayerGroup = L.layerGroup().addTo(map);
    
    // Base layers
    const darkLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: 'CARTO', subdomains: 'abcd', maxZoom: 18
    });
    
    // Free Google Maps Satellite Layer
    const satLayer = L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
        attribution: 'Google', maxZoom: 18
    });

    // Add layer control
    const baseMaps = {
        "Satellite": satLayer,
        "Dark Mode": darkLayer
    };
    
    satLayer.addTo(map);

    L.control.layers(baseMaps, null, { position: 'topleft' }).addTo(map);

    ZONES.forEach(z => {
        // Zone circles
        const circle = L.circle([z.lat, z.lon], {
            color: 'rgba(0,212,255,0.15)',
            weight: 1,
            fillColor: '#00F0FF',
            fillOpacity: 0.08,
            radius: 1400
        }).addTo(map);

        circle.on('click', () => {
            selectedZoneId = z.id;
            // Switch to WHY tab on click
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            document.querySelector('[data-target="tab-why"]').classList.add('active');
            document.getElementById('tab-why').classList.add('active');
            updateUI();
        });

        circles[z.id] = circle;

        // RPI label
        rpiMarkers[z.id] = L.marker([z.lat, z.lon], {
            icon: L.divIcon({ className: 'rpi-marker mono', html: '', iconSize: [40, 18], iconAnchor: [20, 9] }),
            title: `${z.name} RPI score`
        }).addTo(map);
        rpiMarkers[z.id]._labelAnchor = rpiMarkers[z.id].getLatLng();

        // Zone name label (below)
        nameLabels[z.id] = L.marker([z.lat - 0.008, z.lon], {
            icon: L.divIcon({ className: 'zone-label', html: z.name, iconSize: [96, 20], iconAnchor: [48, 10] }),
            title: `${z.name} zone`
        }).addTo(map);
        nameLabels[z.id]._labelAnchor = nameLabels[z.id].getLatLng();
    });

    map.on('click', event => {
        if (shelterPlacementMode) {
            placeProposedShelter(event.latlng);
            return;
        }
        if (ngoPlacementMode) {
            placeNgoBase(event.latlng);
            return;
        }
        if (routePlacementMode) {
            placeRouteStart(event.latlng);
            return;
        }
    });
    document.getElementById('shelter-list').addEventListener('click', event => {
        const routeButton = event.target.closest('[data-shelter-route-key]');
        if (routeButton) {
            const place = latestMappedShelters.find(shelter => `${shelter.type}/${shelter.id}` === routeButton.dataset.shelterRouteKey);
            if (place) selectShelterForHouseholdRoute(place);
            return;
        }
        const button = event.target.closest('[data-shelter-key]');
        if (!button) return;
        const marker = shelterMarkersByKey.get(button.dataset.shelterKey);
        if (!marker) return;
        focusMapMarker(marker);
        const place = latestMappedShelters.find(shelter => `${shelter.type}/${shelter.id}` === button.dataset.shelterKey);
        if (place) selectShelterForHouseholdRoute(place);
    });
    document.getElementById('default-proposed-list').addEventListener('click', event => {
        const button = event.target.closest('[data-default-site-id]');
        if (!button) return;
        const marker = defaultProposedMarkersById.get(button.dataset.defaultSiteId);
        if (marker) focusMapMarker(marker);
    });
    map.on('moveend', scheduleShelterRefresh);
    map.on('moveend zoomend resize', repositionMapLabels);
    document.getElementById('place-proposed-site').addEventListener('click', () => {
        if (!lastState || !hasFetchedMappedShelters) {
            document.getElementById('proposed-site-status').textContent = 'Wait for the flood forecast and OSM water check before placing a site.';
            return;
        }
        shelterPlacementMode = true;
        map.getContainer().classList.add('shelter-placement-active');
        document.getElementById('proposed-site-status').textContent = 'Click the map outside shaded flood areas and mapped water. The point must clear the 250 m flood-edge buffer.';
        document.getElementById('place-proposed-site').textContent = 'Choose map location…';
    });
    document.getElementById('remove-proposed-site').addEventListener('click', clearProposedShelter);
    scheduleShelterRefresh();

    // Fix for Leaflet sometimes rendering gray tiles inside flex containers on initial load
    setTimeout(() => {
        map.invalidateSize();
        repositionMapLabels();
    }, 500);
}

// Fetch predictions from Flask API
async function computeState(time) {
    const intensity = Math.max(0, Math.min(1, (time - 10) / 6));
    const scen = SCENARIOS[currentScenario];

    const payload = ZONES.map(z => ({
        zone_id: z.id,
        rain_24h: scen.rain_max * intensity,
        rain_peak_intensity: scen.rain_peak * intensity,
        tide_max: scen.tide * intensity,
        elevation_mean: z.elev,
        slope_mean: 1.0,
        sink_depth: 0.15,
        distance_to_coast: z.dist_coast,
        imperviousness: z.imperv,
        drainage_proxy: z.drainage
    }));

    const apiUrl = window.location.protocol === 'file:' 
        ? 'http://127.0.0.1:8080/api/predict' 
        : '/api/predict';

    try {
        const res = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ zones: payload })
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);

        return data.predictions.map(p => {
            const z = ZONES.find(zz => zz.id === p.zone_id);
            const sev = getSeverity(p.peak_depth);
            const rpi = p.p_flood * p.peak_depth * 100;
            return { ...z, p: p.p_flood, depth: p.peak_depth, depth_p10: p.depth_p10, depth_p90: p.depth_p90,
                     onset_hr: p.onset_hr, peak_hr: p.peak_hr, sev, rpi,
                     drivers: p.drivers, summary: p.summary, safety: p.safety, severity_class: p.severity_class };
        });
    } catch (e) {
        console.warn('API unavailable, using fallback:', e.message);
        return ZONES.map(z => {
            const p = Math.min(1, (0.3 + (1 - z.elev/4) * 0.7) * (0.2 + 0.8 * intensity));
            const depth = Math.max(0, (2 - z.elev) * intensity * 0.5);
            const sev = getSeverity(depth);
            return { ...z, p, depth, depth_p10: depth*0.7, depth_p90: depth*1.3,
                     onset_hr: 14, peak_hr: 16, sev, rpi: p*depth*100,
                     drivers: [], summary: `API offline: ${e.message}`,
                     safety: { level:'SAFE', label:'API ERROR', message: `Server error: ${e.message}. Ensure python server.py is running.`, action:'Hard refresh (Ctrl+F5)', color:'#648299' },
                     severity_class: sev.label };
        });
    }
}

async function updateUI() {
    const state = await computeState(currentTime);
    lastState = state;
    if (proposedShelter && !passesShelterMapFilters(proposedShelter, state, latestWaterFeatures)) {
        clearProposedShelter();
        document.getElementById('proposed-site-status').textContent = 'Proposed site removed because the updated forecast no longer clears the flood and mapped-water checks.';
    }
    if (hasFetchedMappedShelters) renderMappedShelters();
    else scheduleShelterRefresh();
    if (hasFetchedMappedShelters) renderDefaultProposedShelters(state);
    else clearDefaultProposedShelters('Default proposed sites await the flood forecast and OSM lookup.');
    overlapGroups = findOverlapGroups(state);
    renderOverlapAreas(state);
    const overlapMembers = new Set(overlapGroups.flat());

    // -- Top strip & Overlay --
    document.getElementById('sim-clock').textContent = `${currentTime.toString().padStart(2,'0')}:00`;
    const sevCount = state.filter(s => s.sev.label === 'HIGH' || s.sev.label === 'SEVERE').length;
    const statusEl = document.getElementById('status-label');
    statusEl.textContent = sevCount > 0 ? `${sevCount} ZONES AT RISK` : 'ALL CLEAR';
    statusEl.className = 'status-pill ' + (sevCount > 0 ? 'bg-severe' : 'bg-low');
    
    document.getElementById('scenario-name').textContent = SCENARIOS[currentScenario].name;
    document.getElementById('scenario-desc').textContent = SCENARIOS[currentScenario].desc;

    // -- Safety Banner (worst zone) --
    const worst = [...state].sort((a,b) => b.depth - a.depth)[0];
    const banner = document.getElementById('safety-banner');
    const safetyData = worst.safety || { level:'SAFE', label:'SAFE', message:'', action:'', color:'#00F0FF' };
    banner.className = 'safety-banner safety-' + safetyData.level.toLowerCase();
    document.getElementById('safety-label').textContent = safetyData.label;
    document.getElementById('safety-label').style.color = safetyData.color;
    document.getElementById('safety-message').textContent = safetyData.message;
    document.getElementById('safety-action').textContent = safetyData.action;
    const iconEl = document.getElementById('safety-icon');
    iconEl.style.border = `2px solid ${safetyData.color}`;
    iconEl.style.color = safetyData.color;
    iconEl.textContent = safetyData.level === 'EVACUATE' ? '!!' : safetyData.level === 'PREPARE' ? '!' : '';

    // -- Map --
    if (typeof L !== 'undefined' && map) {
        let heatPts = [];
        state.forEach(s => {
            if (circles[s.id]) {
                circles[s.id].setStyle({
                    fillColor: s.sev.color,
                    fillOpacity: 0.15 + Math.min(0.4, s.depth * 0.3),
                    color: selectedZoneId === s.id ? '#00D4FF' : s.sev.color,
                    weight: selectedZoneId === s.id ? 3 : overlapMembers.has(s.id) ? 2 : 1,
                    dashArray: overlapMembers.has(s.id) ? '5 4' : null
                });
            }

            if (rpiMarkers[s.id]) {
                rpiMarkers[s.id].setIcon(L.divIcon({
                    className: `rpi-marker mono rpi-${s.sev.label.toLowerCase()}`,
                    html: s.rpi > 1 ? `${s.rpi.toFixed(0)}` : '',
                    iconSize: [40, 18], iconAnchor: [20, 9]
                }));
                const markerElement = rpiMarkers[s.id].getElement();
                if (markerElement) {
                    markerElement.title = `${s.name} RPI score: ${s.rpi.toFixed(1)}`;
                    markerElement.setAttribute('aria-label', `${s.name}, RPI score ${s.rpi.toFixed(1)}`);
                }
            }

            if (s.rpi > 0.5) heatPts.push([s.lat, s.lon, Math.min(1, s.rpi / 80)]);
        });

        if (typeof L.heatLayer !== 'undefined') {
            if (heatLayer) map.removeLayer(heatLayer);
            heatLayer = L.heatLayer(heatPts, {
                radius: 45, blur: 30, maxZoom: 13,
                gradient: { 0.2:'#00F0FF', 0.5:'#FFC000', 0.8:'#FF3366', 1.0:'#FF003C' }
            }).addTo(map);
        }
        repositionMapLabels();
    }

    // -- Zone Info Overlay --
    const sel = state.find(s => s.id === selectedZoneId) || state[0];
    document.getElementById('overlay-name').textContent = sel.name;
    document.getElementById('overlay-prob').textContent = `${(sel.p*100).toFixed(0)}%`;
    document.getElementById('overlay-depth').textContent = `${sel.depth.toFixed(2)}m`;
    document.getElementById('overlay-onset').textContent = formatTime(sel.onset_hr);
    document.getElementById('overlay-rpi').textContent = sel.rpi.toFixed(1);
    document.getElementById('overlay-pop').textContent = sel.pop.toLocaleString();
    const windSpeed = SCENARIOS[currentScenario].wind * Math.max(0, Math.min(1, (currentTime - 10) / 6));
    document.getElementById('overlay-wind').textContent = `${windSpeed.toFixed(0)} km/h`;

    // -- ALERTS tab --
    const alerts = state.filter(s => s.depth >= 0.05).sort((a,b) => b.depth - a.depth);
    document.getElementById('alerts-list').innerHTML = alerts.map(s => `
        <div class="alert-card ${selectedZoneId===s.id?'selected':''}" onclick="selectZone('${s.id}')">
            <div class="alert-header">
                <span class="alert-zone">${s.name}</span>
                <span class="${s.sev.css}">${s.sev.label}</span>
            </div>
            <div class="alert-meta">
                <span>Prob <span class="mono">${(s.p*100).toFixed(0)}%</span></span>
                <span>Onset <span class="mono">${formatTime(s.onset_hr)}</span></span>
                <span>Peak <span class="mono">${formatTime(s.peak_hr)}</span></span>
                <span>Depth <span class="mono">${s.depth.toFixed(2)}m</span></span>
            </div>
            <div class="alert-drivers">${s.summary || ''}</div>
        </div>
    `).join('');

    // -- RESPONSE tab --
    renderResponseList(state);

    // -- WHY tab --
    const select = document.getElementById('zone-select');
    if (select.children.length === 0) {
        ZONES.forEach(z => {
            const o = document.createElement('option');
            o.value = z.id; o.textContent = z.name;
            select.appendChild(o);
        });
        select.value = selectedZoneId;
        select.addEventListener('change', e => { selectedZoneId = e.target.value; updateUI(); });
    }
    if (select.value !== selectedZoneId) select.value = selectedZoneId;

    const categoryColors = { weather:'cat-weather', marine:'cat-marine', terrain:'cat-terrain', landuse:'cat-landuse', infrastructure:'cat-infrastructure' };

    const drivers = sel.drivers || [];
    document.getElementById('why-content').innerHTML = `
        <div class="why-summary">
            <div style="margin-bottom:8px">
                <span class="mono text-accent" style="font-size:22px">${(sel.p*100).toFixed(0)}%</span>
                <span class="text-muted" style="margin-left:4px">chance of flooding</span>
            </div>
            <div style="margin-bottom:6px">
                Peak depth: <span class="mono">${sel.depth.toFixed(2)}m</span>
                <span class="text-muted">(range ${sel.depth_p10?.toFixed(2) || '?'}–${sel.depth_p90?.toFixed(2) || '?'}m)</span>
            </div>
            <div style="margin-bottom:8px">
                Onset: <span class="mono">${formatTime(sel.onset_hr)}</span> |
                Peak: <span class="mono">${formatTime(sel.peak_hr)}</span>
            </div>
            <div style="border-top:1px solid rgba(0,212,255,0.15);padding-top:8px;color:#E2F1F8;font-size:13px;">
                ${sel.summary || 'No driver data available.'}
            </div>
        </div>
        ${drivers.length ? `
            <div class="why-stack" role="img" aria-label="Stacked contribution bar for the listed flood drivers">
                ${drivers.map(d => `<span class="why-driver-fill ${categoryColors[d.category] || 'cat-weather'}" style="width:${d.pct}%" title="${d.name}: ${d.pct}%"></span>`).join('')}
            </div>
            <div class="why-driver-list">
                ${drivers.map(d => `
                    <div class="why-driver">
                        <div class="why-driver-header">
                            <span class="why-driver-name"><i class="why-key ${categoryColors[d.category] || 'cat-weather'}"></i>${d.name}</span>
                            <span class="why-driver-pct">${d.pct}%</span>
                        </div>
                        <div class="why-driver-detail">${d.detail}</div>
                    </div>
                `).join('')}
            </div>
            <div class="why-footnote">Relative driver weights, normalized to 100%; these are explanatory weights, not independent probabilities.</div>
        ` : '<div class="why-empty">No driver breakdown is available for this zone.</div>'}
        ${overlapGroups.some(group => group.includes(sel.id)) ? `<div class="overlap-note"><strong>Overlapping model coverage</strong><br>${overlapGroups.find(group => group.includes(sel.id)).map(id => ZONES.find(z => z.id === id).name).join(' · ')} share approximate 1.4 km zone circles. Their boundaries are not observed flood extents.</div>` : ''}
    `;

    // -- SAFETY tab --
    const safetyCards = [...state].sort((a,b) => {
        const order = { EVACUATE: 0, PREPARE: 1, ALERT: 2, SAFE: 3 };
        return (order[a.safety?.level]||3) - (order[b.safety?.level]||3);
    });
    document.getElementById('safety-detail').innerHTML = safetyCards.map(s => {
        const sf = s.safety || { label:'--', message:'', action:'', color:'#648299' };
        return `
        <div class="safety-card" style="border-left: 3px solid ${sf.color}">
            <div class="safety-card-header">
                <span class="safety-card-zone">${s.name}</span>
                <span class="safety-card-label" style="background:${sf.color};color:#000">${sf.label}</span>
            </div>
            <div class="safety-card-message">${sf.message}</div>
            <div class="safety-card-action">${sf.action}</div>
        </div>`;
    }).join('');

    // -- STATS tab --
    const affected = state.filter(s => s.depth >= 0.05);
    const highOrSevere = state.filter(s => s.depth >= 0.3);
    const meanProbability = state.length ? state.reduce((sum, zone) => sum + zone.p, 0) / state.length : 0;
    const statDetails = {
        affected: `Count of modeled zone records with peak depth at least 0.05 m: ${affected.map(zone => zone.name).join(', ') || 'none'}. A zone count is not a count of streets or unique geographic area.`,
        high: `Count of zone records with modeled peak depth at least 0.30 m: ${highOrSevere.map(zone => `${zone.name} (${zone.depth.toFixed(2)} m)`).join(', ') || 'none'}. This is a model threshold, not a road-closure observation.`,
        overlaps: `Connected groups of affected 1.4 km model circles whose centers are less than 2.8 km apart: ${overlapGroups.map(group => group.map(id => ZONES.find(zone => zone.id === id).name).join(' + ')).join('; ') || 'none'}. Overlap is approximate and populations are not added across these groups.`,
        probability: `Unweighted mean of the current model flood probabilities across ${state.length} configured demo zones: ${(meanProbability * 100).toFixed(1)}%. This is not population-weighted and is not a citywide calibrated estimate.`,
        selectedDepth: `${sel.name}: modeled peak depth ${sel.depth.toFixed(2)} m; uncertainty interval ${sel.depth_p10?.toFixed(2) ?? '?'}–${sel.depth_p90?.toFixed(2) ?? '?'} m.`,
        selectedPopulation: `${sel.name}: ${sel.pop.toLocaleString()} is the configured demo population estimate for this zone. It is not a live census count; adjacent zone populations are not summed because their boundaries overlap.`
    };
    
    document.getElementById('stats-content').innerHTML = `
        <div class="stats-heading">CURRENT MODEL SNAPSHOT</div>
        <div class="stat-row">
            <div class="stat-card"><button class="stat-value" data-stat="affected" type="button">${affected.length}</button><div class="stat-label">Zones ≥ 0.05 m</div></div>
            <div class="stat-card"><button class="stat-value" data-stat="high" type="button">${highOrSevere.length}</button><div class="stat-label">Zones ≥ 0.30 m</div></div>
        </div>
        <div class="stat-row">
            <div class="stat-card"><button class="stat-value" data-stat="overlaps" type="button">${overlapGroups.length}</button><div class="stat-label">Overlap groups</div></div>
            <div class="stat-card"><button class="stat-value" data-stat="probability" type="button">${(meanProbability * 100).toFixed(0)}%</button><div class="stat-label">Mean zone probability</div></div>
        </div>
        <div class="stats-heading">SELECTED ZONE: ${sel.name}</div>
        <div class="stat-row">
            <div class="stat-card"><button class="stat-value" data-stat="selectedDepth" type="button">${sel.depth.toFixed(2)}m</button><div class="stat-label">Peak depth</div></div>
            <div class="stat-card"><button class="stat-value" data-stat="selectedPopulation" type="button">${sel.pop.toLocaleString()}</button><div class="stat-label">Demo population</div></div>
        </div>
        <div id="stat-detail" class="stat-detail" aria-live="polite">Select a value for its definition, threshold, and limitations.</div>
    `;
    document.querySelectorAll('.stat-value').forEach(button => {
        button.title = statDetails[button.dataset.stat];
        button.addEventListener('click', () => { document.getElementById('stat-detail').textContent = statDetails[button.dataset.stat]; });
    });

    // -- Chart annotation --
    if (timelineChart) {
        timelineChart.options.plugins.annotation.annotations.line1.xMin = currentTime;
        timelineChart.options.plugins.annotation.annotations.line1.xMax = currentTime;
        timelineChart.update('none');
    }
}

function selectZone(id) {
    selectedZoneId = id;
    updateUI();
}

function findOverlapGroups(state) {
    const affected = state.filter(zone => zone.depth >= 0.05);
    const remaining = new Set(affected.map(zone => zone.id));
    const groups = [];
    while (remaining.size) {
        const firstId = remaining.values().next().value;
        remaining.delete(firstId);
        const group = [firstId];
        for (let index = 0; index < group.length; index++) {
            const current = ZONES.find(zone => zone.id === group[index]);
            for (const candidateId of [...remaining]) {
                const candidate = ZONES.find(zone => zone.id === candidateId);
                if (distanceMeters(current, candidate) < 2800) {
                    remaining.delete(candidateId);
                    group.push(candidateId);
                }
            }
        }
        if (group.length > 1) groups.push(group);
    }
    return groups;
}

function renderOverlapAreas(state) {
    if (!map || !overlapLayerGroup) return;
    overlapLayerGroup.clearLayers();
    const overlapNames = [];
    const affectedZones = state.filter(zone => zone.depth >= 0.05);
    for (let firstIndex = 0; firstIndex < affectedZones.length; firstIndex++) {
        for (let secondIndex = firstIndex + 1; secondIndex < affectedZones.length; secondIndex++) {
            const first = affectedZones[firstIndex];
            const second = affectedZones[secondIndex];
            const intersection = circleIntersection(first, second, 1400);
            if (!intersection) continue;
            const area = L.polygon(intersection, {
                color: '#fff1a3',
                weight: 1.5,
                opacity: 0.95,
                fillColor: '#f4c95d',
                fillOpacity: 0.58,
                interactive: true
            }).addTo(overlapLayerGroup);
            area.bindTooltip(`Multi risk area: ${first.name} + ${second.name}`, { sticky: true });
            
            const centerLat = intersection.reduce((sum, p) => sum + p[0], 0) / intersection.length;
            const centerLon = intersection.reduce((sum, p) => sum + p[1], 0) / intersection.length;
            L.marker([centerLat, centerLon], {
                icon: L.divIcon({ className: 'multi-risk-label', html: 'MULTI RISK AREA', iconSize: [100, 20], iconAnchor: [50, 10] }),
                interactive: false
            }).addTo(overlapLayerGroup);
            overlapNames.push(`${first.name} / ${second.name}`);
        }
    }
    document.getElementById('overlap-status').textContent = overlapNames.length
        ? `Named overlap areas: ${overlapNames.join(' · ')}`
        : 'No overlapping affected areas in this forecast.';
    repositionMapLabels();
}

function repositionMapLabels() {
    if (!map) return;
    const labels = ZONES.map(zone => ({ marker: nameLabels[zone.id], width: 96, height: 20 }))
        .filter(label => label.marker?._labelAnchor);
    const mapSize = map.getSize();
    const mapRect = map.getContainer().getBoundingClientRect();
    const occupied = [...shelterMarkersByKey.values(), ...(proposedShelterMarker ? [proposedShelterMarker] : [])].map(marker => {
        const point = map.latLngToContainerPoint(marker.getLatLng());
        return { left: point.x - 15, right: point.x + 15, top: point.y - 15, bottom: point.y + 15 };
    });
    ['#zone-info-overlay', '#scenario-overlay', '#map-legend', '#shelter-directory'].forEach(selector => {
        const element = document.querySelector(selector);
        if (!element || !element.getClientRects().length) return;
        const rect = element.getBoundingClientRect();
        occupied.push({
            left: rect.left - mapRect.left,
            right: rect.right - mapRect.left,
            top: rect.top - mapRect.top,
            bottom: rect.bottom - mapRect.top
        });
    });
    const offsets = [[0, 0]];
    for (let radius = 28; radius <= 168; radius += 28) {
        for (let step = 0; step < 16; step++) {
            const angle = (Math.PI * 2 * step) / 16;
            offsets.push([Math.cos(angle) * radius, Math.sin(angle) * radius]);
        }
    }

    labels.forEach(label => {
        const anchor = map.latLngToContainerPoint(label.marker._labelAnchor);
        let placement = null;
        for (const [offsetX, offsetY] of offsets) {
            const x = anchor.x + offsetX;
            const y = anchor.y + offsetY;
            const box = {
                left: x - label.width / 2 - 3,
                right: x + label.width / 2 + 3,
                top: y - label.height / 2 - 3,
                bottom: y + label.height / 2 + 3
            };
            const insideMap = box.left >= 0 && box.top >= 0 && box.right <= mapSize.x && box.bottom <= mapSize.y;
            const collision = occupied.some(other => box.left < other.right && box.right > other.left && box.top < other.bottom && box.bottom > other.top);
            if (insideMap && !collision) {
                placement = { x, y, box };
                break;
            }
        }
        if (!placement) return;
        occupied.push(placement.box);
        label.marker.setLatLng(map.containerPointToLatLng(L.point(placement.x, placement.y)));
    });

    ZONES.forEach(zone => {
        const marker = rpiMarkers[zone.id];
        if (!marker?._labelAnchor || !marker.getElement()?.textContent.trim()) return;
        const anchor = map.latLngToContainerPoint(marker._labelAnchor);
        const longitudeOffset = 1400 / (111320 * Math.cos(zone.lat * Math.PI / 180));
        const circleEdge = map.latLngToContainerPoint([zone.lat, zone.lon + longitudeOffset]);
        const maxOffset = Math.max(0, Math.hypot(circleEdge.x - anchor.x, circleEdge.y - anchor.y) - 3);
        const candidates = [[0, 0]];
        for (let radius = 5; radius <= maxOffset; radius += 5) {
            for (let step = 0; step < 16; step++) {
                const angle = (Math.PI * 2 * step) / 16;
                candidates.push([Math.cos(angle) * radius, Math.sin(angle) * radius]);
            }
        }
        let placement = null;
        let leastCollisions = Infinity;
        for (const [offsetX, offsetY] of candidates) {
            const x = anchor.x + offsetX;
            const y = anchor.y + offsetY;
            const box = { left: x - 20, right: x + 20, top: y - 9, bottom: y + 9 };
            if (box.left < 0 || box.top < 0 || box.right > mapSize.x || box.bottom > mapSize.y) continue;
            const collisions = occupied.filter(other => box.left < other.right && box.right > other.left && box.top < other.bottom && box.bottom > other.top).length;
            if (collisions < leastCollisions) {
                placement = { x, y, box };
                leastCollisions = collisions;
            }
            if (collisions === 0) break;
        }
        if (!placement) return;
        occupied.push(placement.box);
        marker.setLatLng(map.containerPointToLatLng(L.point(placement.x, placement.y)));
    });
}

function scheduleShelterRefresh() {
    clearTimeout(shelterRefreshTimer);
    shelterRefreshTimer = setTimeout(refreshMappedShelters, 700);
}

async function refreshMappedShelters() {
    if (!map || !shelterLayerGroup) return;
    if (!lastState) {
        document.getElementById('shelter-status').textContent = 'Waiting for flood forecast before screening shelter locations.';
        return;
    }
    const requestId = ++shelterRequestId;
    const bounds = map.getBounds();
    const south = bounds.getSouth().toFixed(5);
    const west = bounds.getWest().toFixed(5);
    const north = bounds.getNorth().toFixed(5);
    const east = bounds.getEast().toFixed(5);
    const bbox = `${south},${west},${north},${east}`;
    const query = `[out:json][timeout:20];(nwr["amenity"="shelter"](${bbox});nwr["emergency"="shelter"](${bbox});)->.shelters;( .shelters;way["natural"="coastline"](${bbox});way["natural"~"water|wetland|bay"](${bbox});rel["natural"~"water|wetland|bay"](${bbox});way["landuse"~"reservoir|basin"](${bbox});rel["landuse"~"reservoir|basin"](${bbox});way["waterway"~"riverbank|dock"](${bbox});rel["waterway"~"riverbank|dock"](${bbox});way(around.shelters:250)["waterway"~"river|stream|canal|ditch"];);out center geom tags;`;
    const status = document.getElementById('shelter-status');
    status.textContent = 'Loading mapped shelters…';
    try {
        const response = await fetchWithTimeout('https://overpass-api.de/api/interpreter', {
            method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' }, body: `data=${encodeURIComponent(query)}`
        }, 12000, 'Shelter lookup timed out.');
        if (!response.ok) throw new Error('OpenStreetMap lookup unavailable.');
        const data = await response.json();
        if (requestId !== shelterRequestId) return;
        const elements = data.elements || [];
        latestWaterFeatures = elements.filter(isMappedWaterFeature);
        latestMappedShelters = elements.filter(isMappedShelterFeature).map(element => ({
            id: element.id,
            type: element.type,
            name: element.tags?.name || `Mapped shelter (OSM ${element.id})`,
            category: element.tags?.amenity || element.tags?.emergency || 'shelter',
            lat: element.lat ?? element.center?.lat,
            lon: element.lon ?? element.center?.lon
        })).filter(place => Number.isFinite(place.lat) && Number.isFinite(place.lon));
        hasFetchedMappedShelters = true;
        hasShelterMapData = true;
        renderMappedShelters();
        renderDefaultProposedShelters(lastState);
    } catch (error) {
        if (requestId !== shelterRequestId) return;
        latestMappedShelters = [];
        latestWaterFeatures = [];
        hasFetchedMappedShelters = true;
        hasShelterMapData = false;
        renderMappedShelters();
        renderDefaultProposedShelters(lastState);
        document.getElementById('shelter-status').textContent = `${error.message} OSM shelter data unavailable; proposed sites are flood-buffer screened only.`;
        renderShelterDirectory([], 'Shelter list unavailable while OpenStreetMap cannot be reached.');
    }
}

function renderMappedShelters() {
    if (!shelterLayerGroup) return;
    shelterLayerGroup.clearLayers();
    shelterMarkersByKey.clear();
    const safeShelters = latestMappedShelters.filter(place => passesShelterMapFilters(place, lastState, latestWaterFeatures));
    if (selectedHouseholdShelter && !safeShelters.some(place => `${place.type}/${place.id}` === `${selectedHouseholdShelter.type}/${selectedHouseholdShelter.id}`)) {
        selectedHouseholdShelter = null;
        document.getElementById('route-selected-shelter').hidden = true;
    }
    safeShelters.forEach(place => {
            const key = `${place.type}/${place.id}`;
            const marker = L.marker([place.lat, place.lon], {
                icon: L.divIcon({ className: 'shelter-marker', html: 'S', iconSize: [24, 24], iconAnchor: [12, 12] }),
                title: place.name
            }).addTo(shelterLayerGroup);
            shelterMarkersByKey.set(key, marker);
            const popup = document.createElement('div');
            const name = document.createElement('strong');
            name.textContent = place.name;
            const kind = document.createElement('div');
            kind.textContent = `OSM mapped ${place.category}`;
            const caveat = document.createElement('div');
            caveat.textContent = 'No mapped water polygon or modeled flood buffer intersects this point. Map data may be incomplete; availability, access, and official evacuation status are unverified.';
            const source = document.createElement('a');
            source.href = `https://www.openstreetmap.org/${place.type}/${place.id}`;
            source.target = '_blank';
            source.rel = 'noopener noreferrer';
            source.textContent = 'Open source in OpenStreetMap';
            const routeButton = document.createElement('button');
            routeButton.type = 'button';
            routeButton.className = 'shelter-popup-route';
            routeButton.textContent = 'Route here';
            routeButton.addEventListener('click', () => selectShelterForHouseholdRoute(place));
            popup.append(name, kind, caveat, source, routeButton);
            marker.bindPopup(popup);
    });
    const withheld = latestMappedShelters.length - safeShelters.length;
    renderShelterDirectory(safeShelters, withheld
        ? `No mapped shelters pass land, mapped-water, and the 250 m flood-edge buffer. ${withheld} location${withheld === 1 ? ' was' : 's were'} withheld.`
        : 'No mapped shelters in the current map view.');
    const status = document.getElementById('shelter-status');
    status.textContent = !hasShelterMapData
        ? 'OSM shelter/water lookup unavailable. Proposed sites are flood-buffer screened only; land is unverified.'
        : safeShelters.length
        ? `${safeShelters.length} OSM shelter${safeShelters.length === 1 ? '' : 's'} outside modeled flood areas with a 250 m clearance · ${withheld} withheld · verify locally.`
        : withheld
            ? `No mapped shelters passed land, mapped-water, and the 250 m flood-edge buffer · ${withheld} withheld.`
            : 'No mapped shelters in view. No locations added.';
}

function renderShelterDirectory(shelters, emptyMessage = 'No mapped shelters in the current map view.') {
    const list = document.getElementById('shelter-list');
    const count = document.getElementById('shelter-count');
    count.textContent = `${shelters.length} OSM · ${defaultProposedShelters.length} proposed`;
    list.replaceChildren();
    if (!shelters.length) {
        const empty = document.createElement('p');
        empty.className = 'shelter-list-empty';
        empty.textContent = emptyMessage;
        list.appendChild(empty);
        return;
    }
    shelters.sort((a, b) => a.name.localeCompare(b.name)).forEach(place => {
        const item = document.createElement('div');
        item.className = 'shelter-list-item';
        const key = `${place.type}/${place.id}`;
        const name = document.createElement('button');
        name.type = 'button';
        name.className = 'shelter-map-link shelter-list-name';
        name.dataset.shelterKey = key;
        name.textContent = place.name;
        const kind = document.createElement('span');
        kind.className = 'shelter-list-kind';
        kind.textContent = place.category;
        const routeButton = document.createElement('button');
        routeButton.type = 'button';
        routeButton.className = 'shelter-route-button';
        routeButton.dataset.shelterRouteKey = key;
        routeButton.textContent = 'Route';
        item.append(name, kind, routeButton);
        list.appendChild(item);
    });
}

function focusMapMarker(marker) {
    if (map.getZoom() >= 15 && map.getBounds().contains(marker.getLatLng())) {
        marker.openPopup();
    } else {
        map.once('moveend', () => marker.openPopup());
        map.flyTo(marker.getLatLng(), Math.max(map.getZoom(), 15));
    }
}

function circleIntersection(first, second, radiusMeters) {
    const averageLatitude = (first.lat + second.lat) / 2;
    const metersPerDegreeLongitude = 111320 * Math.cos(averageLatitude * Math.PI / 180);
    const firstPoint = { x: first.lon * metersPerDegreeLongitude, y: first.lat * 110540 };
    const secondPoint = { x: second.lon * metersPerDegreeLongitude, y: second.lat * 110540 };
    const deltaX = secondPoint.x - firstPoint.x;
    const deltaY = secondPoint.y - firstPoint.y;
    const distance = Math.hypot(deltaX, deltaY);
    if (distance <= 1 || distance >= radiusMeters * 2) return null;

    const bearing = Math.atan2(deltaY, deltaX);
    const halfArc = Math.acos(distance / (2 * radiusMeters));
    const centerDistance = distance / 2;
    const perpendicularDistance = Math.sqrt(radiusMeters ** 2 - centerDistance ** 2);
    const middle = { x: (firstPoint.x + secondPoint.x) / 2, y: (firstPoint.y + secondPoint.y) / 2 };
    const intersections = [
        { x: middle.x - Math.sin(bearing) * perpendicularDistance, y: middle.y + Math.cos(bearing) * perpendicularDistance },
        { x: middle.x + Math.sin(bearing) * perpendicularDistance, y: middle.y - Math.cos(bearing) * perpendicularDistance }
    ];
    const firstStart = bearing - halfArc;
    const firstEnd = bearing + halfArc;
    const secondStart = bearing + Math.PI - halfArc;
    const secondEnd = bearing + Math.PI + halfArc;
    const steps = 18;
    const points = [];
    for (let step = 0; step <= steps; step++) {
        const angle = firstStart + (firstEnd - firstStart) * step / steps;
        points.push([firstPoint.x + Math.cos(angle) * radiusMeters, firstPoint.y + Math.sin(angle) * radiusMeters]);
    }
    for (let step = 0; step <= steps; step++) {
        const angle = secondEnd - (secondEnd - secondStart) * step / steps;
        points.push([secondPoint.x + Math.cos(angle) * radiusMeters, secondPoint.y + Math.sin(angle) * radiusMeters]);
    }
    return points.map(([x, y]) => [y / 110540, x / metersPerDegreeLongitude]);
}

function distanceMeters(a, b) {
    const radians = value => value * Math.PI / 180;
    const latDelta = radians(b.lat - a.lat);
    const lonDelta = radians(b.lon - a.lon);
    const haversine = Math.sin(latDelta / 2) ** 2 + Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(lonDelta / 2) ** 2;
    return 6371000 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function isMappedShelterFeature(element) {
    return element.tags?.amenity === 'shelter' || element.tags?.emergency === 'shelter';
}

function isMappedWaterFeature(element) {
    const tags = element.tags || {};
    return tags.natural === 'coastline'
        || ['water', 'wetland', 'bay'].includes(tags.natural)
        || ['reservoir', 'basin'].includes(tags.landuse)
        || ['riverbank', 'dock', 'river', 'stream', 'canal', 'ditch'].includes(tags.waterway);
}

function isInsideMappedWater(place, waterFeatures) {
    return waterFeatures.some(feature => {
        if (feature.tags?.natural === 'coastline' && distanceToMappedLine(place, feature.geometry || []) <= 8000) return true;
        if (['river', 'stream', 'canal', 'ditch'].includes(feature.tags?.waterway)
            && distanceToMappedLine(place, feature.geometry || []) <= 75) return true;
        const outerRings = [];
        const innerRings = [];
        if (feature.geometry?.length) outerRings.push(feature.geometry);
        for (const member of feature.members || []) {
            if (!member.geometry?.length) continue;
            if (member.role === 'inner') innerRings.push(member.geometry);
            else if (member.role === 'outer' || feature.type === 'relation') outerRings.push(member.geometry);
        }
        const inWater = outerRings.some(ring => pointInRing(place, ring));
        const inLandIsland = innerRings.some(ring => pointInRing(place, ring));
        return inWater && !inLandIsland;
    });
}

function hasCoastlineData(waterFeatures) {
    return waterFeatures.some(feature => feature.tags?.natural === 'coastline' && feature.geometry?.length >= 2);
}

function distanceToMappedLine(point, line) {
    const longitudeScale = 111320 * Math.cos(point.lat * Math.PI / 180);
    const pointX = point.lon * longitudeScale;
    const pointY = point.lat * 110540;
    let minimumDistance = Infinity;
    for (let index = 0; index < line.length - 1; index++) {
        const startX = line[index].lon * longitudeScale;
        const startY = line[index].lat * 110540;
        const endX = line[index + 1].lon * longitudeScale;
        const endY = line[index + 1].lat * 110540;
        const deltaX = endX - startX;
        const deltaY = endY - startY;
        const lengthSquared = deltaX ** 2 + deltaY ** 2;
        const projection = lengthSquared ? Math.max(0, Math.min(1, ((pointX - startX) * deltaX + (pointY - startY) * deltaY) / lengthSquared)) : 0;
        minimumDistance = Math.min(minimumDistance, Math.hypot(pointX - (startX + projection * deltaX), pointY - (startY + projection * deltaY)));
    }
    return minimumDistance;
}

function pointInRing(point, ring) {
    if (ring.length < 4) return false;
    let isInside = false;
    for (let current = 0, previous = ring.length - 1; current < ring.length; previous = current++) {
        const a = ring[current];
        const b = ring[previous];
        const cross = (point.lon - a.lon) * (b.lat - a.lat) - (point.lat - a.lat) * (b.lon - a.lon);
        const onSegment = Math.abs(cross) <= 1e-10
            && point.lon >= Math.min(a.lon, b.lon) - 1e-7
            && point.lon <= Math.max(a.lon, b.lon) + 1e-7
            && point.lat >= Math.min(a.lat, b.lat) - 1e-7
            && point.lat <= Math.max(a.lat, b.lat) + 1e-7;
        if (onSegment) return true;
        const crossesLatitude = (a.lat > point.lat) !== (b.lat > point.lat);
        if (crossesLatitude && point.lon < (b.lon - a.lon) * (point.lat - a.lat) / (b.lat - a.lat) + a.lon) {
            isInside = !isInside;
        }
    }
    return isInside;
}

function passesShelterMapFilters(place, state = lastState, waterFeatures = latestWaterFeatures) {
    return hasCoastlineData(waterFeatures)
        && clearsModeledFloodBuffer(place, state)
        && !isInsideMappedWater(place, waterFeatures);
}

function clearsModeledFloodBuffer(place, state = lastState) {
    if (!state?.length) return false;
    const exclusionDistance = 1400 + 250;
    return state.filter(zone => zone.depth >= 0.05)
        .every(zone => distanceMeters(place, zone) >= exclusionDistance);
}

function placeProposedShelter(latlng) {
    const point = { lat: latlng.lat, lon: latlng.lng };
    const status = document.getElementById('proposed-site-status');
    if (!lastState || !hasShelterMapData) {
        status.textContent = 'Flood forecast or OSM water data is unavailable. Site not placed.';
        return;
    }
    if (isInsideMappedWater(point, latestWaterFeatures)) {
        status.textContent = 'That point falls inside mapped water. Choose a land point outside the water feature.';
        return;
    }
    if (!passesShelterMapFilters(point, lastState, latestWaterFeatures)) {
        status.textContent = 'That point is inside a modeled flood area or within its 250 m safety buffer. Choose a farther point.';
        return;
    }

    proposedShelter = point;
    proposedShelterLayerGroup.clearLayers();
    proposedShelterMarker = L.marker([point.lat, point.lon], {
        icon: L.divIcon({ className: 'user-proposed-site-marker', html: 'P', iconSize: [28, 28], iconAnchor: [14, 14] }),
        title: 'Proposed site - not a verified shelter'
    }).addTo(proposedShelterLayerGroup);
    const popup = document.createElement('div');
    const heading = document.createElement('strong');
    heading.textContent = 'Proposed shelter site';
    const notice = document.createElement('div');
    notice.textContent = 'User-placed suggestion only. Not an existing, approved, or verified shelter; not used for route guidance.';
    popup.append(heading, notice);
    proposedShelterMarker.bindPopup(popup).openPopup();
    shelterPlacementMode = false;
    map.getContainer().classList.remove('shelter-placement-active');
    document.getElementById('place-proposed-site').textContent = 'Replace proposed site';
    document.getElementById('remove-proposed-site').hidden = false;
    status.textContent = `Proposed point placed outside modeled flood areas with 250 m clearance at ${point.lat.toFixed(5)}, ${point.lon.toFixed(5)}. Not official or verified.`;
}

function clearProposedShelter() {
    proposedShelter = null;
    proposedShelterMarker = null;
    shelterPlacementMode = false;
    map?.getContainer().classList.remove('shelter-placement-active');
    proposedShelterLayerGroup?.clearLayers();
    document.getElementById('place-proposed-site').textContent = 'Place proposed site';
    document.getElementById('remove-proposed-site').hidden = true;
    document.getElementById('proposed-site-status').textContent = 'Proposed site is not an official or verified shelter.';
}

document.getElementById('ngo-place-pin')?.addEventListener('click', () => {
    ngoPlacementMode = true;
    map.getContainer().classList.add('shelter-placement-active');
    document.getElementById('ngo-route-status').textContent = 'Click the map to place the team base.';
    document.getElementById('ngo-place-pin').textContent = 'Choose map location…';
});

function placeNgoBase(latlng) {
    document.getElementById('ngo-lat').value = latlng.lat.toFixed(5);
    document.getElementById('ngo-lon').value = latlng.lng.toFixed(5);
    if (!ngoBaseMarker) {
        ngoBaseMarker = L.marker(latlng, {
            icon: L.divIcon({ className: 'user-proposed-site-marker', html: 'B', iconSize: [28, 28], iconAnchor: [14, 14] }),
            title: 'Team Base'
        }).addTo(map);
    } else {
        ngoBaseMarker.setLatLng(latlng);
    }
    ngoPlacementMode = false;
    map.getContainer().classList.remove('shelter-placement-active');
    document.getElementById('ngo-place-pin').textContent = 'Replace team base pin';
    document.getElementById('ngo-route-status').textContent = `Team base placed at ${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}.`;
}

document.getElementById('route-place-pin')?.addEventListener('click', () => {
    routePlacementMode = true;
    map.getContainer().classList.add('shelter-placement-active');
    document.getElementById('consumer-route-status').textContent = 'Click the map to place your start location.';
    document.getElementById('route-place-pin').textContent = 'Choose map location…';
});

function placeRouteStart(latlng) {
    document.getElementById('route-lat').value = latlng.lat.toFixed(5);
    document.getElementById('route-lon').value = latlng.lng.toFixed(5);
    if (!routeStartMarker) {
        routeStartMarker = L.marker(latlng, {
            icon: L.divIcon({ className: 'user-proposed-site-marker', html: 'S', iconSize: [28, 28], iconAnchor: [14, 14] }),
            title: 'Start Location'
        }).addTo(map);
    } else {
        routeStartMarker.setLatLng(latlng);
    }
    routePlacementMode = false;
    map.getContainer().classList.remove('shelter-placement-active');
    document.getElementById('route-place-pin').textContent = 'Replace start pin';
    document.getElementById('consumer-route-status').textContent = `Start location placed at ${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}.`;
}

function renderDefaultProposedShelters(state) {
    clearDefaultProposedShelters('No proposed sites are shown until coastline, water, and flood checks are available.');
    if (!state?.length || !hasFetchedMappedShelters) return;
    const waterVerified = hasShelterMapData && hasCoastlineData(latestWaterFeatures);
    if (!waterVerified) return;
    const wetZones = state.filter(zone => zone.depth >= 0.05);
    const radii = [1680, 1800, 1950, 2150, 2400, 2700, 3200, 4000];
    const candidates = [];
    for (const zone of wetZones) {
        for (const radius of radii) {
            for (let step = 0; step < 48; step++) {
                const angle = step * Math.PI / 24;
                const point = {
                    lat: zone.lat + Math.sin(angle) * radius / 110540,
                    lon: zone.lon + Math.cos(angle) * radius / (111320 * Math.cos(zone.lat * Math.PI / 180))
                };
                const passesChecks = passesShelterMapFilters(point, state, latestWaterFeatures);
                if (passesChecks) {
                    point.distanceToFlood = Math.min(...wetZones.map(wetZone => distanceMeters(point, wetZone)));
                    candidates.push(point);
                }
            }
        }
    }
    candidates.sort((a, b) => a.distanceToFlood - b.distanceToFlood);
    const mapRect = map.getContainer().getBoundingClientRect();
    const mapSize = map.getSize();
    const occupied = [];
    ['#zone-info-overlay', '#scenario-overlay', '#map-legend', '#shelter-directory'].forEach(selector => {
        const element = document.querySelector(selector);
        if (!element || !element.getClientRects().length) return;
        const rect = element.getBoundingClientRect();
        occupied.push({
            left: rect.left - mapRect.left,
            right: rect.right - mapRect.left,
            top: rect.top - mapRect.top,
            bottom: rect.bottom - mapRect.top
        });
    });
    map.getContainer().querySelectorAll('.shelter-marker, .user-proposed-site-marker').forEach(element => {
        const rect = element.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        occupied.push({
            left: rect.left - mapRect.left,
            right: rect.right - mapRect.left,
            top: rect.top - mapRect.top,
            bottom: rect.bottom - mapRect.top
        });
    });
    for (const candidate of candidates) {
        if (!defaultProposedShelters.every(existing => distanceMeters(candidate, existing) >= 700)) continue;
        const point = map.latLngToContainerPoint([candidate.lat, candidate.lon]);
        const box = { left: point.x - 11, right: point.x + 11, top: point.y - 11, bottom: point.y + 11 };
        if (box.left < 0 || box.top < 0 || box.right > mapSize.x || box.bottom > mapSize.y) continue;
        if (occupied.some(other => box.left < other.right && box.right > other.left && box.top < other.bottom && box.bottom > other.top)) continue;
        occupied.push(box);
        const number = defaultProposedShelters.length + 1;
        defaultProposedShelters.push({
            id: `default-${String(number).padStart(2, '0')}`,
            name: `Proposed site ${String(number).padStart(2, '0')}`,
            lat: candidate.lat,
            lon: candidate.lon
        });
        if (defaultProposedShelters.length === 10) break;
    }
    defaultProposedShelters.forEach(point => {
        const marker = L.marker([point.lat, point.lon], {
            icon: L.divIcon({ className: 'default-proposed-marker', html: 'P', iconSize: [22, 22], iconAnchor: [11, 11] }),
            title: `${point.name} - proposed only, not a real shelter`,
            zIndexOffset: 500
        }).addTo(defaultProposedLayerGroup);
        const popup = document.createElement('div');
        const heading = document.createElement('strong');
        heading.textContent = point.name;
        const notice = document.createElement('div');
        notice.textContent = 'Proposed demo point only. It clears mapped coastline, water, and flood buffers, but is not a real or approved shelter and is not used for route guidance.';
        popup.append(heading, notice);
        marker.bindPopup(popup);
        defaultProposedMarkersById.set(point.id, marker);
    });
    const list = document.getElementById('default-proposed-list');
    list.replaceChildren();
    const disclaimer = document.createElement('p');
    disclaimer.className = 'shelter-list-empty';
    disclaimer.textContent = `${defaultProposedShelters.length} proposed demo points pass coastline, water, and flood screening. None are real or approved shelters.`;
    list.appendChild(disclaimer);
    if (!defaultProposedShelters.length) {
        const empty = document.createElement('p');
        empty.className = 'shelter-list-empty';
        empty.textContent = 'No default candidates pass the current flood check.';
        list.appendChild(empty);
    } else {
        defaultProposedShelters.forEach(point => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'shelter-list-item default-proposed-item';
            button.dataset.defaultSiteId = point.id;
            const name = document.createElement('span');
            name.className = 'shelter-list-name';
            name.textContent = point.name;
            const tag = document.createElement('span');
            tag.className = 'shelter-list-kind';
            tag.textContent = 'PROPOSED';
            button.append(name, tag);
            list.appendChild(button);
        });
    }
    document.getElementById('shelter-count').textContent = `${shelterMarkersByKey.size} OSM · ${defaultProposedShelters.length} proposed`;
}

function clearDefaultProposedShelters(message) {
    defaultProposedLayerGroup?.clearLayers();
    defaultProposedMarkersById.clear();
    defaultProposedShelters = [];
    const list = document.getElementById('default-proposed-list');
    if (list) {
        list.replaceChildren();
        const note = document.createElement('p');
        note.className = 'shelter-list-empty';
        note.textContent = message;
        list.appendChild(note);
    }
    const count = document.getElementById('shelter-count');
    if (count) count.textContent = `${shelterMarkersByKey.size} OSM · 0 proposed`;
}

function renderResponseList(state) {
    const responseZones = state.filter(zone => zone.rpi > 0.5).sort((a, b) => b.rpi - a.rpi);
    document.getElementById('response-list').innerHTML = responseZones.map((zone, index) => `
        <button type="button" class="resp-card" onclick="selectZone('${zone.id}')">
            <span class="resp-rank">${index + 1}</span>
            <span class="resp-body">
                <span class="resp-name">${zone.name} <span class="${zone.sev.css}" style="margin-left:6px">${zone.sev.label}</span></span>
                <span class="resp-detail">
                    Demo RPI proxy: <span class="mono text-accent" title="Flood probability × modeled peak depth in metres × 100">${zone.rpi.toFixed(1)}</span> |
                    Depth: <span class="mono">${zone.depth.toFixed(2)}m</span> (${zone.depth_p10?.toFixed(2) || '?'}–${zone.depth_p90?.toFixed(2) || '?'}m range)<br>
                    Facilities noted: ${zone.facilities || 'none configured'}
                </span>
            </span>
        </button>
    `).join('') || '<div class="why-empty">No zones currently meet the response-list threshold.</div>';
}

function getRouteOrigin(prefix) {
    const latitudeText = document.getElementById(`${prefix}-lat`).value.trim();
    const longitudeText = document.getElementById(`${prefix}-lon`).value.trim();
    if (!latitudeText || !longitudeText) throw new Error('Enter a starting location or use device location.');
    const latitude = Number(latitudeText);
    const longitude = Number(longitudeText);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
        throw new Error('Enter valid decimal-degree latitude and longitude, or use device location.');
    }
    return { lat: latitude, lon: longitude };
}

function useDeviceLocation(prefix, statusId) {
    const status = document.getElementById(statusId);
    if (!navigator.geolocation) {
        status.textContent = 'Location is not available in this browser. Enter coordinates manually.';
        return;
    }
    status.textContent = 'Waiting for location permission…';
    navigator.geolocation.getCurrentPosition(position => {
        const latlng = { lat: position.coords.latitude, lng: position.coords.longitude };
        if (prefix === 'ngo') {
            placeNgoBase(latlng);
        } else {
            placeRouteStart(latlng);
        }
        status.textContent = 'Starting point set from device location.';
    }, () => { status.textContent = 'Could not read location. Please place a pin manually.'; }, { enableHighAccuracy: true, timeout: 10000 });
}

async function fetchMappedShelters(origin, state) {
    const south = (origin.lat - 0.1).toFixed(5);
    const west = (origin.lon - 0.12).toFixed(5);
    const north = (origin.lat + 0.1).toFixed(5);
    const east = (origin.lon + 0.12).toFixed(5);
    const bbox = `${south},${west},${north},${east}`;
    const query = `[out:json][timeout:20];(nwr["amenity"="shelter"](around:10000,${origin.lat},${origin.lon});nwr["emergency"="shelter"](around:10000,${origin.lat},${origin.lon});)->.shelters;( .shelters;way["natural"~"water|wetland|bay"](${bbox});rel["natural"~"water|wetland|bay"](${bbox});way["landuse"~"reservoir|basin"](${bbox});rel["landuse"~"reservoir|basin"](${bbox});way["waterway"~"riverbank|dock"](${bbox});rel["waterway"~"riverbank|dock"](${bbox});way(around.shelters:250)["waterway"~"river|stream|canal|ditch"];);out center geom tags;`;
    const response = await fetchWithTimeout('https://overpass-api.de/api/interpreter', {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' }, body: `data=${encodeURIComponent(query)}`
    }, 12000, 'Shelter lookup timed out. Try again when OpenStreetMap is reachable.');
    if (!response.ok) throw new Error('OpenStreetMap shelter lookup is unavailable right now.');
    const data = await response.json();
    const elements = data.elements || [];
    const waterFeatures = elements.filter(isMappedWaterFeature);
    const mappedShelters = elements.filter(isMappedShelterFeature).map(element => ({
        type: element.type,
        id: element.id,
        name: element.tags?.name || `Mapped shelter (OSM ${element.id})`,
        category: element.tags?.amenity || element.tags?.emergency || 'shelter',
        lat: element.lat ?? element.center?.lat,
        lon: element.lon ?? element.center?.lon
    })).filter(place => Number.isFinite(place.lat) && Number.isFinite(place.lon));
    const safeShelters = mappedShelters.filter(place => passesShelterMapFilters(place, state, waterFeatures));
    if (mappedShelters.length && !safeShelters.length) {
        throw new Error('All mapped shelters failed the OSM water-feature or 250 m modeled-flood-edge checks; no route destination is offered.');
    }
    return safeShelters
        .sort((a, b) => distanceMeters(origin, a) - distanceMeters(origin, b)).slice(0, 5);
}

async function requestOsrmRoutes(origin, destination) {
    const url = `https://router.project-osrm.org/route/v1/driving/${origin.lon},${origin.lat};${destination.lon},${destination.lat}?alternatives=3&overview=full&geometries=geojson&steps=false`;
    const response = await fetchWithTimeout(url, {}, 12000, 'OSRM routing timed out. Try again when the routing service is reachable.');
    if (!response.ok) throw new Error('OSRM routing service is unavailable.');
    const data = await response.json();
    if (data.code !== 'Ok' || !data.routes?.length || data.waypoints?.length !== 2 || data.waypoints.some(waypoint => !waypoint.location)) {
        return { routes: [], snapDistance: Infinity };
    }
    const snapDistance = Math.max(0, ...(data.waypoints || []).map(waypoint => waypoint.distance || 0));
    return {
        routes: data.routes,
        snapDistance,
        snappedOrigin: { lon: data.waypoints[0].location[0], lat: data.waypoints[0].location[1] },
        snappedDestination: { lon: data.waypoints[1].location[0], lat: data.waypoints[1].location[1] }
    };
}

async function fetchWithTimeout(url, options, timeoutMs, timeoutMessage) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } catch (error) {
        if (error.name === 'AbortError') throw new Error(timeoutMessage);
        throw error;
    } finally {
        clearTimeout(timeoutId);
    }
}

function routeFloodHits(route, state, ignoredZoneId = null) {
    const exposedZones = state.filter(zone => zone.depth >= 0.1 && zone.id !== ignoredZoneId);
    const hits = new Set();
    const coordinates = route.geometry.coordinates;
    const sampledCoordinates = [];
    for (let index = 0; index < coordinates.length - 1; index++) {
        const start = { lat: coordinates[index][1], lon: coordinates[index][0] };
        const end = { lat: coordinates[index + 1][1], lon: coordinates[index + 1][0] };
        const steps = Math.max(1, Math.ceil(distanceMeters(start, end) / 400));
        for (let step = 0; step < steps; step++) {
            const fraction = step / steps;
            sampledCoordinates.push([
                start.lon + (end.lon - start.lon) * fraction,
                start.lat + (end.lat - start.lat) * fraction
            ]);
        }
    }
    if (coordinates.length) sampledCoordinates.push(coordinates[coordinates.length - 1]);
    for (const [longitude, latitude] of sampledCoordinates) {
        for (const zone of exposedZones) {
            if (distanceMeters({ lat: latitude, lon: longitude }, zone) <= 1400) hits.add(zone.name);
        }
    }
    return [...hits];
}

function clearDisplayedRoutes() {
    for (const layer of Object.values(routeLayers)) {
        if (layer && map?.hasLayer(layer)) map.removeLayer(layer);
    }
    routeEndpointLayer?.clearLayers();
}

function displayRoute(route, origin, destination, statusId, mode, snapDistance, note = '') {
    if (!map) throw new Error('The map is unavailable, so the route cannot be drawn.');
    clearDisplayedRoutes();
    const style = mode === 'ngo'
        ? { color: '#ff9b54', weight: 6, opacity: 0.95, dashArray: '10 7' }
        : { color: '#55e39b', weight: 6, opacity: 0.95 };
    routeLayers[mode] = L.geoJSON({ type: 'Feature', properties: {}, geometry: route.geometry }, { style }).addTo(map);
    const startIcon = L.divIcon({ className: `route-point route-start route-${mode}`, html: 'START', iconSize: [54, 20], iconAnchor: [27, 10] });
    const endLabel = mode === 'ngo' ? 'RESCUE' : 'SHELTER';
    const endIcon = L.divIcon({ className: `route-point route-end route-${mode}`, html: endLabel, iconSize: [66, 20], iconAnchor: [33, 10] });
    L.marker([route.snappedOrigin?.lat ?? origin.lat, route.snappedOrigin?.lon ?? origin.lon], { icon: startIcon, keyboard: false }).addTo(routeEndpointLayer);
    L.marker([route.snappedDestination?.lat ?? destination.lat, route.snappedDestination?.lon ?? destination.lon], { icon: endIcon, keyboard: false }).addTo(routeEndpointLayer);
    map.fitBounds(routeLayers[mode].getBounds(), { padding: [50, 50], maxZoom: 15 });
    document.getElementById(statusId).textContent = `${destination.label || destination.name} · ${(route.distance / 1000).toFixed(1)} km · about ${Math.round(route.duration / 60)} min · road snap ≤ ${Math.round(snapDistance)} m. ${note}`;
}

function selectShelterForHouseholdRoute(shelter) {
    selectedHouseholdShelter = shelter;
    setDashboardMode('consumer');
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(panel => panel.classList.remove('active'));
    document.querySelector('[data-target="tab-route"]').classList.add('active');
    document.getElementById('tab-route').classList.add('active');
    const button = document.getElementById('route-selected-shelter');
    button.hidden = false;
    button.textContent = `Route to ${shelter.name}`;
    document.getElementById('consumer-route-status').textContent = `Selected ${shelter.name}. Set your starting point, then route directly to this mapped shelter.`;
}

async function routeToSelectedShelter() {
    const status = document.getElementById('consumer-route-status');
    const shelter = selectedHouseholdShelter;
    if (!shelter) {
        status.textContent = 'Select an OSM-mapped shelter from the map or directory first.';
        return;
    }
    const requestId = ++routeRequestId;
    try {
        const origin = getRouteOrigin('route');
        const state = lastState || await computeState(currentTime);
        if (!passesShelterMapFilters(shelter, state, latestWaterFeatures)) {
            throw new Error('This shelter no longer passes the current flood and mapped-water checks.');
        }
        status.textContent = `Checking a route to ${shelter.name}…`;
        const result = await requestOsrmRoutes(origin, shelter);
        if (requestId !== routeRequestId || dashboardMode !== 'consumer') return;
        if (result.snapDistance > 500) throw new Error('The requested start or shelter is too far from a mapped road.');
        const feasible = result.routes.filter(route => routeFloodHits(route, state).length === 0)
            .sort((a, b) => a.duration - b.duration);
        if (!feasible.length) throw new Error('No OSRM route to this shelter avoids all modeled flooded zones. Follow local emergency guidance.');
        feasible[0].snappedOrigin = result.snappedOrigin;
        feasible[0].snappedDestination = result.snappedDestination;
        displayRoute(feasible[0], origin, { ...shelter, label: shelter.name }, 'consumer-route-status', 'consumer', result.snapDistance, 'OSM shelter; availability and opening status unverified.');
    } catch (error) {
        if (requestId !== routeRequestId) return;
        clearDisplayedRoutes();
        status.textContent = error.message;
    }
}

async function findConsumerRoute() {
    const status = document.getElementById('consumer-route-status');
    const requestId = ++routeRequestId;
    try {
        const origin = getRouteOrigin('route');
        status.textContent = 'Looking up mapped shelters and screening OSRM routes…';
        const state = lastState || await computeState(currentTime);
        const shelters = await fetchMappedShelters(origin, state);
        if (!shelters.length) throw new Error('No OSM-tagged shelters were found within 10 km. No destination was invented.');
        const candidates = [];
        const routeResults = await Promise.all(shelters.map(async shelter => {
            try {
                return { shelter, result: await requestOsrmRoutes(origin, shelter) };
            } catch (error) {
                return { shelter, error };
            }
        }));
        if (requestId !== routeRequestId || dashboardMode !== 'consumer') return;
        for (const { shelter, result } of routeResults) {
            if (!result) continue;
            if (result.snapDistance > 500) continue;
            for (const route of result.routes) {
                route.snappedOrigin = result.snappedOrigin;
                route.snappedDestination = result.snappedDestination;
                const floodedZones = routeFloodHits(route, state);
                if (!floodedZones.length) candidates.push({ shelter, route, snapDistance: result.snapDistance });
            }
        }
        candidates.sort((a, b) => a.route.duration - b.route.duration);
        if (!candidates.length && routeResults.every(item => item.error)) throw routeResults[0].error;
        if (!candidates.length) throw new Error('No screened route avoids all modeled flooded zones or passes the road-snap check. Do not attempt travel through floodwater; follow emergency services.');
        const best = candidates[0];
        displayRoute(best.route, origin, { ...best.shelter, label: best.shelter.name }, 'consumer-route-status', 'consumer', best.snapDistance, 'OSM-mapped shelter; opening status unverified.');
    } catch (error) {
        if (requestId !== routeRequestId) return;
        clearDisplayedRoutes();
        status.textContent = error.message;
    }
}

async function planNgoRoute() {
    const status = document.getElementById('ngo-route-status');
    const requestId = ++routeRequestId;
    try {
        const origin = getRouteOrigin('ngo');
        const state = lastState || await computeState(currentTime);
        const flooded = state.filter(zone => zone.depth >= 0.05);
        if (!flooded.length) throw new Error('No modeled zones currently meet the dispatch threshold.');
        
        status.textContent = 'Evaluating screened routes to find the quickest path to a priority zone…';

        const severityLevels = ['SEVERE', 'HIGH', 'MODERATE', 'LOW'];
        for (const level of severityLevels) {
            const targets = flooded.filter(zone => zone.sev.label === level)
                                   .sort((a, b) => distanceMeters(origin, a) - distanceMeters(origin, b));
            if (!targets.length) continue;
            
            let allResults = [];
            // Process in batches of 5 to avoid OSRM rate limits
            for (let i = 0; i < targets.length; i += 5) {
                const batch = targets.slice(i, i + 5);
                const promises = batch.map(async target => {
                    try {
                        const result = await requestOsrmRoutes(origin, target);
                        if (result.snapDistance > 700) return null;
                        const feasible = result.routes.filter(route => routeFloodHits(route, state, target.id).length === 0)
                            .sort((a, b) => a.duration - b.duration);
                        if (feasible.length) {
                            feasible[0].snappedOrigin = result.snappedOrigin;
                            feasible[0].snappedDestination = result.snappedDestination;
                            return { target, route: feasible[0], snapDistance: result.snapDistance };
                        }
                    } catch (e) {
                        return null;
                    }
                    return null;
                });
                const results = (await Promise.all(promises)).filter(r => r !== null);
                if (requestId !== routeRequestId || dashboardMode !== 'ngo') return;
                allResults.push(...results);
            }
            
            if (allResults.length > 0) {
                allResults.sort((a, b) => a.route.duration - b.route.duration);
                const best = allResults[0];
                selectedZoneId = best.target.id;
                updateUI();
                displayRoute(best.route, origin, { ...best.target, label: `${best.target.name} · ${best.target.sev.label}` }, 'ngo-route-status', 'ngo', best.snapDistance, 'Route screens other modeled zones; final access inside target zone is unverified.');
                return;
            }
        }
        
        throw new Error('No screened approach route found for affected zones. Do not dispatch through modeled flooded areas; verify conditions with local responders.');
    } catch (error) {
        if (requestId !== routeRequestId) return;
        clearDisplayedRoutes();
        status.textContent = error.message;
    }
}

function setDashboardMode(mode) {
    if (dashboardMode !== mode) {
        routeRequestId++;
        clearDisplayedRoutes();
        document.getElementById('consumer-route-status').textContent = 'No household route currently shown.';
        document.getElementById('ngo-route-status').textContent = 'No dispatch route currently shown.';
    }
    dashboardMode = mode;
    document.body.classList.toggle('ngo-mode', mode === 'ngo');
    document.querySelectorAll('.dashboard-mode').forEach(button => button.classList.toggle('active', button.dataset.mode === mode));
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('mode-hidden'));
    const selectedTab = mode === 'ngo' ? 'tab-response' : 'tab-alerts';
    document.querySelectorAll('.tab').forEach(tab => tab.classList.toggle('active', tab.dataset.target === selectedTab));
    document.querySelectorAll('.tab-content').forEach(panel => panel.classList.toggle('active', panel.id === selectedTab));
    document.getElementById('consumer-route').hidden = mode !== 'consumer';
    document.getElementById('ngo-route').hidden = mode !== 'ngo';
    document.querySelector('[data-target="tab-response"]').textContent = mode === 'ngo' ? 'DISPATCH QUEUE' : 'RESPONSE';
}

document.querySelectorAll('.dashboard-mode').forEach(button => button.addEventListener('click', () => setDashboardMode(button.dataset.mode)));
document.getElementById('use-location').addEventListener('click', () => useDeviceLocation('route', 'consumer-route-status'));
document.getElementById('ngo-use-location').addEventListener('click', () => useDeviceLocation('ngo', 'ngo-route-status'));
document.getElementById('find-shelter-route').addEventListener('click', findConsumerRoute);
document.getElementById('route-selected-shelter').addEventListener('click', routeToSelectedShelter);
document.getElementById('plan-rescue-route').addEventListener('click', planNgoRoute);
setDashboardMode('consumer');

// Chart
function initChart() {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/chartjs-plugin-annotation/2.2.1/chartjs-plugin-annotation.min.js';
    script.onload = () => {
        const ctx = document.getElementById('timeline-chart').getContext('2d');
        const labels = Array.from({length:24}, (_,i) => i);
        
        timelineChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [
                    { label:'Rain (mm)', data:[], borderColor:'#00D4FF', borderWidth:2, pointRadius:0, tension:0.4, fill: { target:'origin', above:'rgba(0,212,255,0.08)' } },
                    { label:'Tide', data:[], borderColor:'#5B8DEF', borderWidth:1, borderDash:[4,4], pointRadius:0, tension:0.4 }
                ]
            },
            options: {
                responsive:true, maintainAspectRatio:false,
                plugins: {
                    legend: { display:false },
                    annotation: { annotations: { line1: { type:'line', xMin:currentTime, xMax:currentTime, borderColor:'#FF3366', borderWidth:2, borderDash:[4,2] } } }
                },
                scales: {
                    x: { grid:{display:false}, ticks:{color:'#648299', font:{family:'JetBrains Mono', size:10}} },
                    y: { display:false }
                }
            }
        });
        updateChartData();
    };
    document.head.appendChild(script);
}

function updateChartData() {
    if(!timelineChart) return;
    const scen = SCENARIOS[currentScenario];
    const rain = Array.from({length:24}, (_,i) => Math.exp(-0.5*((i-14)/2)**2) * scen.rain_peak);
    const tide = Array.from({length:24}, (_,i) => Math.sin(i/12*Math.PI) * (scen.tide * 10));
    
    timelineChart.data.datasets[0].data = rain;
    timelineChart.data.datasets[1].data = tide;
    timelineChart.update('none');
}

// Tab switching
document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', e => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        e.target.classList.add('active');
        document.getElementById(e.target.dataset.target).classList.add('active');
    });
});

// Slider
document.getElementById('time-slider').addEventListener('input', e => {
    currentTime = parseInt(e.target.value);
    updateUI();
});

// Scenario Select
document.getElementById('scenario-select').addEventListener('change', e => {
    currentScenario = e.target.value;
    updateChartData();
    updateUI();
});

// Boot
let lastLiveId = -1;
function startLivePolling() {
    setInterval(async () => {
        try {
            const apiUrl = window.location.protocol === 'file:' 
                ? 'http://127.0.0.1:8080/api/scenario' 
                : '/api/scenario';
            const res = await fetch(apiUrl);
            const data = await res.json();
            
            if (data.id > lastLiveId) {
                lastLiveId = data.id;
                
                // Update live scenario data
                SCENARIOS['live'] = {
                    name: data.name,
                    desc: data.desc,
                    rain_max: data.rain_max,
                    rain_peak: data.rain_peak,
                    tide: data.tide,
                    wind: data.wind
                };
                
                // Force switch to live scenario
                currentScenario = 'live';
                document.getElementById('scenario-select').value = 'live';
                
                // Re-render
                updateChartData();
                updateUI();
            }
        } catch (e) {
            // Silently ignore if offline
        }
    }, 2000);
}

window.onload = () => { initMap(); initChart(); updateUI(); startLivePolling(); };
