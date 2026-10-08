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
let currentScenario = 'monsoon';
let lastState = null;

const SCENARIOS = {
    'monsoon': { name: 'Monsoon Surge', desc: 'Heavy sustained rainfall (180mm) combined with high spring tide (1.8m).', rain_max: 180, rain_peak: 45, tide: 1.8, wind: 45 },
    'cyclone': { name: 'Cyclone Landfall', desc: 'Extreme short-duration rain (250mm) and massive storm surge (2.8m).', rain_max: 250, rain_peak: 80, tide: 2.8, wind: 120 },
    'king_tide': { name: 'King Tide + Rain', desc: 'Minimal rain (40mm) but exceptionally high astronomical tide (2.2m).', rain_max: 40, rain_peak: 10, tide: 2.2, wind: 20 },
    'cloudburst': { name: 'Urban Cloudburst', desc: 'Sudden, extreme localized rainfall (120mm in 2 hrs) during low tide.', rain_max: 120, rain_peak: 90, tide: 0.5, wind: 35 },
    'calm': { name: 'Baseline Conditions', desc: 'Normal sunny day. No significant weather events.', rain_max: 0, rain_peak: 0, tide: 0.8, wind: 10 }
};

// Severity mapping
function getSeverity(depth) {
    if (depth < 0.1)  return { label: 'LOW',      color: '#00F0FF', css: 'bg-low' };
    if (depth < 0.4)  return { label: 'MODERATE',  color: '#FFC000', css: 'bg-moderate' };
    if (depth < 0.8)  return { label: 'HIGH',      color: '#FF3366', css: 'bg-high' };
    return                    { label: 'SEVERE',    color: '#FF003C', css: 'bg-severe' };
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

    map = L.map('map', { zoomControl: false }).setView([12.88, 74.83], 12);
    
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
            icon: L.divIcon({ className: 'rpi-marker mono', html: '', iconSize: [60, 16], iconAnchor: [30, 8] })
        }).addTo(map);

        // Zone name label (below)
        nameLabels[z.id] = L.marker([z.lat - 0.008, z.lon], {
            icon: L.divIcon({ className: 'zone-label', html: z.name, iconSize: [80, 14], iconAnchor: [40, 7] })
        }).addTo(map);
    });

    // Fix for Leaflet sometimes rendering gray tiles inside flex containers on initial load
    setTimeout(() => {
        map.invalidateSize();
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
                    weight: selectedZoneId === s.id ? 3 : 1
                });
            }

            if (rpiMarkers[s.id]) {
                rpiMarkers[s.id].setIcon(L.divIcon({
                    className: 'rpi-marker mono',
                    html: s.rpi > 1 ? `${s.rpi.toFixed(0)}` : '',
                    iconSize: [40, 16], iconAnchor: [20, 8]
                }));
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
    const resp = state.filter(s => s.rpi > 0.5).sort((a,b) => b.rpi - a.rpi);
    document.getElementById('response-list').innerHTML = resp.map((s,i) => `
        <div class="resp-card">
            <div class="resp-rank">${i+1}</div>
            <div class="resp-body">
                <div class="resp-name">${s.name} <span class="${s.sev.css}" style="margin-left:6px">${s.sev.label}</span></div>
                <div class="resp-detail">
                    RPI: <span class="mono text-accent">${s.rpi.toFixed(1)}</span> |
                    Depth: <span class="mono">${s.depth.toFixed(2)}m</span> (${s.depth_p10?.toFixed(2) || '?'}–${s.depth_p90?.toFixed(2) || '?'}m range)<br>
                    Facilities at risk: ${s.facilities}
                </div>
            </div>
        </div>
    `).join('');

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
        ${(sel.drivers || []).map(d => `
            <div class="why-driver">
                <div class="why-driver-header">
                    <span class="why-driver-name">${d.name}</span>
                    <span class="why-driver-pct">${d.pct}%</span>
                </div>
                <div class="why-driver-bar">
                    <div class="why-driver-fill ${categoryColors[d.category] || 'cat-weather'}" style="width:${d.pct}%"></div>
                </div>
                <div class="why-driver-detail">${d.detail}</div>
            </div>
        `).join('')}
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
    const totalPopAtRisk = state.filter(s => s.depth > 0.3).reduce((sum, s) => sum + s.pop, 0);
    const totalImpassable = state.filter(s => s.depth > 0.4).length;
    
    document.getElementById('stats-content').innerHTML = `
        <div class="stat-card">
            <div class="stat-value">${totalPopAtRisk.toLocaleString()}</div>
            <div class="stat-label">Population at Risk (Depth > 0.3m)</div>
        </div>
        <div class="stat-row">
            <div class="stat-card">
                <div class="stat-value">${sevCount}</div>
                <div class="stat-label">Severe Zones</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${totalImpassable}</div>
                <div class="stat-label">Impassable Roads</div>
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${(state.reduce((a,b)=>a+b.p,0)/state.length*100).toFixed(0)}%</div>
            <div class="stat-label">Average Flood Probability</div>
        </div>
    `;

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
window.onload = () => { initMap(); initChart(); updateUI(); };
