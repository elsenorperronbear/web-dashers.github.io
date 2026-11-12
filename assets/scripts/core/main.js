/**
 * Main Game Initialization
 * Punto de entrada principal del juego
 */

// Inicializar configuraciones de optimización
if (window.initOptimizations) {
    window.initOptimizations();
}

// Verificar si se puede cargar desde caché
function checkForAutoLoad() {
    const assetsLoaded = localStorage.getItem('webdash_assets_loaded') === 'true';
    const lastLoadTime = parseInt(localStorage.getItem('webdash_last_load_time') || '0');
    const now = Date.now();
    const hoursSinceLoad = (now - lastLoadTime) / (1000 * 60 * 60);
    
    if (assetsLoaded && hoursSinceLoad < 24) {
        if (window.gameCache && window.gameCache.isCacheValid()) {
            const stats = window.gameCache.getCacheStats();
            if (stats.validEntries > 50) {
                console.log('Auto loading from cache');
                return true;
            }
        }
    }
    return false;
}

// Inicializar cache manager
if (window.gameCache) {
    window.gameCache.init();
    const canAutoLoad = checkForAutoLoad();
    
    if (canAutoLoad) {
        const autoLoadIndicator = document.createElement('div');
        autoLoadIndicator.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            background: #00ff00;
            color: #000;
            padding: 5px 10px;
            border-radius: 5px;
            font-family: Arial;
            font-size: 12px;
            z-index: 9999;
            box-shadow: 0 0 10px rgba(0,255,0,0.5);
        `;
        autoLoadIndicator.textContent = 'turbo loading';
        document.body.appendChild(autoLoadIndicator);
        setTimeout(() => {
            if (autoLoadIndicator.parentNode) {
                autoLoadIndicator.parentNode.removeChild(autoLoadIndicator);
            }
        }, 3000);
    }
}

// Configuración de Phaser con optimizaciones
const phaserConfig = {
    type: Phaser.AUTO,
    width: screenWidth,
    height: screenHeight,
    resolution: 1,
    fps: {
        smoothStep: true,
        target: 60,
        forceSetTimeOut: true
    },
    backgroundColor: "#000000",
    parent: document.body,
    input: {
        windowEvents: false,
        activePointers: 3
    },
    render: {
        powerPreference: window.isMobile ? "low-power" : "default",
        antialias: !window.useLowQualityMode,
        roundPixels: true
    },
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        expandParent: false
    },
    scene: [BootScene, GameScene],
    // Optimización de memoria
    disableContextMenu: true,
    audio: {
        disableWebAudio: false,
        noAudio: false
    }
};

// Crear instancia del juego
const game = new Phaser.Game(phaserConfig);
window.game = game;

// Optimizar renderizado
if (window.performanceOptimizer) {
    window.performanceOptimizer.optimizeRendering(game);
}

// Ajustar calidad según dispositivo
if (window.adjustQuality) {
    window.adjustQuality();
}

// Funciones globales para gestión de caché
window.clearGameCache = () => {
    if (window.gameCache) {
        window.gameCache.clearCache();
        localStorage.removeItem('webdash_assets_loaded');
        localStorage.removeItem('webdash_last_load_time');
        console.log('Game cache cleared');
        location.reload();
    }
};

window.getCacheInfo = () => {
    if (window.gameCache) {
        return window.gameCache.getCacheStats();
    }
    return null;
};

// Función para marcar assets como cargados
window.markAssetsLoaded = () => {
    localStorage.setItem('webdash_assets_loaded', 'true');
    localStorage.setItem('webdash_last_load_time', Date.now().toString());
};

// Manejo de errores globales
window.onerror = function(message, source, lineno, colno, error) {
    console.error('Error global:', message, source, lineno, colno, error);
    
    // Mostrar mensaje de error al usuario en desarrollo
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed;
            bottom: 10px;
            right: 10px;
            background: #ff0000;
            color: #fff;
            padding: 10px;
            border-radius: 5px;
            font-family: Arial;
            font-size: 12px;
            z-index: 9999;
            max-width: 300px;
            overflow: auto;
        `;
        errorDiv.textContent = `Error: ${message}`;
        document.body.appendChild(errorDiv);
        setTimeout(() => errorDiv.remove(), 5000);
    }
    
    return true;
};

// Manejo de promesas no capturadas
window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled rejection:', event.reason);
});

// Exportar referencia al juego
window.getGame = () => game;
