/* ==========================================================================
   SMART FARMING IOT DASHBOARD - FULL MQTT INTEGRATION
   ========================================================================== */

// ==================== MQTT CONFIGURATION ====================
const MQTT_CONFIG = {
    // Untuk HiveMQ Cloud dengan WebSocket Secure
    broker: 'wss://broker.hivemq.com:8884/mqtt',
    // Atau jika pakai HiveMQ Cloud berbayar:
    // broker: 'wss://YOUR_CLUSTER.s1.eu.hivemq.cloud:8884/mqtt',
    // username: 'YOUR_USERNAME',
    // password: 'YOUR_PASSWORD',
    
    topics: {
        // Sensor Topics
        temperature: 'smartfarm/sensor/temperature',
        humidity: 'smartfarm/sensor/humidity',
        soilMoisture: 'smartfarm/sensor/soil_moisture',
        waterLevel: 'smartfarm/sensor/water_level',
        light: 'smartfarm/sensor/light',
        
        // Actuator Topics
        pump: 'smartfarm/actuator/pump',
        lamp: 'smartfarm/actuator/lamp',
        buzzer: 'smartfarm/actuator/buzzer',
        
        // Control Topics
        controlPump: 'smartfarm/control/pump',
        controlLamp: 'smartfarm/control/lamp',
        controlBuzzer: 'smartfarm/control/buzzer',
        controlAuto: 'smartfarm/control/auto_mode',
        
        // Status Topic
        status: 'smartfarm/status/esp32',
        cameraCapture: 'smartfarm/camera/capture'
    }
};

// ==================== STATE ====================
const state = {
    // Sensor Data
    temperature: null,
    humidity: null,
    soilMoisture: null,
    waterLevel: null,
    light: '--',
    
    // Actuator States
    pump: false,
    lamp: false,
    buzzer: false,
    
    // System
    systemStatus: 'OFFLINE',
    autoMode: true,
    uptime: 0,
    waterUsed: 0,
    
    // MQTT
    connected: false,
    lastUpdate: null,
    messageCount: 0,
    
    // Chart History
    chartLabels: [],
    chartTempData: [],
    chartSoilData: [],
    maxChartPoints: 20
};

// ==================== DOM REFERENCES ====================
const DOM = {
    // System Status
    sysStatusDot: document.getElementById('sysStatusDot'),
    sysStatusText: document.getElementById('sysStatusText'),
    sysStatusSub: document.getElementById('sysStatusSub'),
    sysStatusBadge: document.getElementById('sysStatusBadge'),
    sysStatusTime: document.getElementById('sysStatusTime'),
    headerSystemStatus: document.getElementById('headerSystemStatus'),
    headerStatusDot: document.getElementById('headerStatusDot'),
    headerStatusPill: document.getElementById('headerStatusPill'),
    lastUpdateTime: document.getElementById('lastUpdateTime'),
    
    // Sidebar
    sidebarStatusDot: document.getElementById('sidebarStatusDot'),
    sidebarStatusTitle: document.getElementById('sidebarStatusTitle'),
    sidebarStatusSub: document.getElementById('sidebarStatusSub'),
    
    // Sensor Cards
    valTemperature: document.getElementById('valTemperature'),
    statusTemperature: document.getElementById('statusTemperature'),
    tempTrendText: document.getElementById('tempTrendText'),
    
    valHumidity: document.getElementById('valHumidity'),
    statusHumidity: document.getElementById('statusHumidity'),
    humidityTrendText: document.getElementById('humidityTrendText'),
    
    valSoilMoisture: document.getElementById('valSoilMoisture'),
    barSoilMoisture: document.getElementById('barSoilMoisture'),
    statusSoilMoisture: document.getElementById('statusSoilMoisture'),
    
    valWaterLevel: document.getElementById('valWaterLevel'),
    barWaterLevel: document.getElementById('barWaterLevel'),
    statusWaterLevel: document.getElementById('statusWaterLevel'),
    
    // Environment Summary
    envTemp: document.getElementById('envTemp'),
    envHumidity: document.getElementById('envHumidity'),
    envLight: document.getElementById('envLight'),
    envSoil: document.getElementById('envSoil'),
    envWater: document.getElementById('envWater'),
    
    // Actuators
    statePump: document.getElementById('statePump'),
    stateLamp: document.getElementById('stateLamp'),
    stateBuzzer: document.getElementById('stateBuzzer'),
    stateSystem: document.getElementById('stateSystem'),
    dotSystem: document.getElementById('dotSystem'),
    systemMCUStatus: document.getElementById('systemMCUStatus'),
    
    togglePumpManual: document.getElementById('togglePumpManual'),
    toggleLampManual: document.getElementById('toggleLampManual'),
    toggleBuzzerManual: document.getElementById('toggleBuzzerManual'),
    togglePumpCard: document.getElementById('togglePumpCard'),
    toggleLampCard: document.getElementById('toggleLampCard'),
    
    modeTextPump: document.getElementById('modeTextPump'),
    modeTextLamp: document.getElementById('modeTextLamp'),
    modeTextBuzzer: document.getElementById('modeTextBuzzer'),
    
    iconBoxPump: document.getElementById('iconBoxPump'),
    iconBoxLamp: document.getElementById('iconBoxLamp'),
    iconBoxBuzzer: document.getElementById('iconBoxBuzzer'),
    
    // Automation Panel
    toggleGlobalAuto: document.getElementById('toggleGlobalAuto'),
    badgeGlobalAuto: document.getElementById('badgeGlobalAuto'),
    badgePumpMode: document.getElementById('badgePumpMode'),
    badgeLampMode: document.getElementById('badgeLampMode'),
    autoSoilCurrent: document.getElementById('autoSoilCurrent'),
    autoSoilPumpStatus: document.getElementById('autoSoilPumpStatus'),
    autoLightStatus: document.getElementById('autoLightStatus'),
    autoLightLampStatus: document.getElementById('autoLightLampStatus'),
    cardControlPump: document.getElementById('cardControlPump'),
    cardControlLamp: document.getElementById('cardControlLamp'),
    
    // Quick Actions
    btnQuickWater: document.getElementById('btnQuickWater'),
    labelQuickWater: document.getElementById('labelQuickWater'),
    btnToggleLamp: document.getElementById('btnToggleLamp'),
    labelToggleLamp: document.getElementById('labelToggleLamp'),
    
    // Camera
    btnCaptureImage: document.getElementById('btnCaptureImage'),
    cameraCanvas: document.getElementById('cameraCanvas'),
    cameraPlaceholder: document.getElementById('cameraPlaceholder'),
    cameraLoading: document.getElementById('cameraLoading'),
    recentGallery: document.getElementById('recentGallery'),
    galleryEmpty: document.getElementById('galleryEmpty'),
    btnClearRecent: document.getElementById('btnClearRecent'),
    cameraStatusBadge: document.getElementById('cameraStatusBadge'),
    cameraMetaStatus: document.getElementById('cameraMetaStatus'),
    
    // Modal
    imageModal: document.getElementById('imageModal'),
    modalImage: document.getElementById('modalImage'),
    modalTimestamp: document.getElementById('modalTimestamp'),
    modalMeta: document.getElementById('modalMeta'),
    modalClose: document.getElementById('modalClose'),
    
    // Toast
    toastContainer: document.getElementById('toastContainer'),
    
    // Buttons
    btnReconnectMQTT: document.getElementById('btnReconnectMQTT')
};

