/**
 * Web Dashers Fixes
 * Correcciones para bugs conocidos y mejoras de fidelidad al original
 */

// ============================================
// FIX 1: Soporte para Swing Mode
// ============================================

// Añadir swing mode a la función _getGamemodePortalMode
const originalGetGamemodePortalMode = window.GameScene?.prototype?._getGamemodePortalMode;
if (originalGetGamemodePortalMode) {
    window.GameScene.prototype._getGamemodePortalMode = function(portalType) {
        switch (portalType) {
            case "portal_cube":
                return "cube";
            case "portal_fly":
                return "ship";
            case "portal_ball":
                return "ball";
            case "portal_wave":
                return "wave";
            case "portal_ufo":
                return "ufo";
            case "portal_robot":
                return "robot";
            case "portal_spider":
                return "spider";
            case "portal_swing":
                return "swing";
            default:
                return originalGetGamemodePortalMode.call(this, portalType);
        }
    };
}

// Añadir swing mode a _setPlayerGamemode
const originalSetPlayerGamemode = window.GameScene?.prototype?._setPlayerGamemode;
if (originalSetPlayerGamemode) {
    window.GameScene.prototype._setPlayerGamemode = function(player, state, mode, keepVelocity = true) {
        if (mode === "swing" && player.enterSwingMode) {
            const saved = {
                y: state.y,
                yVelocity: state.yVelocity,
                gravityFlipped: state.gravityFlipped,
                upKeyDown: state.upKeyDown,
                upKeyPressed: state.upKeyPressed,
                queuedHold: state.queuedHold,
                orbActivationConsumedForPress: !!state._orbActivationConsumedForPress,
                mirrored: state.mirrored,
                isMini: state.isMini
            };
            player.enterSwingMode({ y: saved.y, portalY: saved.y });
            return;
        }
        return originalSetPlayerGamemode.call(this, player, state, mode, keepVelocity);
    };
}

// Añadir swing mode a _getDualModeId
const originalGetDualModeId = window.GameScene?.prototype?._getDualModeId;
if (originalGetDualModeId) {
    window.GameScene.prototype._getDualModeId = function(state) {
        if (state.isSwing) return "swing";
        return originalGetDualModeId.call(this, state);
    };
}

// ============================================
// FIX 2: Mejorar física de Slopes
// ============================================

// Configuración mejorada de slopes
window.slopeReachGuard = true;
window.slopeBackWall = true;
window.slopeFlatCap = true;
window.slopeSwingCap = 13;
window.slopeTangentD = 0.42;

// Función para calcular la velocidad en slopes de manera más precisa
window.calculateSlopeVelocity = function(playerSpeed, slopeAngleRad, gravityFlipped) {
    const slopeAngle = Math.abs(slopeAngleRad);
    const downhill = gravityFlipped 
        ? (slopeAngleRad < 0) 
        : (slopeAngleRad > 0);
    
    // Velocidad base según el ángulo
    const baseSpeed = playerSpeed * (1 - Math.sin(slopeAngle) * 0.5);
    
    // Ajuste para pendientes pronunciadas
    if (slopeAngle > Math.PI / 4) {
        // Pendiente > 45 grados
        return downhill ? baseSpeed * 1.2 : baseSpeed * 0.8;
    } else if (slopeAngle > Math.PI / 6) {
        // Pendiente > 30 grados
        return downhill ? baseSpeed * 1.1 : baseSpeed * 0.9;
    }
    
    return baseSpeed;
};

// ============================================
// FIX 3: Mejorar colisiones
// ============================================

// Función para verificar colisiones más precisas
window.preciseCollisionCheck = function(player, gameObj, playerSize) {
    if (!player || !gameObj) return false;
    
    const playerLeft = player.x - playerSize / 2;
    const playerRight = player.x + playerSize / 2;
    const playerTop = player.y - playerSize / 2;
    const playerBottom = player.y + playerSize / 2;
    
    const objLeft = gameObj.x - gameObj.w / 2;
    const objRight = gameObj.x + gameObj.w / 2;
    const objTop = gameObj.y - gameObj.h / 2;
    const objBottom = gameObj.y + gameObj.h / 2;
    
    return !(
        playerRight < objLeft ||
        playerLeft > objRight ||
        playerBottom < objTop ||
        playerTop > objBottom
    );
};

