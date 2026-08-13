/* ==========================================================================
   SMART FARMING IOT DASHBOARD - FULL MQTT INTEGRATION v2.1
   PERBAIKAN: Stabil, Auto-reconnect, Error Handling, Auto-Online Detection
   ========================================================================== */

// ==================== MQTT CONFIGURATION ====================
const MQTT_CONFIG = {
    // HiveMQ Public Broker (WebSocket Secure)
    broker: 'wss://broker.hivemq.com:8884/mqtt',
    
    // Jika pakai HiveMQ Cloud berbayar, uncomment ini:
    // broker: 'wss://YOUR_CLUSTER.s1.eu.hivemq.cloud:8884/mqtt',
    // username: 'YOUR_USERNAME',
    // password: 'YOUR_PASSWORD',
    
    topics: {
        // Sensor Topics (dari ESP32)
        temperature: 'smartfarm/sensor/temperature',
        humidity: 'smartfarm/sensor/humidity',
        soilMoisture: 'smartfarm/sensor/soil_moisture',
        waterLevel: 'smartfarm/sensor/water_level',
        light: 'smartfarm/sensor/light',
        
        // Actuator Topics (dari ESP32)
        pump: 'smartfarm/actuator/pump',
        lamp: 'smartfarm/actuator/lamp',
        buzzer: 'smartfarm/actuator/buzzer',
        
        // Control Topics (ke ESP32)
        controlPump: 'smartfarm/control/pump',
        controlLamp: 'smartfarm/control/lamp',
        controlBuzzer: 'smartfarm/control/buzzer',
        controlAuto: 'smartfarm/control/auto_mode',
        controlQuick: 'smartfarm/control/quick_water',
        
        // Status Topic (dari ESP32)
        status: 'smartfarm/status/esp32',
        
        // Feedback (dari ESP32)
        feedback: 'smartfarm/feedback/#'
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
    soilStatus: '--',
    ldrADC: null,
    soilADC: null,
    
    // Actuator States
    pump: false,
    lamp: false,
    buzzer: false,
    
    // System
    systemStatus: 'ONLINE', // Default ONLINE
    autoMode: true,
    alarm: false,
    uptime: 0,
    waterUsed: 0,
    wifiConnected: false,
    mqttConnected: false,
    
    // MQTT
    connected: false,
    lastUpdate: null,
    messageCount: 0,
    reconnectAttempts: 0,
    hasReceivedData: false, // Flag untuk cek apakah pernah terima data
    
    // Chart History
    chartLabels: [],
    chartTempData: [],
    chartSoilData: [],
    maxChartPoints: 30,
    
    // Quick Water
    quickWaterActive: false,
    quickWaterCountdown: 0
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
    tempTrend: document.getElementById('tempTrend'),
    
    valHumidity: document.getElementById('valHumidity'),
    statusHumidity: document.getElementById('statusHumidity'),
    humidityTrendText: document.getElementById('humidityTrendText'),
    humidityTrend: document.getElementById('humidityTrend'),
    
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
let isConnecting = false;
let reconnectTimeout = null;

// ==================== INIT ====================
document.addEventListener('DOMContentLoaded', () => {
    console.log('🌱 Smart Farming Dashboard v2.1');
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
    if (DOM.toggleGlobalAuto) {
        DOM.toggleGlobalAuto.checked = true;
        state.autoMode = true;
    }
    
    // Set initial status
    state.systemStatus = 'ONLINE';
    renderAll();
    
    // Check connection status periodically
    setInterval(checkConnectionStatus, 10000);
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
    if (isConnecting) return;
    isConnecting = true;
    
    try {
        // Close existing connection
        if (mqttClient) {
            try {
                mqttClient.end(true);
            } catch (e) {}
            mqttClient = null;
        }
        
        const clientId = 'dashboard_' + Math.random().toString(16).substr(2, 8);
        
        const options = {
            clientId: clientId,
            clean: true,
            reconnectPeriod: 3000,
            keepAlive: 60,
            connectTimeout: 10000
        };
        
        if (MQTT_CONFIG.username && MQTT_CONFIG.password) {
            options.username = MQTT_CONFIG.username;
            options.password = MQTT_CONFIG.password;
        }
        
        console.log('🔄 Connecting to MQTT...');
        updateConnectionUI('connecting', 'Connecting...', 'Connecting');
        
        mqttClient = mqtt.connect(MQTT_CONFIG.broker, options);
        
        mqttClient.on('connect', () => {
            console.log('✅ MQTT Connected');
            isConnecting = false;
            state.connected = true;
            state.mqttConnected = true;
            state.reconnectAttempts = 0;
            
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
            
            // Request status
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
            isConnecting = false;
            state.connected = false;
            state.mqttConnected = false;
            updateConnectionUI('disconnected', 'MQTT Error', 'Offline');
            showToast('MQTT Error: ' + err.message, 'error');
            
            // Auto reconnect after delay
            if (reconnectTimeout) clearTimeout(reconnectTimeout);
            reconnectTimeout = setTimeout(() => {
                if (!state.connected) {
                    initMQTT();
                }
            }, 10000);
        });

        mqttClient.on('offline', () => {
            console.log('⚠️ MQTT Offline');
            isConnecting = false;
            state.connected = false;
            state.mqttConnected = false;
            updateConnectionUI('disconnected', 'MQTT Offline', 'Offline');
        });

        mqttClient.on('reconnect', () => {
            console.log('🔄 MQTT Reconnecting...');
            updateConnectionUI('connecting', 'Reconnecting...', 'Connecting');
        });

    } catch (e) {
        console.error('❌ MQTT Init error:', e);
        isConnecting = false;
        showToast('MQTT Init error: ' + e.message, 'error');
        
        // Retry after delay
        if (reconnectTimeout) clearTimeout(reconnectTimeout);
        reconnectTimeout = setTimeout(() => {
            initMQTT();
        }, 10000);
    }
}

// ==================== HANDLE MQTT MESSAGE ====================
function handleMQTTMessage(topic, payload) {
    const topics = MQTT_CONFIG.topics;
    
    // Update last update time
    state.lastUpdate = new Date();
    updateLastTimestamp();
    state.messageCount++;
    state.hasReceivedData = true;
    
    // ==========================================================
    // HANDLE INDIVIDUAL SENSOR TOPICS (tanpa menunggu status JSON)
    // ==========================================================
    
    // Temperature
    if (topic === topics.temperature) {
        state.temperature = parseFloat(payload);
        updateChartData(state.temperature, null);
        // Auto-set ONLINE jika menerima data
        if (state.systemStatus === 'OFFLINE' || state.systemStatus === 'SENSOR ERROR') {
            state.systemStatus = 'ONLINE';
        }
        renderAll();
        return;
    }
    
    // Humidity
    else if (topic === topics.humidity) {
        state.humidity = parseFloat(payload);
        if (state.systemStatus === 'OFFLINE' || state.systemStatus === 'SENSOR ERROR') {
            state.systemStatus = 'ONLINE';
        }
        renderAll();
        return;
    }
    
    // Soil Moisture
    else if (topic === topics.soilMoisture) {
        state.soilMoisture = parseInt(payload);
        updateChartData(null, state.soilMoisture);
        if (state.systemStatus === 'OFFLINE' || state.systemStatus === 'SENSOR ERROR') {
            state.systemStatus = 'ONLINE';
        }
        renderAll();
        return;
    }
    
    // Water Level
    else if (topic === topics.waterLevel) {
        state.waterLevel = parseInt(payload);
        if (state.systemStatus === 'OFFLINE' || state.systemStatus === 'SENSOR ERROR') {
            state.systemStatus = 'ONLINE';
        }
        renderAll();
        return;
    }
    
    // Light Status
    else if (topic === topics.light) {
        state.light = payload;
        if (state.systemStatus === 'OFFLINE' || state.systemStatus === 'SENSOR ERROR') {
            state.systemStatus = 'ONLINE';
        }
        renderAll();
        return;
    }
    
    // Actuator States
    else if (topic === topics.pump) {
        state.pump = payload === 'ON';
        syncPumpToggle();
        renderAll();
        return;
    }
    else if (topic === topics.lamp) {
        state.lamp = payload === 'ON';
        syncLampToggle();
        renderAll();
        return;
    }
    else if (topic === topics.buzzer) {
        state.buzzer = payload === 'ON';
        renderAll();
        return;
    }
    
    // ==========================================================
    // PARSE JSON STATUS (jika ada)
    // ==========================================================
    
    if (topic === topics.status) {
        try {
            const data = JSON.parse(payload);
            console.log('📊 Status JSON:', data);
            
            // Update state from JSON
            if (data.temperature !== undefined) state.temperature = data.temperature;
            if (data.humidity !== undefined) state.humidity = data.humidity;
            if (data.soil_moisture !== undefined) state.soilMoisture = data.soil_moisture;
            if (data.soil_status !== undefined) state.soilStatus = data.soil_status;
            if (data.water_level !== undefined) state.waterLevel = data.water_level;
            if (data.light !== undefined) state.light = data.light;
            if (data.ldr_adc !== undefined) state.ldrADC = data.ldr_adc;
            if (data.soil_adc !== undefined) state.soilADC = data.soil_adc;
            if (data.pump !== undefined) state.pump = data.pump === 'ON';
            if (data.lamp !== undefined) state.lamp = data.lamp === 'ON';
            if (data.buzzer !== undefined) state.buzzer = data.buzzer === 'ON';
            if (data.mode !== undefined) state.autoMode = data.mode === 'AUTO';
            if (data.status !== undefined) state.systemStatus = data.status;
            if (data.alarm !== undefined) state.alarm = data.alarm;
            if (data.uptime !== undefined) state.uptime = data.uptime;
            if (data.water_used !== undefined) state.waterUsed = data.water_used;
            if (data.wifi !== undefined) state.wifiConnected = data.wifi;
            if (data.mqtt !== undefined) state.mqttConnected = data.mqtt;
            
            // Update UI
            renderAll();
            return;
        } catch (e) {
            console.warn('⚠️ Failed to parse status JSON:', e);
        }
    }
    
    // ==========================================================
    // HANDLE FEEDBACK TOPICS
    // ==========================================================
    
    if (topic === 'smartfarm/feedback/pump') {
        showToast('💧 Pump feedback: ' + payload, payload === 'SAFETY_BLOCKED' ? 'warning' : 'info');
        return;
    }
    else if (topic === 'smartfarm/feedback/lamp') {
        showToast('💡 Lamp feedback: ' + payload, 'info');
        return;
    }
    else if (topic === 'smartfarm/feedback/quick_water') {
        if (payload === 'STARTED') {
            showToast('⏱️ Quick water started!', 'success');
        } else if (payload === 'SAFETY_BLOCKED') {
            showToast('⛔ Quick water blocked - water level critical!', 'warning');
        } else {
            showToast('⏱️ Quick water: ' + payload, 'info');
        }
        return;
    }
    
    // Render UI jika ada perubahan
    renderAll();
}

// ==================== PUBLISH CONTROL ====================
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

// ==================== CONNECTION CHECK ====================
function checkConnectionStatus() {
    if (!state.connected && !isConnecting) {
        console.log('🔄 Connection lost, reconnecting...');
        initMQTT();
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
    // Jika sudah menerima data, set status ONLINE
    if (state.hasReceivedData && state.systemStatus === 'OFFLINE') {
        state.systemStatus = 'ONLINE';
    }
    
    const isOnline = state.systemStatus === 'ONLINE' || state.systemStatus === 'NORMAL';
    const isWarning = state.systemStatus === 'WARNING';
    const isSensorError = state.systemStatus === 'SENSOR ERROR';
    
    // System Status Card
    if (DOM.sysStatusDot) {
        if (isOnline) {
            DOM.sysStatusDot.className = 'status-dot-lg online';
        } else if (isWarning) {
            DOM.sysStatusDot.className = 'status-dot-lg warning';
            DOM.sysStatusDot.style.backgroundColor = 'var(--accent-amber)';
            DOM.sysStatusDot.style.boxShadow = '0 0 12px var(--accent-amber)';
        } else if (isSensorError) {
            DOM.sysStatusDot.className = 'status-dot-lg offline';
            DOM.sysStatusDot.style.backgroundColor = 'var(--accent-red)';
            DOM.sysStatusDot.style.boxShadow = '0 0 12px var(--accent-red)';
        } else {
            DOM.sysStatusDot.className = 'status-dot-lg offline';
            DOM.sysStatusDot.style.backgroundColor = 'var(--accent-red)';
            DOM.sysStatusDot.style.boxShadow = '0 0 12px var(--accent-red)';
        }
    }
    
    if (DOM.sysStatusText) {
        if (isOnline) {
            DOM.sysStatusText.textContent = 'ONLINE';
            DOM.sysStatusText.style.color = 'var(--accent-green)';
        } else if (isWarning) {
            DOM.sysStatusText.textContent = 'WARNING';
            DOM.sysStatusText.style.color = 'var(--accent-amber)';
        } else if (isSensorError) {
            DOM.sysStatusText.textContent = 'SENSOR ERROR';
            DOM.sysStatusText.style.color = 'var(--accent-red)';
        } else {
            DOM.sysStatusText.textContent = 'OFFLINE';
            DOM.sysStatusText.style.color = 'var(--accent-red)';
        }
    }
    
    if (DOM.sysStatusSub) {
        if (isOnline) {
            DOM.sysStatusSub.textContent = 'All systems operating normally';
        } else if (isWarning) {
            DOM.sysStatusSub.textContent = '⚠️ Water level critical!';
        } else if (isSensorError) {
            DOM.sysStatusSub.textContent = '⚠️ Sensor error detected!';
        } else {
            DOM.sysStatusSub.textContent = 'Connection lost with MCU';
        }
    }
    
    if (DOM.sysStatusBadge) {
        if (isOnline) {
            DOM.sysStatusBadge.textContent = 'NORMAL';
            DOM.sysStatusBadge.className = 'badge badge-success';
            DOM.sysStatusBadge.style.borderColor = '';
            DOM.sysStatusBadge.style.color = '';
        } else if (isWarning) {
            DOM.sysStatusBadge.textContent = 'WARNING';
            DOM.sysStatusBadge.className = 'badge badge-off';
            DOM.sysStatusBadge.style.borderColor = 'var(--accent-amber)';
            DOM.sysStatusBadge.style.color = 'var(--accent-amber)';
        } else if (isSensorError) {
            DOM.sysStatusBadge.textContent = 'SENSOR ERROR';
            DOM.sysStatusBadge.className = 'badge badge-off';
            DOM.sysStatusBadge.style.borderColor = 'var(--accent-red)';
            DOM.sysStatusBadge.style.color = 'var(--accent-red)';
        } else {
            DOM.sysStatusBadge.textContent = 'ALERT';
            DOM.sysStatusBadge.className = 'badge badge-off';
            DOM.sysStatusBadge.style.borderColor = '';
            DOM.sysStatusBadge.style.color = '';
        }
    }
    
    // Header Status
    if (DOM.headerSystemStatus) {
        if (isOnline) {
            DOM.headerSystemStatus.textContent = 'SYSTEM ONLINE';
        } else if (isWarning) {
            DOM.headerSystemStatus.textContent = 'SYSTEM WARNING';
        } else if (isSensorError) {
            DOM.headerSystemStatus.textContent = 'SENSOR ERROR';
        } else {
            DOM.headerSystemStatus.textContent = 'SYSTEM OFFLINE';
        }
    }
    
    if (DOM.headerStatusPill) {
        if (isOnline) {
            DOM.headerStatusPill.className = 'status-pill online';
            DOM.headerStatusPill.style.borderColor = 'rgba(16, 185, 129, 0.3)';
            DOM.headerStatusPill.style.color = 'var(--accent-green)';
        } else if (isWarning) {
            DOM.headerStatusPill.className = 'status-pill warning';
            DOM.headerStatusPill.style.borderColor = 'rgba(245, 158, 11, 0.3)';
            DOM.headerStatusPill.style.color = 'var(--accent-amber)';
        } else {
            DOM.headerStatusPill.className = 'status-pill offline';
            DOM.headerStatusPill.style.borderColor = 'rgba(239, 68, 68, 0.3)';
            DOM.headerStatusPill.style.color = 'var(--accent-red)';
        }
    }
    
    if (DOM.headerStatusDot) {
        DOM.headerStatusDot.className = `pulse-dot ${isOnline ? '' : 'offline'}`;
        if (isWarning) {
            DOM.headerStatusDot.style.backgroundColor = 'var(--accent-amber)';
            DOM.headerStatusDot.style.boxShadow = '0 0 8px var(--accent-amber)';
        } else if (isOnline) {
            DOM.headerStatusDot.style.backgroundColor = 'var(--accent-green)';
            DOM.headerStatusDot.style.boxShadow = '0 0 8px var(--accent-green)';
        } else {
            DOM.headerStatusDot.style.backgroundColor = 'var(--accent-red)';
            DOM.headerStatusDot.style.boxShadow = '0 0 8px var(--accent-red)';
        }
    }
    
    // Dot System
    if (DOM.dotSystem) {
        DOM.dotSystem.className = `state-dot ${isOnline ? 'on' : isWarning ? 'warning' : 'off'}`;
        if (isWarning) {
            DOM.dotSystem.style.backgroundColor = 'var(--accent-amber)';
            DOM.dotSystem.style.boxShadow = '0 0 8px var(--accent-amber)';
        } else if (isOnline) {
            DOM.dotSystem.style.backgroundColor = 'var(--accent-green)';
            DOM.dotSystem.style.boxShadow = '0 0 8px var(--accent-green)';
        } else {
            DOM.dotSystem.style.backgroundColor = 'var(--text-dim)';
            DOM.dotSystem.style.boxShadow = 'none';
        }
    }
    
    if (DOM.stateSystem) {
        if (isOnline) {
            DOM.stateSystem.textContent = 'NORMAL';
            DOM.stateSystem.className = 'state-text active';
            DOM.stateSystem.style.color = 'var(--accent-green)';
        } else if (isWarning) {
            DOM.stateSystem.textContent = 'WARNING';
            DOM.stateSystem.className = 'state-text active';
            DOM.stateSystem.style.color = 'var(--accent-amber)';
        } else if (isSensorError) {
            DOM.stateSystem.textContent = 'SENSOR ERROR';
            DOM.stateSystem.className = 'state-text';
            DOM.stateSystem.style.color = 'var(--accent-red)';
        } else {
            DOM.stateSystem.textContent = 'OFFLINE';
            DOM.stateSystem.className = 'state-text';
            DOM.stateSystem.style.color = 'var(--text-muted)';
        }
    }
    
    if (DOM.systemMCUStatus) {
        if (isOnline) {
            DOM.systemMCUStatus.textContent = 'ESP32 Status OK';
            DOM.systemMCUStatus.style.color = 'var(--text-muted)';
        } else if (isWarning) {
            DOM.systemMCUStatus.textContent = '⚠️ Water Critical!';
            DOM.systemMCUStatus.style.color = 'var(--accent-amber)';
        } else if (isSensorError) {
            DOM.systemMCUStatus.textContent = '⚠️ Sensor Error!';
            DOM.systemMCUStatus.style.color = 'var(--accent-red)';
        } else {
            DOM.systemMCUStatus.textContent = 'ESP32 Offline';
            DOM.systemMCUStatus.style.color = 'var(--text-dim)';
        }
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
    if (DOM.statusHumidity) {
        const hum = state.humidity;
        if (hum === null) {
            DOM.statusHumidity.textContent = '--';
            DOM.statusHumidity.className = 'badge badge-off';
        } else if (hum < 40) {
            DOM.statusHumidity.textContent = 'Low';
            DOM.statusHumidity.className = 'badge badge-off';
            DOM.statusHumidity.style.borderColor = 'var(--accent-amber)';
            DOM.statusHumidity.style.color = 'var(--accent-amber)';
        } else if (hum > 80) {
            DOM.statusHumidity.textContent = 'High';
            DOM.statusHumidity.className = 'badge badge-off';
            DOM.statusHumidity.style.borderColor = 'var(--accent-blue)';
            DOM.statusHumidity.style.color = 'var(--accent-blue)';
        } else {
            DOM.statusHumidity.textContent = 'Normal';
            DOM.statusHumidity.className = 'badge badge-outline-success';
            DOM.statusHumidity.style.borderColor = '';
            DOM.statusHumidity.style.color = '';
        }
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
            DOM.statusSoilMoisture.textContent = '🌵 Dry (Watering Needed)';
            DOM.statusSoilMoisture.style.color = 'var(--accent-amber)';
        } else if (val > 80) {
            DOM.statusSoilMoisture.textContent = '💦 Wet';
            DOM.statusSoilMoisture.style.color = 'var(--accent-blue)';
        } else {
            DOM.statusSoilMoisture.textContent = '🌱 Good';
            DOM.statusSoilMoisture.style.color = 'var(--text-muted)';
        }
    }
    
    // Water Level
    if (DOM.valWaterLevel) {
        if (state.waterLevel !== null && state.waterLevel >= 0) {
            DOM.valWaterLevel.textContent = Math.round(state.waterLevel);
        } else {
            DOM.valWaterLevel.textContent = 'ERR';
        }
    }
    if (DOM.barWaterLevel) {
        const val = state.waterLevel !== null && state.waterLevel >= 0 ? Math.min(100, Math.max(0, state.waterLevel)) : 0;
        DOM.barWaterLevel.style.width = `${val}%`;
    }
    if (DOM.statusWaterLevel) {
        const val = state.waterLevel;
        if (val === null || val < 0) {
            DOM.statusWaterLevel.textContent = '⚠️ Sensor Error!';
            DOM.statusWaterLevel.style.color = 'var(--accent-red)';
        } else if (val < 20) {
            DOM.statusWaterLevel.textContent = '🔴 Critical! Water Low';
            DOM.statusWaterLevel.style.color = 'var(--accent-red)';
        } else if (val < 40) {
            DOM.statusWaterLevel.textContent = '🟡 Low Water';
            DOM.statusWaterLevel.style.color = 'var(--accent-amber)';
        } else {
            DOM.statusWaterLevel.textContent = '✅ Good';
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
        DOM.envWater.textContent = state.waterLevel !== null && state.waterLevel >= 0 ? `${Math.round(state.waterLevel)} %` : 'ERR';
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
    
    const initialLabels = Array(30).fill('--');
    const initialData = Array(30).fill(0);
    
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
                pointRadius: 2,
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
                pointRadius: 2,
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
    
    chartInstance.data.datasets[1].hidden = true;
    chartInstance.update();
}

function updateChartData(temp, soil) {
    if (!chartInstance) return;
    
    const now = new Date();
    const label = now.getHours().toString().padStart(2, '0') + ':' + 
                  now.getMinutes().toString().padStart(2, '0');
    
    if (state.chartLabels.length >= state.maxChartPoints) {
        state.chartLabels.shift();
        state.chartTempData.shift();
        state.chartSoilData.shift();
    }
    
    state.chartLabels.push(label);
    if (temp !== null) state.chartTempData.push(temp);
    if (soil !== null) state.chartSoilData.push(soil);
    
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
                    if (state.autoMode) {
                        state.autoMode = false;
                        publishControl(MQTT_CONFIG.topics.controlAuto, 'OFF');
                        renderAll();
                        showToast('Mode Otomatis dinonaktifkan (manual override)', 'info');
                    }
                } else {
                    // Revert if publish failed
                    e.target.checked = !e.target.checked;
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
                } else {
                    e.target.checked = !e.target.checked;
                }
            });
        }
    });
    
    // Buzzer Toggle
    if (DOM.toggleBuzzerManual) {
        DOM.toggleBuzzerManual.addEventListener('change', (e) => {
            const value = e.target.checked ? 'ON' : 'OFF';
            if (!publishControl(MQTT_CONFIG.topics.controlBuzzer, value)) {
                e.target.checked = !e.target.checked;
            }
        });
    }
    
    // Quick Water
    if (DOM.btnQuickWater) {
        DOM.btnQuickWater.addEventListener('click', () => {
            if (state.quickWaterActive) {
                // Cancel quick water
                state.quickWaterActive = false;
                if (quickWaterTimer) {
                    clearInterval(quickWaterTimer);
                    quickWaterTimer = null;
                }
                publishControl(MQTT_CONFIG.topics.controlPump, 'OFF');
                if (DOM.labelQuickWater) DOM.labelQuickWater.textContent = '💦 Siram Cepat (5 Detik)';
                showToast('⏹️ Penyiraman manual dihentikan.', 'info');
                return;
            }
            
            // Check water safety
            if (state.waterLevel !== null && state.waterLevel <= 20) {
                showToast('⚠️ Water level critical! Cannot start watering.', 'warning');
                return;
            }
            
            const duration = 5;
            if (publishControl(MQTT_CONFIG.topics.controlQuick, String(duration))) {
                state.quickWaterActive = true;
                
                if (state.autoMode) {
                    state.autoMode = false;
                    publishControl(MQTT_CONFIG.topics.controlAuto, 'OFF');
                    renderAll();
                }
                
                let countdown = duration;
                if (DOM.labelQuickWater) DOM.labelQuickWater.textContent = `⏳ Menyiram... (${countdown}s)`;
                showToast(`💦 Siram Cepat ${duration} Detik dimulai...`, 'info');
                
                if (quickWaterTimer) clearInterval(quickWaterTimer);
                quickWaterTimer = setInterval(() => {
                    countdown--;
                    if (countdown > 0) {
                        if (DOM.labelQuickWater) DOM.labelQuickWater.textContent = `⏳ Menyiram... (${countdown}s)`;
                    } else {
                        clearInterval(quickWaterTimer);
                        quickWaterTimer = null;
                        state.quickWaterActive = false;
                        if (DOM.labelQuickWater) DOM.labelQuickWater.textContent = '💦 Siram Cepat (5 Detik)';
                        showToast('✅ Penyiraman manual selesai!', 'success');
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
            } else {
                e.target.checked = !e.target.checked;
                state.autoMode = e.target.checked;
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
                mqttClient.end(true);
            }
            if (reconnectTimeout) clearTimeout(reconnectTimeout);
            setTimeout(() => {
                initMQTT();
            }, 1000);
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
    DOM.cameraLoading.classList.remove('hidden');
    DOM.cameraPlaceholder.classList.add('hidden');
    DOM.cameraCanvas.classList.add('hidden');
    if (DOM.btnCaptureImage) DOM.btnCaptureImage.disabled = true;
    
    const published = publishControl(MQTT_CONFIG.topics.cameraCapture, 'CAPTURE');
    
    if (!published) {
        simulateCapture();
        return;
    }
    
    setTimeout(() => {
        simulateCapture();
    }, 1500);
}

function simulateCapture() {
    DOM.cameraLoading.classList.add('hidden');
    if (DOM.btnCaptureImage) DOM.btnCaptureImage.disabled = false;
    
    const canvas = DOM.cameraCanvas;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    
    const bgGrad = ctx.createLinearGradient(0, 0, w, h);
    bgGrad.addColorStop(0, '#0f172a');
    bgGrad.addColorStop(0.5, '#064e3b');
    bgGrad.addColorStop(1, '#022c22');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);
    
    ctx.fillStyle = '#1c1917';
    ctx.beginPath();
    ctx.ellipse(w / 2, h - 40, w / 3, 40, 0, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 12;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(w / 2, h - 40);
    ctx.quadraticCurveTo(w / 2 - 30, h / 2 + 20, w / 2, 90);
    ctx.stroke();
    
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
    
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(w / 2 + 30, h / 2 + 10, 16, 0, Math.PI * 2);
    ctx.arc(w / 2 - 25, h / 2 - 40, 14, 0, Math.PI * 2);
    ctx.fill();
    
    const margin = 20;
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.4)';
    ctx.lineWidth = 1.5;
    
    const bSize = 24;
    ctx.beginPath(); ctx.moveTo(margin, margin + bSize); ctx.lineTo(margin, margin); ctx.lineTo(margin + bSize, margin); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(w - margin - bSize, margin); ctx.lineTo(w - margin, margin); ctx.lineTo(w - margin, margin + bSize); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(margin, h - margin - bSize); ctx.lineTo(margin, h - margin); ctx.lineTo(margin + bSize, h - margin); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(w - margin - bSize, h - margin); ctx.lineTo(w - margin, h - margin); ctx.lineTo(w - margin, h - margin - bSize); ctx.stroke();
    
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
    
    canvas.classList.remove('hidden');
    DOM.cameraPlaceholder.classList.add('hidden');
    
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
    if (type === 'info') icon = '📡';
    
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
    showToast: showToast,
    initMQTT: initMQTT
};

console.log('🔧 Debug: Type "debug" in console to see state');
console.log('🔧 Debug: Type "debug.publishControl(topic, value)" to send MQTT');