// ==================== MQTT CLIENT ====================
let mqttClient = null;
let quickWaterTimer = null;
let chartInstance = null;
let recentCaptures = [];

// ==================== INIT ====================
document.addEventListener('DOMContentLoaded', () => {
    console.log('🌱 Smart Farming Dashboard v2.0');
    console.log('📡 MQTT Broker:', MQTT_CONFIG.broker);
    console.log('📋 Topics:', MQTT_CONFIG.topics);
    
    initNavigation();
    initChart();
    initMQTT();
    initManualControls();
    initCameraModule();
    initReconnectButton();
    updateLastTimestamp();
    
    // Set default mode
    DOM.toggleGlobalAuto.checked = true;
    state.autoMode = true;
});

// ==================== NAVIGATION ====================
function initNavigation() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    const toggleBtn = document.getElementById('mobileToggleBtn');
    const closeBtn = document.getElementById('mobileCloseBtn');

    function openSidebar() {
        sidebar.classList.add('open');
        overlay.classList.add('active');
    }

    function closeSidebar() {
        sidebar.classList.remove('open');
        overlay.classList.remove('active');
    }

    if (toggleBtn) toggleBtn.addEventListener('click', openSidebar);
    if (closeBtn) closeBtn.addEventListener('click', closeSidebar);
    if (overlay) overlay.addEventListener('click', closeSidebar);

    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            navItems.forEach(n => n.classList.remove('active'));
            item.classList.add('active');
            if (window.innerWidth <= 992) {
                closeSidebar();
            }
        });
    });
}

// ==================== MQTT ====================
function initMQTT() {
    try {
        const clientId = 'dashboard_' + Math.random().toString(16).substr(2, 8);
        
        // Build connection options
        const options = {
            clientId: clientId,
            clean: true,
            reconnectPeriod: 3000,
            keepAlive: 60
        };
        
        // Add credentials if provided
        if (MQTT_CONFIG.username && MQTT_CONFIG.password) {
            options.username = MQTT_CONFIG.username;
            options.password = MQTT_CONFIG.password;
        }
        
        mqttClient = mqtt.connect(MQTT_CONFIG.broker, options);
        
        mqttClient.on('connect', () => {
            console.log('✅ MQTT Connected');
            state.connected = true;
            updateConnectionUI('connected', 'MQTT Connected', 'Online');
            showToast('MQTT Connected successfully!', 'success');
            
            // Subscribe to all topics
            const topics = Object.values(MQTT_CONFIG.topics);
            topics.forEach(topic => {
                mqttClient.subscribe(topic, { qos: 1 }, (err) => {
                    if (!err) {
                        console.log('✅ Subscribed to:', topic);
                    } else {
                        console.error('❌ Subscribe error:', topic, err);
                    }
                });
            });
            
            // Request status update
            setTimeout(() => {
                showToast('📡 Waiting for sensor data...', 'info');
            }, 1000);
        });

        mqttClient.on('message', (topic, message) => {
            const payload = message.toString();
            console.log('📥', topic, '->', payload);
            handleMQTTMessage(topic, payload);
        });

        mqttClient.on('error', (err) => {
            console.error('❌ MQTT Error:', err);
            state.connected = false;
            updateConnectionUI('disconnected', 'MQTT Error', 'Offline');
            showToast('MQTT Error: ' + err.message, 'warning');
        });

        mqttClient.on('offline', () => {
            console.log('⚠️ MQTT Offline');
            state.connected = false;
            updateConnectionUI('disconnected', 'MQTT Offline', 'Offline');
        });

        mqttClient.on('reconnect', () => {
            console.log('🔄 MQTT Reconnecting...');
            updateConnectionUI('connecting', 'Reconnecting...', 'Connecting');
        });

    } catch (e) {
        console.error('❌ MQTT Init error:', e);
        showToast('MQTT Init error: ' + e.message, 'error');
    }
}

