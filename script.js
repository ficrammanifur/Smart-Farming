/* ==========================================================================
   SMART FARMING IOT DASHBOARD - JAVASCRIPT (VANILLA ES6+)
   ========================================================================== */

/**
 * --------------------------------------------------------------------------
 * 1. MOCK DATA STATE
 * --------------------------------------------------------------------------
 * Singleton object holding the telemetry & control state of the Smart Farm.
 * All UI elements read their state from this object.
 */
const mockData = {
    temperature: 28.4,
    humidity: 72,
    soilMoisture: 43,
    waterLevel: 78,
    light: "DAY",
    pump: false,
    lamp: true,
    buzzer: false,
    system: "ONLINE"
};

/**
 * --------------------------------------------------------------------------
 * 2. CAMERA GALLERY MEMORY BUFFER (MAX 3 PHOTOS)
 * --------------------------------------------------------------------------
 * In-memory FIFO array to hold up to 3 recent captured photos.
 * Cleared on page refresh as per specification.
 */
let recentCaptures = [];

/**
 * --------------------------------------------------------------------------
 * 3. CHART DUMMY HISTORY DATA (15 TIMEPINTS)
 * --------------------------------------------------------------------------
 */
const chartHistory = {
    labels: ["01:30", "01:31", "01:32", "01:33", "01:34", "01:35", "01:36", "01:37", "01:38", "01:39", "01:40", "01:41", "01:42", "01:43", "01:44"],
    tempData: [27.2, 27.5, 27.8, 28.0, 28.1, 28.3, 28.2, 28.4, 28.5, 28.3, 28.4, 28.6, 28.4, 28.5, 28.4],
    soilData: [48, 47, 46, 45, 45, 44, 44, 43, 43, 42, 43, 43, 44, 43, 43]
};

let currentChartTab = 'temp'; // 'temp' or 'soil'

/* ==========================================================================
   4. DOM CONTENT LOADED INITIALIZATION
   ========================================================================== */
document.addEventListener("DOMContentLoaded", () => {
    initNavigation();
    initUIFromMockData();
    initChart();
    initCameraModule();
    initSimulationControls();
    initManualControls();
});

/* ==========================================================================
   5. NAVIGATION & SIDEBAR CONTROLS
   ========================================================================== */
function initNavigation() {
    const sidebar = document.getElementById("sidebar");
    const overlay = document.getElementById("sidebarOverlay");
    const toggleBtn = document.getElementById("mobileToggleBtn");
    const closeBtn = document.getElementById("mobileCloseBtn");

    function openSidebar() {
        sidebar.classList.add("open");
        overlay.classList.add("active");
    }

    function closeSidebar() {
        sidebar.classList.remove("open");
        overlay.classList.remove("active");
    }

    if (toggleBtn) toggleBtn.addEventListener("click", openSidebar);
    if (closeBtn) closeBtn.addEventListener("click", closeSidebar);
    if (overlay) overlay.addEventListener("click", closeSidebar);

    // Nav Item Click Active state
    const navItems = document.querySelectorAll(".nav-item");
    navItems.forEach(item => {
        item.addEventListener("click", (e) => {
            navItems.forEach(n => n.classList.remove("active"));
            item.classList.add("active");
            if (window.innerWidth <= 992) {
                closeSidebar();
            }
        });
    });
}

/* ==========================================================================
   6. FUTURE MQTT INTEGRATION PREPARATION FUNCTIONS
   ==========================================================================
   These functions serve as the direct decoupled API layer between incoming
   MQTT topic payloads and the DOM presentation layer.
   When HiveMQ WSS is implemented, incoming messages will simply invoke these!
   ========================================================================== */

/**
 * Update Sensor Data UI from telemetry object
 * @param {Object} data - { temperature, humidity, soilMoisture, waterLevel, light }
 */
function updateSensorData(data) {
    if (!data) return;

    if (data.temperature !== undefined) mockData.temperature = data.temperature;
    if (data.humidity !== undefined) mockData.humidity = data.humidity;
    if (data.soilMoisture !== undefined) mockData.soilMoisture = data.soilMoisture;
    if (data.waterLevel !== undefined) mockData.waterLevel = data.waterLevel;
    if (data.light !== undefined) mockData.light = data.light;

    // Render updated sensors to DOM
    renderSensorCards();
    renderEnvironmentSummary();
    updateLastTimestamp();
}

/**
 * Update Actuator Status UI from actuator state object
 * @param {Object} data - { pump, lamp, buzzer }
 */