// ============================================
// FIX 4: Implementación de Swing Mode
// ============================================

// Añadir métodos de swing mode al PlayerState
const originalPlayerStateReset = window.PlayerState?.prototype?.reset;
if (originalPlayerStateReset) {
    window.PlayerState.prototype.reset = function() {
        originalPlayerStateReset.call(this);
        // Asegurar que isSwing está definido
        this.isSwing = false;
    };
}

// Implementación básica de enterSwingMode para el player
if (window.PlayerObject && !window.PlayerObject.prototype.enterSwingMode) {
    window.PlayerObject.prototype.enterSwingMode = function(savedState) {
        this.p.isSwing = true;
        this.p.isFlying = false;
        this.p.isBall = false;
        this.p.isWave = false;
        this.p.isUfo = false;
        this.p.isSpider = false;
        this.p.isBird = false;
        this.p.isDart = false;
        this.p.isRobot = false;
        this.p.isCube = false;
        
        this.p.y = savedState.y || 30;
        this.p.yVelocity = savedState.yVelocity || 0;
        this.p.gravityFlipped = savedState.gravityFlipped || false;
        this.p.upKeyDown = savedState.upKeyDown || false;
        this.p.upKeyPressed = savedState.upKeyPressed || false;
        this.p.queuedHold = savedState.queuedHold || false;
        this.p._orbActivationConsumedForPress = savedState.orbActivationConsumedForPress || false;
        this.p.mirrored = savedState.mirrored || false;
        this.p.isMini = savedState.isMini || false;
        
        // Configurar visibilidad
        this.setSwingVisible(true);
        this.setCubeVisible(false);
        this.setShipVisible(false);
        this.setBallVisible(false);
        this.setWaveVisible(false);
        this.setRobotVisible(false);
        this.setSpiderVisible(false);
        
        console.log('Swing mode activated');
    };
}

// Implementación básica de setSwingVisible
if (window.PlayerObject && !window.PlayerObject.prototype.setSwingVisible) {
    window.PlayerObject.prototype.setSwingVisible = function(visible) {
        if (this.swingSprite) {
            this.swingSprite.setVisible(visible);
        }
    };
}

// ============================================
// FIX 5: Optimización de rendimiento
// ============================================

// Función para limitar FPS en segundo plano
window.optimizeBackgroundPerformance = function() {
    let lastTime = Date.now();
    let frameCount = 0;
    let lastFpsUpdate = Date.now();
    
    return function() {
        const now = Date.now();
        frameCount++;
        
        if (now - lastFpsUpdate >= 1000) {
            const fps = frameCount;
            frameCount = 0;
            lastFpsUpdate = now;
            
            // Si el FPS es muy bajo, reducir calidad
            if (fps < 30 && window.game) {
                window.useLowQualityMode = true;
                if (window.game.renderer) {
                    window.game.renderer.antialias = false;
                }
            } else if (fps > 50) {
                window.useLowQualityMode = false;
            }
        }
        
        lastTime = now;
    };
}();

// ============================================
// FIX 6: Corrección de bugs de caché
// ============================================

// Asegurar que el cache manager esté inicializado
if (window.gameCache && typeof window.gameCache.init === 'function') {
    window.gameCache.init();
}

// ============================================
// FIX 7: Mejorar manejo de errores
// ============================================

// Wrapper para funciones críticas
window.safeExecute = function(fn, context, ...args) {
    try {
        return fn.apply(context, args);
    } catch (error) {
        console.error('Error en función crítica:', error);
        // Intentar continuar
        return null;
    }
};

// ============================================
// INICIALIZACIÓN
// ============================================

console.log('Web Dashers Fixes cargados');

// Aplicar fixes al cargar
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(() => {
        // Inicializar optimizaciones
        if (window.initOptimizations) {
            window.initOptimizations();
        }
    }, 0);
} else {
    document.addEventListener('DOMContentLoaded', () => {
        if (window.initOptimizations) {
            window.initOptimizations();
        }
    });
}