function handleMQTTMessage(topic, payload) {
    const topics = MQTT_CONFIG.topics;
    
    // Update last update time
    state.lastUpdate = new Date();
    updateLastTimestamp();
    state.messageCount++;
    
    // Parse JSON for status topic
    if (topic === topics.status) {
        try {
            const data = JSON.parse(payload);
            console.log('📊 Status JSON:', data);
            
            // Update state from JSON
            if (data.temperature !== undefined) state.temperature = data.temperature;
            if (data.humidity !== undefined) state.humidity = data.humidity;
            if (data.soil_moisture !== undefined) state.soilMoisture = data.soil_moisture;
            if (data.water_level !== undefined) state.waterLevel = data.water_level;
            if (data.light !== undefined) state.light = data.light;
            if (data.pump !== undefined) state.pump = data.pump === 'ON';
            if (data.lamp !== undefined) state.lamp = data.lamp === 'ON';
            if (data.buzzer !== undefined) state.buzzer = data.buzzer === 'ON';
            if (data.mode !== undefined) state.autoMode = data.mode === 'AUTO';
            if (data.status !== undefined) state.systemStatus = data.status;
            if (data.uptime !== undefined) state.uptime = data.uptime;
            if (data.water_used !== undefined) state.waterUsed = data.water_used;
            
            // Update UI
            renderAll();
            return;
        } catch (e) {
            console.warn('⚠️ Failed to parse status JSON:', e);
        }
    }
    
    // Handle individual sensor topics
    if (topic === topics.temperature) {
        state.temperature = parseFloat(payload);
        updateChartData(state.temperature, null);
    }
    else if (topic === topics.humidity) {
        state.humidity = parseFloat(payload);
    }
    else if (topic === topics.soilMoisture) {
        state.soilMoisture = parseInt(payload);
        updateChartData(null, state.soilMoisture);
    }
    else if (topic === topics.waterLevel) {
        state.waterLevel = parseInt(payload);
    }
    else if (topic === topics.light) {
        state.light = payload;
    }
    else if (topic === topics.pump) {
        state.pump = payload === 'ON';
        syncPumpToggle();
    }
    else if (topic === topics.lamp) {
        state.lamp = payload === 'ON';
        syncLampToggle();
    }
    else if (topic === topics.buzzer) {
        state.buzzer = payload === 'ON';
    }
    
    // Render UI
    renderAll();
}

function publishControl(topic, value) {
    if (!state.connected || !mqttClient) {
        showToast('MQTT not connected!', 'warning');
        return false;
    }
    
    try {
        mqttClient.publish(topic, value, { qos: 1 });
        console.log('📤', topic, '->', value);
        return true;
    } catch (e) {
        console.error('❌ Publish error:', e);
        showToast('Failed to publish: ' + e.message, 'error');
        return false;
    }
}

// ==================== UI UPDATE FUNCTIONS ====================
function renderAll() {
    renderSystemStatus();
    renderSensorCards();
    renderEnvironmentSummary();
    renderActuators();
    renderAutomationPanel();
}

function updateConnectionUI(status, title, sub) {
    const dot = DOM.sidebarStatusDot;
    const titleEl = DOM.sidebarStatusTitle;
    const subEl = DOM.sidebarStatusSub;
    
    if (dot) {
        dot.className = 'status-indicator ' + 
            (status === 'connected' ? 'online' : 
             status === 'connecting' ? 'connecting' : 'offline');
    }
    if (titleEl) titleEl.textContent = title;
    if (subEl) subEl.textContent = sub;
}