function updateActuatorStatus(data) {
    if (!data) return;

    if (data.pump !== undefined) mockData.pump = data.pump;
    if (data.lamp !== undefined) mockData.lamp = data.lamp;
    if (data.buzzer !== undefined) mockData.buzzer = data.buzzer;

    renderActuators();
    renderAutomationPanel();
    updateLastTimestamp();
}

/**
 * Update System Status UI
 * @param {string} status - "ONLINE" | "OFFLINE" | "WARNING"
 */
function updateSystemStatus(status) {
    if (!status) return;
    mockData.system = status;
    renderSystemStatus();
}

/**
 * Handle incoming camera capture trigger command from MQTT or local UI
 */
function handleCameraCommand() {
    captureImage();
}

/* ==========================================================================
   7. UI PRESENTATION RENDERERS (READ FROM MOCKDATA)
   ========================================================================== */

/**
 * Populate all UI components initially from mockData
 */
function initUIFromMockData() {
    renderSystemStatus();
    renderSensorCards();
    renderEnvironmentSummary();
    renderActuators();
    renderAutomationPanel();
    updateLastTimestamp();
}

function renderSystemStatus() {
    const sysDot = document.getElementById("sysStatusDot");
    const sysText = document.getElementById("sysStatusText");
    const headerStatus = document.getElementById("headerSystemStatus");
    const sysBadge = document.getElementById("sysStatusBadge");
    const sysSub = document.getElementById("sysStatusSub");

    const isOnline = mockData.system === "ONLINE";

    if (sysDot) sysDot.className = `status-dot-lg ${isOnline ? "online" : "offline"}`;
    if (sysText) {
        sysText.textContent = mockData.system;
        sysText.style.color = isOnline ? "var(--accent-green)" : "var(--accent-red)";
    }
    if (headerStatus) headerStatus.textContent = `SYSTEM ${mockData.system}`;
    if (sysBadge) {
        sysBadge.textContent = isOnline ? "NORMAL" : "ALERT";
        sysBadge.className = `badge ${isOnline ? "badge-success" : "badge-off"}`;
    }
    if (sysSub) {
        sysSub.textContent = isOnline ? "All systems operating normally" : "Connection lost with MCU";
    }
}

function renderSensorCards() {
    // 1. Temperature Card
    const elTemp = document.getElementById("valTemperature");
    const stTemp = document.getElementById("statusTemperature");
    if (elTemp) elTemp.textContent = mockData.temperature.toFixed(1);
    if (stTemp) {
        if (mockData.temperature > 32) {
            stTemp.textContent = "High Temp";
            stTemp.className = "badge badge-off";
            stTemp.style.borderColor = "var(--accent-amber)";
            stTemp.style.color = "var(--accent-amber)";
        } else {
            stTemp.textContent = "Normal";
            stTemp.className = "badge badge-outline-success";
        }
    }

    // 2. Humidity Card
    const elHum = document.getElementById("valHumidity");
    if (elHum) elHum.textContent = Math.round(mockData.humidity);

    // 3. Soil Moisture Card
    const elSoil = document.getElementById("valSoilMoisture");
    const barSoil = document.getElementById("barSoilMoisture");
    const stSoil = document.getElementById("statusSoilMoisture");
    if (elSoil) elSoil.textContent = Math.round(mockData.soilMoisture);
    if (barSoil) barSoil.style.width = `${Math.min(100, Math.max(0, mockData.soilMoisture))}%`;
    if (stSoil) {
        const soilVal = mockData.soilMoisture;
        if (soilVal < 30) {
            stSoil.textContent = "Moisture Level: Dry (Watering Needed)";
            stSoil.style.color = "var(--accent-amber)";
        } else if (soilVal > 80) {
            stSoil.textContent = "Moisture Level: Wet";
            stSoil.style.color = "var(--accent-blue)";
        } else {
            stSoil.textContent = "Moisture Level: Good";
            stSoil.style.color = "var(--text-muted)";
        }
    }

    // 4. Water Tank Card
    const elWater = document.getElementById("valWaterLevel");
    const barWater = document.getElementById("barWaterLevel");
    const stWater = document.getElementById("statusWaterLevel");
    if (elWater) elWater.textContent = Math.round(mockData.waterLevel);
    if (barWater) barWater.style.width = `${Math.min(100, Math.max(0, mockData.waterLevel))}%`;
    if (stWater) {
        const wVal = mockData.waterLevel;
        if (wVal < 20) {
            stWater.textContent = "Water Level: Low Alert!";
            stWater.style.color = "var(--accent-red)";
        } else {
            stWater.textContent = "Water Level: Good";
            stWater.style.color = "var(--text-muted)";
        }
    }
}