function renderSystemStatus() {
    const isOnline = state.systemStatus === 'ONLINE' || state.systemStatus === 'NORMAL';
    
    // System Status Card
    if (DOM.sysStatusDot) {
        DOM.sysStatusDot.className = `status-dot-lg ${isOnline ? 'online' : 'offline'}`;
    }
    if (DOM.sysStatusText) {
        DOM.sysStatusText.textContent = isOnline ? 'ONLINE' : 'OFFLINE';
        DOM.sysStatusText.style.color = isOnline ? 'var(--accent-green)' : 'var(--accent-red)';
    }
    if (DOM.sysStatusSub) {
        DOM.sysStatusSub.textContent = isOnline ? 'All systems operating normally' : 'Connection lost with MCU';
    }
    if (DOM.sysStatusBadge) {
        DOM.sysStatusBadge.textContent = isOnline ? 'NORMAL' : 'ALERT';
        DOM.sysStatusBadge.className = `badge ${isOnline ? 'badge-success' : 'badge-off'}`;
    }
    
    // Header Status
    if (DOM.headerSystemStatus) {
        DOM.headerSystemStatus.textContent = `SYSTEM ${isOnline ? 'ONLINE' : 'OFFLINE'}`;
    }
    if (DOM.headerStatusPill) {
        DOM.headerStatusPill.className = `status-pill ${isOnline ? 'online' : 'offline'}`;
    }
    
    // Dot System
    if (DOM.dotSystem) {
        DOM.dotSystem.className = `state-dot ${isOnline ? 'on' : 'off'}`;
    }
    if (DOM.stateSystem) {
        DOM.stateSystem.textContent = isOnline ? 'NORMAL' : 'OFFLINE';
        DOM.stateSystem.className = `state-text ${isOnline ? 'active' : ''}`;
    }
    if (DOM.systemMCUStatus) {
        DOM.systemMCUStatus.textContent = isOnline ? 'ESP32 Status OK' : 'ESP32 Offline';
    }
}

function renderSensorCards() {
    // Temperature
    if (DOM.valTemperature) {
        DOM.valTemperature.textContent = state.temperature !== null ? state.temperature.toFixed(1) : '--';
    }
    if (DOM.statusTemperature) {
        const temp = state.temperature;
        if (temp === null) {
            DOM.statusTemperature.textContent = '--';
            DOM.statusTemperature.className = 'badge badge-off';
        } else if (temp > 32) {
            DOM.statusTemperature.textContent = 'High Temp';
            DOM.statusTemperature.className = 'badge badge-off';
            DOM.statusTemperature.style.borderColor = 'var(--accent-amber)';
            DOM.statusTemperature.style.color = 'var(--accent-amber)';
        } else if (temp < 20) {
            DOM.statusTemperature.textContent = 'Low Temp';
            DOM.statusTemperature.className = 'badge badge-off';
            DOM.statusTemperature.style.borderColor = 'var(--accent-blue)';
            DOM.statusTemperature.style.color = 'var(--accent-blue)';
        } else {
            DOM.statusTemperature.textContent = 'Normal';
            DOM.statusTemperature.className = 'badge badge-outline-success';
            DOM.statusTemperature.style.borderColor = '';
            DOM.statusTemperature.style.color = '';
        }
    }
    
    // Humidity
    if (DOM.valHumidity) {
        DOM.valHumidity.textContent = state.humidity !== null ? Math.round(state.humidity) : '--';
    }
    
    // Soil Moisture
    if (DOM.valSoilMoisture) {
        DOM.valSoilMoisture.textContent = state.soilMoisture !== null ? Math.round(state.soilMoisture) : '--';
    }
    if (DOM.barSoilMoisture) {
        const val = state.soilMoisture !== null ? Math.min(100, Math.max(0, state.soilMoisture)) : 0;
        DOM.barSoilMoisture.style.width = `${val}%`;
    }
    if (DOM.statusSoilMoisture) {
        const val = state.soilMoisture;
        if (val === null) {
            DOM.statusSoilMoisture.textContent = '--';
        } else if (val < 30) {
            DOM.statusSoilMoisture.textContent = 'Moisture Level: Dry (Watering Needed)';
            DOM.statusSoilMoisture.style.color = 'var(--accent-amber)';
        } else if (val > 80) {
            DOM.statusSoilMoisture.textContent = 'Moisture Level: Wet';
            DOM.statusSoilMoisture.style.color = 'var(--accent-blue)';
        } else {
            DOM.statusSoilMoisture.textContent = 'Moisture Level: Good';
            DOM.statusSoilMoisture.style.color = 'var(--text-muted)';
        }
    }
    
    // Water Level
    if (DOM.valWaterLevel) {
        DOM.valWaterLevel.textContent = state.waterLevel !== null ? Math.round(state.waterLevel) : '--';
    }
    if (DOM.barWaterLevel) {
        const val = state.waterLevel !== null ? Math.min(100, Math.max(0, state.waterLevel)) : 0;
        DOM.barWaterLevel.style.width = `${val}%`;
    }
    if (DOM.statusWaterLevel) {
        const val = state.waterLevel;
        if (val === null) {
            DOM.statusWaterLevel.textContent = '--';
        } else if (val < 20) {
            DOM.statusWaterLevel.textContent = 'Water Level: Low Alert!';
            DOM.statusWaterLevel.style.color = 'var(--accent-red)';
        } else {
            DOM.statusWaterLevel.textContent = 'Water Level: Good';
            DOM.statusWaterLevel.style.color = 'var(--text-muted)';
        }
    }
}

function renderEnvironmentSummary() {
    if (DOM.envTemp) {
        DOM.envTemp.textContent = state.temperature !== null ? `${state.temperature.toFixed(1)} °C` : '-- °C';
    }
    if (DOM.envHumidity) {
        DOM.envHumidity.textContent = state.humidity !== null ? `${Math.round(state.humidity)} %` : '-- %';
    }
    if (DOM.envLight) {
        DOM.envLight.textContent = state.light || '--';
    }
    if (DOM.envSoil) {
        DOM.envSoil.textContent = state.soilMoisture !== null ? `${Math.round(state.soilMoisture)} %` : '-- %';
    }
    if (DOM.envWater) {
        DOM.envWater.textContent = state.waterLevel !== null ? `${Math.round(state.waterLevel)} %` : '-- %';
    }
}

function renderActuators() {
    // Pump
    if (DOM.statePump) {
        DOM.statePump.textContent = state.pump ? 'MENYALA' : 'MATI';
        DOM.statePump.className = state.pump ? 'state-text active' : 'state-text';
    }
    syncPumpToggle();
    
    if (DOM.iconBoxPump) {
        DOM.iconBoxPump.classList.toggle('active-glow', state.pump);
    }
    if (DOM.modeTextPump) {
        DOM.modeTextPump.textContent = state.autoMode ? 'Mode: Otomatis' : 'Mode: Manual (Pengguna)';
    }
    
    // Lamp
    if (DOM.stateLamp) {
        DOM.stateLamp.textContent = state.lamp ? 'MENYALA' : 'MATI';
        DOM.stateLamp.className = state.lamp ? 'state-text active' : 'state-text';
    }
    syncLampToggle();
    
    if (DOM.iconBoxLamp) {
        DOM.iconBoxLamp.classList.toggle('active-glow-amber', state.lamp);
    }
    if (DOM.modeTextLamp) {
        DOM.modeTextLamp.textContent = state.autoMode ? 'Mode: Otomatis' : 'Mode: Manual (Pengguna)';
    }
    
    // Buzzer
    if (DOM.stateBuzzer) {
        DOM.stateBuzzer.textContent = state.buzzer ? 'MENYALA' : 'MATI';
        DOM.stateBuzzer.className = state.buzzer ? 'state-text active' : 'state-text';
    }
    if (DOM.toggleBuzzerManual) {
        DOM.toggleBuzzerManual.checked = state.buzzer;
    }
    if (DOM.iconBoxBuzzer) {
        DOM.iconBoxBuzzer.classList.toggle('active-glow', state.buzzer);
    }
}

function renderAutomationPanel() {
    // Auto Mode
    if (DOM.toggleGlobalAuto) {
        DOM.toggleGlobalAuto.checked = state.autoMode;
    }
    if (DOM.badgeGlobalAuto) {
        DOM.badgeGlobalAuto.textContent = state.autoMode ? 'AKTIF' : 'NONAKTIF';
        DOM.badgeGlobalAuto.style.color = state.autoMode ? 'var(--accent-green)' : 'var(--text-muted)';
    }
    
    // Pump Mode Badge
    if (DOM.badgePumpMode) {
        DOM.badgePumpMode.textContent = state.autoMode ? 'Mode: Otomatis' : 'Mode: Manual (User Override)';
        DOM.badgePumpMode.className = `badge-mode-pill ${state.autoMode ? 'auto' : 'manual'}`;
    }
    
    // Lamp Mode Badge
    if (DOM.badgeLampMode) {
        DOM.badgeLampMode.textContent = state.autoMode ? 'Mode: Otomatis' : 'Mode: Manual (User Override)';
        DOM.badgeLampMode.className = `badge-mode-pill ${state.autoMode ? 'auto' : 'manual'}`;
    }
    
    // Auto Metrics
    if (DOM.autoSoilCurrent) {
        DOM.autoSoilCurrent.textContent = state.soilMoisture !== null ? `${Math.round(state.soilMoisture)} %` : '-- %';
    }
    if (DOM.autoSoilPumpStatus) {
        DOM.autoSoilPumpStatus.textContent = state.pump ? 'MENYALA (ON)' : 'MATI (OFF)';
        DOM.autoSoilPumpStatus.className = `badge ${state.pump ? 'badge-on' : 'badge-off'}`;
    }
    if (DOM.autoLightStatus) {
        DOM.autoLightStatus.textContent = state.light || '--';
    }
    if (DOM.autoLightLampStatus) {
        DOM.autoLightLampStatus.textContent = state.lamp ? 'MENYALA (ON)' : 'MATI (OFF)';
        DOM.autoLightLampStatus.className = `badge ${state.lamp ? 'badge-on' : 'badge-off'}`;
    }
    
    // Card Highlight
    if (DOM.cardControlPump) {
        DOM.cardControlPump.classList.toggle('device-active-pump', state.pump);
    }
    if (DOM.cardControlLamp) {
        DOM.cardControlLamp.classList.toggle('device-active-lamp', state.lamp);
    }
}

function syncPumpToggle() {
    if (DOM.togglePumpManual) DOM.togglePumpManual.checked = state.pump;
    if (DOM.togglePumpCard) DOM.togglePumpCard.checked = state.pump;
}

function syncLampToggle() {
    if (DOM.toggleLampManual) DOM.toggleLampManual.checked = state.lamp;
    if (DOM.toggleLampCard) DOM.toggleLampCard.checked = state.lamp;
}

function updateLastTimestamp() {
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0];
    
    if (DOM.sysStatusTime) DOM.sysStatusTime.textContent = timeStr;
    if (DOM.lastUpdateTime) DOM.lastUpdateTime.textContent = timeStr;
}