function renderEnvironmentSummary() {
    const eTemp = document.getElementById("envTemp");
    const eHum = document.getElementById("envHumidity");
    const eLight = document.getElementById("envLight");
    const eSoil = document.getElementById("envSoil");
    const eWater = document.getElementById("envWater");

    if (eTemp) eTemp.textContent = `${mockData.temperature.toFixed(1)} °C`;
    if (eHum) eHum.textContent = `${Math.round(mockData.humidity)} %`;
    if (eLight) eLight.textContent = mockData.light;
    if (eSoil) eSoil.textContent = `${Math.round(mockData.soilMoisture)} %`;
    if (eWater) eWater.textContent = `${Math.round(mockData.waterLevel)} %`;
}

function renderActuators() {
    // Water Pump
    const statePump = document.getElementById("statePump");
    const togglePumpManual = document.getElementById("togglePumpManual");
    const togglePumpCard = document.getElementById("togglePumpCard");
    const iconBoxPump = document.getElementById("iconBoxPump");
    const modeTextPump = document.getElementById("modeTextPump");

    if (statePump) {
        statePump.textContent = mockData.pump ? "MENYALA" : "MATI";
        statePump.className = mockData.pump ? "state-text active" : "state-text";
    }
    if (togglePumpManual) togglePumpManual.checked = mockData.pump;
    if (togglePumpCard) togglePumpCard.checked = mockData.pump;
    if (iconBoxPump) {
        if (mockData.pump) {
            iconBoxPump.classList.add("active-glow");
        } else {
            iconBoxPump.classList.remove("active-glow");
        }
    }
    if (modeTextPump) {
        modeTextPump.textContent = mockData.pumpMode === "MANUAL" ? "Mode: Manual (Pengguna)" : "Mode: Otomatis (Sensor)";
    }

    // Grow Lamp
    const stateLamp = document.getElementById("stateLamp");
    const toggleLampManual = document.getElementById("toggleLampManual");
    const toggleLampCard = document.getElementById("toggleLampCard");
    const iconBoxLamp = document.getElementById("iconBoxLamp");
    const modeTextLamp = document.getElementById("modeTextLamp");

    if (stateLamp) {
        stateLamp.textContent = mockData.lamp ? "MENYALA" : "MATI";
        stateLamp.className = mockData.lamp ? "state-text active" : "state-text";
    }
    if (toggleLampManual) toggleLampManual.checked = mockData.lamp;
    if (toggleLampCard) toggleLampCard.checked = mockData.lamp;
    if (iconBoxLamp) {
        if (mockData.lamp) {
            iconBoxLamp.classList.add("active-glow-amber");
        } else {
            iconBoxLamp.classList.remove("active-glow-amber");
        }
    }
    if (modeTextLamp) {
        modeTextLamp.textContent = mockData.lampMode === "MANUAL" ? "Mode: Manual (Pengguna)" : "Mode: Otomatis (Sensor)";
    }

    // Buzzer
    const stateBuzzer = document.getElementById("stateBuzzer");
    const toggleBuzzerManual = document.getElementById("toggleBuzzerManual");
    if (stateBuzzer) {
        stateBuzzer.textContent = mockData.buzzer ? "MENYALA" : "MATI";
        stateBuzzer.className = mockData.buzzer ? "state-text active" : "state-text";
    }
    if (toggleBuzzerManual) toggleBuzzerManual.checked = mockData.buzzer;
}