// ==================== CHART ====================
function initChart() {
    const canvas = document.getElementById('environmentChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    
    // Initialize with empty data
    const initialLabels = Array(20).fill('--');
    const initialData = Array(20).fill(0);
    
    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: initialLabels,
            datasets: [{
                label: 'Temperature (°C)',
                data: initialData,
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                fill: true,
                tension: 0.4,
                borderWidth: 2,
                pointRadius: 3,
                pointBackgroundColor: '#10b981',
                pointHoverRadius: 5
            }, {
                label: 'Soil Moisture (%)',
                data: initialData,
                borderColor: '#38bdf8',
                backgroundColor: 'rgba(56, 189, 248, 0.15)',
                fill: true,
                tension: 0.4,
                borderWidth: 2,
                pointRadius: 3,
                pointBackgroundColor: '#38bdf8',
                pointHoverRadius: 5,
                hidden: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        color: '#9ca3af',
                        font: {
                            family: "'JetBrains Mono', monospace",
                            size: 11
                        }
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(17, 24, 39, 0.9)',
                    titleColor: '#f3f4f6',
                    bodyColor: '#9ca3af',
                    borderColor: 'rgba(255,255,255,0.1)',
                    borderWidth: 1,
                    padding: 10,
                    cornerRadius: 8
                }
            },
            scales: {
                x: {
                    grid: {
                        color: 'rgba(255,255,255,0.05)'
                    },
                    ticks: {
                        color: '#6b7280',
                        maxTicksLimit: 10,
                        font: {
                            family: "'JetBrains Mono', monospace",
                            size: 10
                        }
                    }
                },
                y: {
                    grid: {
                        color: 'rgba(255,255,255,0.05)'
                    },
                    ticks: {
                        color: '#6b7280',
                        font: {
                            family: "'JetBrains Mono', monospace",
                            size: 10
                        }
                    }
                }
            },
            interaction: {
                intersect: false,
                mode: 'index'
            }
        }
    });

    // Chart Tab Controls
    const tabs = document.querySelectorAll('.chart-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            const target = tab.dataset.target;
            const dataset1 = chartInstance.data.datasets[0];
            const dataset2 = chartInstance.data.datasets[1];
            
            if (target === 'temp') {
                dataset1.hidden = false;
                dataset2.hidden = true;
                dataset1.label = 'Temperature (°C)';
            } else if (target === 'soil') {
                dataset1.hidden = true;
                dataset2.hidden = false;
                dataset2.label = 'Soil Moisture (%)';
            }
            chartInstance.update();
        });
    });
    
    // Initialize with temp view
    chartInstance.data.datasets[1].hidden = true;
    chartInstance.update();
}

function updateChartData(temp, soil) {
    if (!chartInstance) return;
    
    const now = new Date();
    const label = now.getHours().toString().padStart(2, '0') + ':' + 
                  now.getMinutes().toString().padStart(2, '0');
    
    // Add new data point
    if (state.chartLabels.length >= state.maxChartPoints) {
        state.chartLabels.shift();
        state.chartTempData.shift();
        state.chartSoilData.shift();
    }
    
    state.chartLabels.push(label);
    if (temp !== null) state.chartTempData.push(temp);
    if (soil !== null) state.chartSoilData.push(soil);
    
    // Update chart
    chartInstance.data.labels = state.chartLabels;
    chartInstance.data.datasets[0].data = state.chartTempData;
    chartInstance.data.datasets[1].data = state.chartSoilData;
    chartInstance.update('none');
}

// ==================== MANUAL CONTROLS ====================
function initManualControls() {
    // Pump Toggle
    [DOM.togglePumpManual, DOM.togglePumpCard].forEach(toggle => {
        if (toggle) {
            toggle.addEventListener('change', (e) => {
                const value = e.target.checked ? 'ON' : 'OFF';
                if (publishControl(MQTT_CONFIG.topics.controlPump, value)) {
                    // If in auto mode, disable it
                    if (state.autoMode) {
                        state.autoMode = false;
                        publishControl(MQTT_CONFIG.topics.controlAuto, 'OFF');
                        renderAll();
                        showToast('Mode Otomatis dinonaktifkan (manual override)', 'info');
                    }
                }
            });
        }
    });
    
    // Lamp Toggle
    [DOM.toggleLampManual, DOM.toggleLampCard].forEach(toggle => {
        if (toggle) {
            toggle.addEventListener('change', (e) => {
                const value = e.target.checked ? 'ON' : 'OFF';
                if (publishControl(MQTT_CONFIG.topics.controlLamp, value)) {
                    if (state.autoMode) {
                        state.autoMode = false;
                        publishControl(MQTT_CONFIG.topics.controlAuto, 'OFF');
                        renderAll();
                        showToast('Mode Otomatis dinonaktifkan (manual override)', 'info');
                    }
                }
            });
        }
    });
    
    // Buzzer Toggle
    if (DOM.toggleBuzzerManual) {
        DOM.toggleBuzzerManual.addEventListener('change', (e) => {
            const value = e.target.checked ? 'ON' : 'OFF';
            publishControl(MQTT_CONFIG.topics.controlBuzzer, value);
        });
    }
    
    // Quick Water
    if (DOM.btnQuickWater) {
        DOM.btnQuickWater.addEventListener('click', () => {
            if (quickWaterTimer) {
                clearInterval(quickWaterTimer);
                quickWaterTimer = null;
                publishControl(MQTT_CONFIG.topics.controlPump, 'OFF');
                if (DOM.labelQuickWater) DOM.labelQuickWater.textContent = '💦 Siram Cepat (5 Detik)';
                showToast('⏹️ Penyiraman manual dihentikan.', 'info');
                return;
            }
            
            let countdown = 5;
            if (publishControl(MQTT_CONFIG.topics.controlPump, 'ON')) {
                if (state.autoMode) {
                    state.autoMode = false;
                    publishControl(MQTT_CONFIG.topics.controlAuto, 'OFF');
                    renderAll();
                }
                showToast('💦 Siram Cepat 5 Detik dimulai...', 'info');
                if (DOM.labelQuickWater) DOM.labelQuickWater.textContent = `⏳ Menyiram... (${countdown}s)`;
                
                quickWaterTimer = setInterval(() => {
                    countdown--;
                    if (countdown > 0) {
                        if (DOM.labelQuickWater) DOM.labelQuickWater.textContent = `⏳ Menyiram... (${countdown}s)`;
                    } else {
                        clearInterval(quickWaterTimer);
                        quickWaterTimer = null;
                        publishControl(MQTT_CONFIG.topics.controlPump, 'OFF');
                        if (DOM.labelQuickWater) DOM.labelQuickWater.textContent = '💦 Siram Cepat (5 Detik)';
                        showToast('✅ Penyiraman manual 5 detik telah selesai!', 'success');
                    }
                }, 1000);
            }
        });
    }
    
    // Toggle Lamp Button
    if (DOM.btnToggleLamp) {
        DOM.btnToggleLamp.addEventListener('click', () => {
            const newState = !state.lamp;
            const value = newState ? 'ON' : 'OFF';
            if (publishControl(MQTT_CONFIG.topics.controlLamp, value)) {
                if (state.autoMode) {
                    state.autoMode = false;
                    publishControl(MQTT_CONFIG.topics.controlAuto, 'OFF');
                    renderAll();
                }
                showToast(`💡 Lampu ${newState ? 'DINYALAKAN' : 'DIMATIKAN'}`, 'info');
            }
        });
    }
    
    // Global Auto Mode
    if (DOM.toggleGlobalAuto) {
        DOM.toggleGlobalAuto.addEventListener('change', (e) => {
            const value = e.target.checked ? 'ON' : 'OFF';
            state.autoMode = e.target.checked;
            if (publishControl(MQTT_CONFIG.topics.controlAuto, value)) {
                renderAll();
                showToast(state.autoMode ? '🤖 Mode Otomatis Diaktifkan' : '🖐️ Mode Manual Diaktifkan', 'info');
            }
        });
    }
}

// ==================== RECONNECT BUTTON ====================
function initReconnectButton() {
    if (DOM.btnReconnectMQTT) {
        DOM.btnReconnectMQTT.addEventListener('click', () => {
            showToast('🔄 Reconnecting MQTT...', 'info');
            if (mqttClient) {
                mqttClient.end();
                setTimeout(initMQTT, 1000);
            } else {
                initMQTT();
            }
        });
    }
}

// ==================== CAMERA MODULE ====================
function initCameraModule() {
    if (DOM.btnCaptureImage) {
        DOM.btnCaptureImage.addEventListener('click', captureImage);
    }
    
    if (DOM.btnClearRecent) {
        DOM.btnClearRecent.addEventListener('click', clearRecentCaptures);
    }
    
    if (DOM.modalClose) {
        DOM.modalClose.addEventListener('click', () => {
            DOM.imageModal.classList.add('hidden');
        });
    }
    
    if (DOM.imageModal) {
        DOM.imageModal.addEventListener('click', (e) => {
            if (e.target === DOM.imageModal) {
                DOM.imageModal.classList.add('hidden');
            }
        });
    }
}

function captureImage() {
    // Show loading
    DOM.cameraLoading.classList.remove('hidden');
    DOM.cameraPlaceholder.classList.add('hidden');
    DOM.cameraCanvas.classList.add('hidden');
    if (DOM.btnCaptureImage) DOM.btnCaptureImage.disabled = true;
    
    // Publish camera capture command via MQTT
    const published = publishControl(MQTT_CONFIG.topics.cameraCapture, 'CAPTURE');
    
    if (!published) {
        // Fallback: Simulate capture if MQTT not connected
        simulateCapture();
        return;
    }
    
    // Wait for response (simulated)
    setTimeout(() => {
        simulateCapture();
    }, 1500);
}