function renderAutomationPanel() {
    const aSoilCurrent = document.getElementById("autoSoilCurrent");
    const aSoilPump = document.getElementById("autoSoilPumpStatus");
    const aLightStatus = document.getElementById("autoLightStatus");
    const aLightLamp = document.getElementById("autoLightLampStatus");
    const badgePumpMode = document.getElementById("badgePumpMode");
    const badgeLampMode = document.getElementById("badgeLampMode");
    const cardPump = document.getElementById("cardControlPump");
    const cardLamp = document.getElementById("cardControlLamp");

    if (aSoilCurrent) aSoilCurrent.textContent = `${Math.round(mockData.soilMoisture)} %`;
    if (aSoilPump) {
        aSoilPump.textContent = mockData.pump ? "MENYALA (ON)" : "MATI (OFF)";
        aSoilPump.className = `badge ${mockData.pump ? "badge-on" : "badge-off"}`;
    }

    if (badgePumpMode) {
        const isManual = mockData.pumpMode === "MANUAL";
        badgePumpMode.textContent = isManual ? "Mode: Manual (User Override)" : "Mode: Otomatis";
        badgePumpMode.className = `badge-mode-pill ${isManual ? "manual" : "auto"}`;
    }

    if (cardPump) {
        if (mockData.pump) cardPump.classList.add("device-active-pump");
        else cardPump.classList.remove("device-active-pump");
    }

    if (aLightStatus) aLightStatus.textContent = mockData.light;
    if (aLightLamp) {
        aLightLamp.textContent = mockData.lamp ? "MENYALA (ON)" : "MATI (OFF)";
        aLightLamp.className = `badge ${mockData.lamp ? "badge-on" : "badge-off"}`;
    }

    if (badgeLampMode) {
        const isManual = mockData.lampMode === "MANUAL";
        badgeLampMode.textContent = isManual ? "Mode: Manual (User Override)" : "Mode: Otomatis";
        badgeLampMode.className = `badge-mode-pill ${isManual ? "manual" : "auto"}`;
    }

    if (cardLamp) {
        if (mockData.lamp) cardLamp.classList.add("device-active-lamp");
        else cardLamp.classList.remove("device-active-lamp");
    }
}

/**
 * Update state Pompa Air secara terpusat
 */
function setPumpState(newState, mode = null, triggerToast = true) {
    mockData.pump = newState;
    if (mode) mockData.pumpMode = mode;

    renderActuators();
    renderAutomationPanel();

    if (triggerToast) {
        const statusText = newState ? "MENYALA (ON)" : "MATI (OFF)";
        const modeLabel = mockData.pumpMode === "MANUAL" ? "secara MANUAL" : "oleh SISTEM OTOMATIS";
        showToast(`🚰 Pompa Air ${statusText} ${modeLabel}`, newState ? "info" : "warning");
    }
}

/**
 * Update state Lampu Grow Light secara terpusat
 */
function setLampState(newState, mode = null, triggerToast = true) {
    mockData.lamp = newState;
    if (mode) mockData.lampMode = mode;

    renderActuators();
    renderAutomationPanel();

    if (triggerToast) {
        const statusText = newState ? "MENYALA (ON)" : "MATI (OFF)";
        const modeLabel = mockData.lampMode === "MANUAL" ? "secara MANUAL" : "oleh SISTEM OTOMATIS";
        showToast(`💡 Lampu Grow Light ${statusText} ${modeLabel}`, newState ? "info" : "warning");
    }
}

/**
 * Update state Buzzer
 */
function setBuzzerState(newState, triggerToast = true) {
    mockData.buzzer = newState;
    renderActuators();

    if (triggerToast) {
        showToast(`🔔 Alarm Buzzer ${newState ? "MENYALA" : "DIMATIKAN"}`, newState ? "warning" : "info");
    }
}

/**
 * System Notifikasi Toast mengambang yang bersih & mudah dipahami
 */
function showToast(message, type = "info") {
    const container = document.getElementById("toastContainer");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `toast-item toast-${type}`;
    
    let icon = "ℹ️";
    if (type === "warning") icon = "⚠️";
    if (type === "success") icon = "✅";

    toast.innerHTML = `
        <span class="toast-icon">${icon}</span>
        <span class="toast-text">${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add("show");
    }, 10);

    setTimeout(() => {
        toast.classList.remove("show");
        setTimeout(() => toast.remove(), 300);
    }, 3200);
}

function updateLastTimestamp() {
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0];

    const sysStatusTime = document.getElementById("sysStatusTime");
    const lastUpdateTime = document.getElementById("lastUpdateTime");

    if (sysStatusTime) sysStatusTime.textContent = timeStr;
    if (lastUpdateTime) lastUpdateTime.textContent = timeStr;
}

/* ==========================================================================
   8. ENVIRONMENT MONITORING CANVAS CHART
   ========================================================================== */
function initChart() {
    const canvas = document.getElementById("environmentChart");
    if (!canvas) return;

    const tabs = document.querySelectorAll(".chart-tab");
    tabs.forEach(tab => {
        tab.addEventListener("click", () => {
            tabs.forEach(t => t.classList.remove("active"));
            tab.classList.add("active");
            currentChartTab = tab.dataset.target;
            drawEnvironmentChart();
        });
    });

    window.addEventListener("resize", () => {
        drawEnvironmentChart();
    });

    drawEnvironmentChart();
}

function drawEnvironmentChart() {
    const canvas = document.getElementById("environmentChart");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    // Handle high DPI scaling
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    const width = rect.width;
    const height = rect.height;

    // Clear background
    ctx.clearRect(0, 0, width, height);

    const padding = { top: 25, right: 25, bottom: 35, left: 45 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    const dataPoints = currentChartTab === 'temp' ? chartHistory.tempData : chartHistory.soilData;
    const minVal = currentChartTab === 'temp' ? 20 : 0;
    const maxVal = currentChartTab === 'temp' ? 35 : 100;
    const unit = currentChartTab === 'temp' ? '°C' : '%';
    const lineColor = currentChartTab === 'temp' ? '#10b981' : '#38bdf8';
    const gradientTop = currentChartTab === 'temp' ? 'rgba(16, 185, 129, 0.35)' : 'rgba(56, 189, 248, 0.35)';

    // 1. Draw Horizontal Gridlines & Y-Axis Labels
    const steps = 4;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#6b7280';
    ctx.font = '11px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    for (let i = 0; i <= steps; i++) {
        const yVal = minVal + (maxVal - minVal) * (i / steps);
        const yPos = padding.top + chartH - (i / steps) * chartH;

        ctx.beginPath();
        ctx.moveTo(padding.left, yPos);
        ctx.lineTo(width - padding.right, yPos);
        ctx.stroke();

        ctx.fillText(`${yVal.toFixed(0)}${unit}`, padding.left - 8, yPos);
    }

    // 2. Draw X-Axis Time Labels
    const totalPoints = dataPoints.length;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    const stepX = chartW / (totalPoints - 1);
    for (let i = 0; i < totalPoints; i += 3) {
        const xPos = padding.left + i * stepX;
        ctx.fillText(chartHistory.labels[i], xPos, height - padding.bottom + 10);
    }

    // 3. Compute Coordinates for Line Chart
    const points = dataPoints.map((val, idx) => {
        const x = padding.left + idx * stepX;
        const normalized = (val - minVal) / (maxVal - minVal);
        const y = padding.top + chartH - normalized * chartH;
        return { x, y, val };
    });

    // 4. Draw Gradient Fill Under Line
    const fillGradient = ctx.createLinearGradient(0, padding.top, 0, height - padding.bottom);
    fillGradient.addColorStop(0, gradientTop);
    fillGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
        // Smooth cubic bezier curve
        const xc = (points[i].x + points[i - 1].x) / 2;
        const yc = (points[i].y + points[i - 1].y) / 2;
        ctx.quadraticCurveTo(points[i - 1].x, points[i - 1].y, xc, yc);
    }
    ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
    ctx.lineTo(points[points.length - 1].x, height - padding.bottom);
    ctx.lineTo(points[0].x, height - padding.bottom);
    ctx.closePath();
    ctx.fillStyle = fillGradient;
    ctx.fill();

    // 5. Draw Trend Line
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
        const xc = (points[i].x + points[i - 1].x) / 2;
        const yc = (points[i].y + points[i - 1].y) / 2;
        ctx.quadraticCurveTo(points[i - 1].x, points[i - 1].y, xc, yc);
    }
    ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // 6. Draw Data Points
    points.forEach((pt, idx) => {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, idx === points.length - 1 ? 5 : 3.5, 0, Math.PI * 2);
        ctx.fillStyle = lineColor;
        ctx.fill();

        if (idx === points.length - 1) {
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, 8, 0, Math.PI * 2);
            ctx.strokeStyle = lineColor;
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }
    });
}

/* ==========================================================================
   9. CAMERA MONITOR & RECENT CAPTURES SYSTEM
   ========================================================================== */
function initCameraModule() {
    const btnCapture = document.getElementById("btnCaptureImage");
    const btnClear = document.getElementById("btnClearRecent");

    if (btnCapture) btnCapture.addEventListener("click", captureImage);
    if (btnClear) btnClear.addEventListener("click", clearRecentCaptures);

    initModal();
}

/**
 * Capture Image Function:
 * 1. Simulates capture process with loading overlay (500–1000 ms)
 * 2. Generates dynamic high-res plant snapshot onto Canvas
 * 3. Saves to 3-photo memory array
 * 4. Renders Recent Captures gallery
 */
function captureImage() {
    const placeholder = document.getElementById("cameraPlaceholder");
    const canvas = document.getElementById("cameraCanvas");
    const loading = document.getElementById("cameraLoading");
    const btnCapture = document.getElementById("btnCaptureImage");

    if (!canvas || !loading) return;

    // 1. Show Loading State
    loading.classList.remove("hidden");
    if (btnCapture) btnCapture.disabled = true;

    const delay = Math.floor(Math.random() * 400) + 600; // 600ms to 1000ms

    setTimeout(() => {
        // 2. Hide placeholder & loading, show canvas
        if (placeholder) placeholder.classList.add("hidden");
        canvas.classList.remove("hidden");
        loading.classList.add("hidden");
        if (btnCapture) btnCapture.disabled = false;

        // 3. Render Plant Snapshot on Canvas
        renderSimulatedPlantCanvas(canvas);

        // 4. Extract Image Data & Add to Memory
        const dataUrl = canvas.toDataURL("image/png");
        const timestamp = new Date().toTimeString().split(' ')[0];

        addRecentCapture({
            id: Date.now(),
            image: dataUrl,
            timestamp: timestamp,
            temp: mockData.temperature,
            moisture: mockData.soilMoisture
        });

    }, delay);
}

/**
 * Draws a realistic Smart Farming greenhouse camera snapshot on Canvas
 */
function renderSimulatedPlantCanvas(canvas) {
    const ctx = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;

    // Background: Dark Greenhouse Environment
    const bgGrad = ctx.createLinearGradient(0, 0, w, h);
    bgGrad.addColorStop(0, '#0f172a');
    bgGrad.addColorStop(0.5, '#064e3b');
    bgGrad.addColorStop(1, '#022c22');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Draw Soil Pot Base
    ctx.fillStyle = '#1c1917';
    ctx.beginPath();
    ctx.ellipse(w / 2, h - 40, w / 3, 40, 0, 0, Math.PI * 2);
    ctx.fill();

    // Draw Plant Stem
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 12;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(w / 2, h - 40);
    ctx.quadraticCurveTo(w / 2 - 30, h / 2 + 20, w / 2, 90);
    ctx.stroke();

    // Draw Plant Leaves (Multiple overlapping leaves)
    const drawLeaf = (cx, cy, rx, ry, angle, color) => {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(angle * Math.PI / 180);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    };

    drawLeaf(w / 2 - 50, h / 2, 60, 25, -30, '#16a34a');
    drawLeaf(w / 2 + 55, h / 2 - 30, 70, 30, 25, '#22c55e');
    drawLeaf(w / 2 - 60, h / 2 - 70, 65, 25, -45, '#4ade80');
    drawLeaf(w / 2 + 45, h / 2 - 100, 55, 22, 35, '#15803d');
    drawLeaf(w / 2, 70, 45, 20, 0, '#86efac');

    // Draw Hydroponic / Tomato Fruit Accent
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(w / 2 + 30, h / 2 + 10, 16, 0, Math.PI * 2);
    ctx.arc(w / 2 - 25, h / 2 - 40, 14, 0, Math.PI * 2);
    ctx.fill();

    // Camera Telemetry Overlay Grid (HUD style)
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.4)';
    ctx.lineWidth = 1.5;

    // Corner brackets
    const bSize = 24;
    const margin = 20;

    // Top-Left
    ctx.beginPath(); ctx.moveTo(margin, margin + bSize); ctx.lineTo(margin, margin); ctx.lineTo(margin + bSize, margin); ctx.stroke();
    // Top-Right
    ctx.beginPath(); ctx.moveTo(w - margin - bSize, margin); ctx.lineTo(w - margin, margin); ctx.lineTo(w - margin, margin + bSize); ctx.stroke();
    // Bottom-Left
    ctx.beginPath(); ctx.moveTo(margin, h - margin - bSize); ctx.lineTo(margin, h - margin); ctx.lineTo(margin + bSize, h - margin); ctx.stroke();
    // Bottom-Right
    ctx.beginPath(); ctx.moveTo(w - margin - bSize, h - margin); ctx.lineTo(w - margin, h - margin); ctx.lineTo(w - margin, h - margin - bSize); ctx.stroke();

    // HUD Metadata Overlay text
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.fillRect(margin + 10, margin + 10, 220, 55);
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.5)';
    ctx.strokeRect(margin + 10, margin + 10, 220, 55);

    ctx.fillStyle = '#34d399';
    ctx.font = '12px "JetBrains Mono", monospace';
    ctx.fillText(`CAM: ESP32-CAM [1080p]`, margin + 20, margin + 28);
    ctx.fillText(`TIME: ${new Date().toTimeString().split(' ')[0]}`, margin + 20, margin + 44);
    ctx.fillText(`TEMP: ${mockData.temperature}°C  SOIL: ${mockData.soilMoisture}%`, margin + 20, margin + 58);
}

/**
 * Adds captured image to in-memory FIFO array (Max 3 photos)
 * When 4th photo arrives, oldest photo is dropped!
 * @param {Object} captureObj 
 */
function addRecentCapture(captureObj) {
    recentCaptures.unshift(captureObj); // Push new capture to front

    if (recentCaptures.length > 3) {
        recentCaptures.pop(); // Remove oldest photo (4th)
    }

    renderRecentCaptures();
}

/**
 * Render up to 3 recent photos in the gallery
 */
function renderRecentCaptures() {
    const gallery = document.getElementById("recentGallery");
    if (!gallery) return;

    if (recentCaptures.length === 0) {
        gallery.innerHTML = `
            <div class="gallery-empty">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                <p>Belum ada foto tersimpan dalam memory</p>
            </div>
        `;
        return;
    }

    gallery.innerHTML = recentCaptures.map((cap, index) => `
        <div class="gallery-item" data-index="${index}">
            <div class="gallery-img-wrap">
                <img src="${cap.image}" alt="Plant Capture ${cap.timestamp}">
                <span class="gallery-badge">#${index + 1}</span>
            </div>
            <div class="gallery-info">
                <span class="gallery-time">${cap.timestamp}</span>
                <span class="gallery-meta">${cap.temp}°C • Moisture ${cap.moisture}%</span>
            </div>
        </div>
    `).join('');

    // Attach click listeners to gallery items for Modal preview
    const items = gallery.querySelectorAll(".gallery-item");
    items.forEach(item => {
        item.addEventListener("click", () => {
            const idx = parseInt(item.dataset.index);
            openModal(recentCaptures[idx]);
        });
    });
}

/**
 * Clear in-memory photo gallery
 */
function clearRecentCaptures() {
    recentCaptures = [];
    renderRecentCaptures();
}

/* ==========================================================================
   10. IMAGE PREVIEW MODAL
   ========================================================================== */
function initModal() {
    const modal = document.getElementById("imageModal");
    const closeBtn = document.getElementById("modalClose");

    if (closeBtn) {
        closeBtn.addEventListener("click", () => {
            modal.classList.add("hidden");
        });
    }

    if (modal) {
        modal.addEventListener("click", (e) => {
            if (e.target === modal) modal.classList.add("hidden");
        });
    }
}

function openModal(capture) {
    const modal = document.getElementById("imageModal");
    const img = document.getElementById("modalImage");
    const timeStr = document.getElementById("modalTimestamp");
    const metaStr = document.getElementById("modalMeta");

    if (modal && img) {
        img.src = capture.image;
        if (timeStr) timeStr.textContent = `Timestamp: ${capture.timestamp}`;
        if (metaStr) metaStr.textContent = `Camera: ESP32-CAM • Temp: ${capture.temp}°C • Moisture: ${capture.moisture}%`;
        modal.classList.remove("hidden");
    }
}

/* ==========================================================================
   11. SIMULATION TICK & UI DEMO CONTROLS
   ========================================================================== */
function initSimulationControls() {
    const btnSimulate = document.getElementById("btnSimulateTick");
    const toggleAuto = document.getElementById("toggleGlobalAuto");
    const badgeAuto = document.getElementById("badgeGlobalAuto");

    if (btnSimulate) {
        btnSimulate.addEventListener("click", () => {
            // Generate minor natural random fluctuations
            const newTemp = +(mockData.temperature + (Math.random() * 0.6 - 0.3)).toFixed(1);
            const newHum = +(mockData.humidity + (Math.random() * 2 - 1)).toFixed(1);
            const newSoil = Math.max(20, Math.min(90, Math.round(mockData.soilMoisture + (Math.random() * 4 - 2))));

            updateSensorData({
                temperature: newTemp,
                humidity: newHum,
                soilMoisture: newSoil
            });

            // Logic otomatis jika mode pompa dalam keadaan AUTO
            if (mockData.pumpMode === "AUTO") {
                const autoPumpState = newSoil < 35;
                setPumpState(autoPumpState, "AUTO", false);
            }

            // Append to chart history
            const nowTime = new Date().toTimeString().substring(0, 5);
            chartHistory.labels.shift();
            chartHistory.labels.push(nowTime);
            chartHistory.tempData.shift();
            chartHistory.tempData.push(newTemp);
            chartHistory.soilData.shift();
            chartHistory.soilData.push(newSoil);

            drawEnvironmentChart();
        });
    }

    if (toggleAuto && badgeAuto) {
        toggleAuto.addEventListener("change", (e) => {
            const isChecked = e.target.checked;
            mockData.isAutoMode = isChecked;
            
            badgeAuto.textContent = isChecked ? "AKTIF" : "NONAKTIF";
            badgeAuto.style.color = isChecked ? "var(--accent-green)" : "var(--text-muted)";

            if (isChecked) {
                mockData.pumpMode = "AUTO";
                mockData.lampMode = "AUTO";
                // Recheck auto logic
                if (mockData.soilMoisture < 35) setPumpState(true, "AUTO", false);
                else setPumpState(false, "AUTO", false);

                showToast("🤖 Mode Otomatis Global Diaktifkan", "success");
            } else {
                mockData.pumpMode = "MANUAL";
                mockData.lampMode = "MANUAL";
                showToast("🖐️ Mode Manual Global Diaktifkan", "info");
            }

            renderActuators();
            renderAutomationPanel();
        });
    }
}

/* ==========================================================================
   12. KONTROL MANUAL PERANGKAT (LAMPU & POMPA AIR)
   ========================================================================== */
let quickWaterTimer = null;

function initManualControls() {
    const togglePumpManual = document.getElementById("togglePumpManual");
    const togglePumpCard = document.getElementById("togglePumpCard");
    const toggleLampManual = document.getElementById("toggleLampManual");
    const toggleLampCard = document.getElementById("toggleLampCard");
    const toggleBuzzerManual = document.getElementById("toggleBuzzerManual");
    const btnQuickWater = document.getElementById("btnQuickWater");
    const btnToggleLamp = document.getElementById("btnToggleLamp");

    // 1. Sakelar Manual Pompa Air
    if (togglePumpManual) {
        togglePumpManual.addEventListener("change", (e) => {
            setPumpState(e.target.checked, "MANUAL");
        });
    }

    if (togglePumpCard) {
        togglePumpCard.addEventListener("change", (e) => {
            setPumpState(e.target.checked, "MANUAL");
        });
    }

    // 2. Sakelar Manual Lampu Grow Light
    if (toggleLampManual) {
        toggleLampManual.addEventListener("change", (e) => {
            setLampState(e.target.checked, "MANUAL");
        });
    }

    if (toggleLampCard) {
        toggleLampCard.addEventListener("change", (e) => {
            setLampState(e.target.checked, "MANUAL");
        });
    }

    // 3. Tombol Aksi Cepat Lampu Toggle
    if (btnToggleLamp) {
        btnToggleLamp.addEventListener("click", () => {
            setLampState(!mockData.lamp, "MANUAL");
        });
    }

    // 4. Sakelar Manual Alarm Buzzer
    if (toggleBuzzerManual) {
        toggleBuzzerManual.addEventListener("change", (e) => {
            setBuzzerState(e.target.checked);
        });
    }

    // 5. Tombol Aksi Cepat: Siram Cepat 5 Detik
    if (btnQuickWater) {
        const labelQuick = document.getElementById("labelQuickWater");

        btnQuickWater.addEventListener("click", () => {
            if (quickWaterTimer) {
                // Hentikan penyiraman aktif
                clearInterval(quickWaterTimer);
                quickWaterTimer = null;
                setPumpState(false, "MANUAL", false);
                if (labelQuick) labelQuick.textContent = "💦 Siram Cepat (5 Detik)";
                showToast("⏹️ Penyiraman manual dihentikan.", "info");
                return;
            }

            let countdown = 5;
            setPumpState(true, "MANUAL", false);
            showToast("💦 Siram Cepat 5 Detik dimulai...", "info");
            if (labelQuick) labelQuick.textContent = `⏳ Menyiram... (${countdown}s)`;

            quickWaterTimer = setInterval(() => {
                countdown--;
                if (countdown > 0) {
                    if (labelQuick) labelQuick.textContent = `⏳ Menyiram... (${countdown}s)`;
                } else {
                    clearInterval(quickWaterTimer);
                    quickWaterTimer = null;
                    setPumpState(false, "MANUAL", false);
                    if (labelQuick) labelQuick.textContent = "💦 Siram Cepat (5 Detik)";
                    showToast("✅ Penyiraman manual 5 detik telah selesai!", "success");
                }
            }, 1000);
        });
    }
}