function simulateCapture() {
    // Hide loading
    DOM.cameraLoading.classList.add('hidden');
    if (DOM.btnCaptureImage) DOM.btnCaptureImage.disabled = false;
    
    // Render simulated image
    const canvas = DOM.cameraCanvas;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    
    // Background
    const bgGrad = ctx.createLinearGradient(0, 0, w, h);
    bgGrad.addColorStop(0, '#0f172a');
    bgGrad.addColorStop(0.5, '#064e3b');
    bgGrad.addColorStop(1, '#022c22');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);
    
    // Soil
    ctx.fillStyle = '#1c1917';
    ctx.beginPath();
    ctx.ellipse(w / 2, h - 40, w / 3, 40, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Plant Stem
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 12;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(w / 2, h - 40);
    ctx.quadraticCurveTo(w / 2 - 30, h / 2 + 20, w / 2, 90);
    ctx.stroke();
    
    // Leaves
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
    
    // Fruits
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(w / 2 + 30, h / 2 + 10, 16, 0, Math.PI * 2);
    ctx.arc(w / 2 - 25, h / 2 - 40, 14, 0, Math.PI * 2);
    ctx.fill();
    
    // HUD Overlay
    const margin = 20;
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.4)';
    ctx.lineWidth = 1.5;
    
    // Corner brackets
    const bSize = 24;
    ctx.beginPath(); ctx.moveTo(margin, margin + bSize); ctx.lineTo(margin, margin); ctx.lineTo(margin + bSize, margin); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(w - margin - bSize, margin); ctx.lineTo(w - margin, margin); ctx.lineTo(w - margin, margin + bSize); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(margin, h - margin - bSize); ctx.lineTo(margin, h - margin); ctx.lineTo(margin + bSize, h - margin); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(w - margin - bSize, h - margin); ctx.lineTo(w - margin, h - margin); ctx.lineTo(w - margin, h - margin - bSize); ctx.stroke();
    
    // Info
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.fillRect(margin + 10, margin + 10, 220, 55);
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.5)';
    ctx.strokeRect(margin + 10, margin + 10, 220, 55);
    
    ctx.fillStyle = '#34d399';
    ctx.font = '12px "JetBrains Mono", monospace';
    const timeStr = new Date().toTimeString().split(' ')[0];
    ctx.fillText(`CAM: ESP32-CAM [1080p]`, margin + 20, margin + 28);
    ctx.fillText(`TIME: ${timeStr}`, margin + 20, margin + 44);
    ctx.fillText(`TEMP: ${state.temperature || '--'}°C  SOIL: ${state.soilMoisture || '--'}%`, margin + 20, margin + 58);
    
    // Show canvas
    canvas.classList.remove('hidden');
    DOM.cameraPlaceholder.classList.add('hidden');
    
    // Add to gallery
    const dataUrl = canvas.toDataURL('image/png');
    addRecentCapture({
        id: Date.now(),
        image: dataUrl,
        timestamp: timeStr,
        temp: state.temperature,
        moisture: state.soilMoisture
    });
    
    if (DOM.cameraStatusBadge) {
        DOM.cameraStatusBadge.textContent = 'CAPTURED';
        DOM.cameraStatusBadge.className = 'badge badge-success';
    }
    if (DOM.cameraMetaStatus) {
        DOM.cameraMetaStatus.textContent = 'CAPTURED';
        DOM.cameraMetaStatus.className = 'meta-val status-online';
    }
    
    showToast('📸 Image captured successfully!', 'success');
}

function addRecentCapture(capture) {
    recentCaptures.unshift(capture);
    if (recentCaptures.length > 3) {
        recentCaptures.pop();
    }
    renderRecentCaptures();
}

function renderRecentCaptures() {
    const gallery = DOM.recentGallery;
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
                <span class="gallery-meta">${cap.temp !== null ? cap.temp.toFixed(1) : '--'}°C • Moisture ${cap.moisture !== null ? cap.moisture : '--'}%</span>
            </div>
        </div>
    `).join('');
    
    // Attach click listeners
    const items = gallery.querySelectorAll('.gallery-item');
    items.forEach(item => {
        item.addEventListener('click', () => {
            const idx = parseInt(item.dataset.index);
            openModal(recentCaptures[idx]);
        });
    });
}

function clearRecentCaptures() {
    recentCaptures = [];
    renderRecentCaptures();
    showToast('🗑️ Gallery cleared', 'info');
}

function openModal(capture) {
    if (!DOM.imageModal || !DOM.modalImage) return;
    
    DOM.modalImage.src = capture.image;
    if (DOM.modalTimestamp) {
        DOM.modalTimestamp.textContent = `Timestamp: ${capture.timestamp}`;
    }
    if (DOM.modalMeta) {
        DOM.modalMeta.textContent = `Camera: ESP32-CAM • Temp: ${capture.temp !== null ? capture.temp.toFixed(1) : '--'}°C • Moisture: ${capture.moisture !== null ? capture.moisture : '--'}%`;
    }
    DOM.imageModal.classList.remove('hidden');
}

// ==================== TOAST ====================
function showToast(message, type = 'info') {
    const container = DOM.toastContainer;
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast-item toast-${type}`;
    
    let icon = 'ℹ️';
    if (type === 'warning') icon = '⚠️';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '❌';
    
    toast.innerHTML = `
        <span class="toast-icon">${icon}</span>
        <span class="toast-text">${message}</span>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);
    
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

// ==================== EXPOSE FOR DEBUG ====================
window.debug = {
    state: state,
    MQTT_CONFIG: MQTT_CONFIG,
    mqttClient: mqttClient,
    DOM: DOM,
    recentCaptures: recentCaptures,
    publishControl: publishControl,
    showToast: showToast
};

console.log('🔧 Debug: Type "debug" in console to see state');
console.log('🔧 Debug: Type "debug.publishControl(topic, value)" to send MQTT');
