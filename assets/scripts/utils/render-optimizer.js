/**
 * Render Optimizer
 * Optimiza el renderizado del juego para mejor rendimiento
 */

class RenderOptimizer {
    constructor(game) {
        this.game = game;
        this.stats = {
            frameCount: 0,
            lastFps: 60,
            lastFpsTime: Date.now(),
            drawCalls: 0,
            lastDrawCalls: 0,
            triangles: 0,
            lastTriangles: 0
        };
        
        this.qualitySettings = {
            high: {
                antialias: true,
                resolution: 1,
                maxParticles: 500,
                batchSize: 4096,
                shadowQuality: 'high',
                textureFiltering: 'linear'
            },
            medium: {
                antialias: false,
                resolution: 1,
                maxParticles: 300,
                batchSize: 2048,
                shadowQuality: 'medium',
                textureFiltering: 'linear'
            },
            low: {
                antialias: false,
                resolution: 0.75,
                maxParticles: 150,
                batchSize: 1024,
                shadowQuality: 'low',
                textureFiltering: 'nearest'
            },
            mobile: {
                antialias: false,
                resolution: 0.5,
                maxParticles: 100,
                batchSize: 512,
                shadowQuality: 'none',
                textureFiltering: 'nearest'
            }
        };
        
        this.currentQuality = window.isMobile ? 'mobile' : (window.useLowQualityMode ? 'low' : 'high');
        this.lastQualityCheck = Date.now();
        this.minFpsThreshold = 45;
        this.maxFpsThreshold = 55;
        
        this.init();
    }
    
    init() {
        if (!this.game) return;
        
        // Aplicar configuración inicial
        this.applyQualitySettings();
        
        // Iniciar monitor de FPS
        this.startFpsMonitor();
        
        // Optimizar sprites
        this.optimizeSprites();
        
        // Optimizar partículas
        this.optimizeParticles();
    }
    
    applyQualitySettings() {
        const settings = this.qualitySettings[this.currentQuality];
        
        if (!settings) return;
        
        // Aplicar configuración de antialiasing
        if (this.game.renderer) {
            this.game.renderer.antialias = settings.antialias;
        }
        
        // Aplicar configuración de resolución
        if (this.game.scale) {
            this.game.scale.setGameSize(
                screenWidth * settings.resolution,
                screenHeight * settings.resolution
            );
        }
        
        // Configurar partículas
        window.maxParticles = settings.maxParticles;
        
        console.log(`Calidad configurada: ${this.currentQuality}`);
    }
    
    startFpsMonitor() {
        const monitor = () => {
            this.stats.frameCount++;
            
            const now = Date.now();
            const elapsed = now - this.stats.lastFpsTime;
            
            if (elapsed >= 1000) {
                this.stats.lastFps = this.stats.frameCount;
                this.stats.frameCount = 0;
                this.stats.lastFpsTime = now;
                
                // Ajustar calidad según FPS
                this.adjustQualityBasedOnFps();
                
                // Loguear estadísticas (en desarrollo)
                if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
                    console.log(`FPS: ${this.stats.lastFps}, Calidad: ${this.currentQuality}`);
                }
            }
            
            requestAnimationFrame(monitor);
        };
        
        requestAnimationFrame(monitor);
    }
    
    adjustQualityBasedOnFps() {
        const fps = this.stats.lastFps;
        const now = Date.now();
        
        // Solo ajustar cada 5 segundos para evitar cambios bruscos
        if (now - this.lastQualityCheck < 5000) return;
        this.lastQualityCheck = now;
        
        if (fps < this.minFpsThreshold) {
            // FPS demasiado bajo, reducir calidad
            const qualityOrder = ['high', 'medium', 'low', 'mobile'];
            const currentIndex = qualityOrder.indexOf(this.currentQuality);
            
            if (currentIndex < qualityOrder.length - 1) {
                this.currentQuality = qualityOrder[currentIndex + 1];
                this.applyQualitySettings();
                console.log(`Reduciendo calidad a: ${this.currentQuality} (FPS: ${fps})`);
            }
        } else if (fps > this.maxFpsThreshold && this.currentQuality !== 'high') {
            // FPS bueno, aumentar calidad
            const qualityOrder = ['mobile', 'low', 'medium', 'high'];
            const currentIndex = qualityOrder.indexOf(this.currentQuality);
            
            if (currentIndex < qualityOrder.length - 1) {
                this.currentQuality = qualityOrder[currentIndex + 1];
                this.applyQualitySettings();
                console.log(`Aumentando calidad a: ${this.currentQuality} (FPS: ${fps})`);
            }
        }
    }
    
    optimizeSprites() {
        if (!this.game || !this.game.textures) return;
        
        // Configurar atlas de sprites para mejor rendimiento
        this.game.textures.on('add', (key, texture) => {
            // Optimizar texturas
            texture.setFilter(this.getTextureFilter());
            
            // Para texturas grandes, usar mipmaps si está disponible
            if (texture.width > 1024 || texture.height > 1024) {
                texture.generateMipmaps = true;
            }
        });
    }
    
    optimizeParticles() {
        // Configurar sistema de partículas
        if (this.game && this.game.add && this.game.add.particles) {
            const particleConfig = {
                maxParticles: window.maxParticles || 500,
                batchSize: this.qualitySettings[this.currentQuality].batchSize,
                blendMode: Phaser.BlendModes.ADD,
                
                // Configuración de emisiones
                emitZone: {
                    type: 'random',
                    source: new Phaser.Geom.Rectangle(0, 0, 100, 100)
                }
            };
            
            // Aplicar configuración a todos los emisiones de partículas
            this.game.events.on('particleEmitterCreated', (emitter) => {
                emitter.maxParticles = Math.min(emitter.maxParticles, particleConfig.maxParticles);
            });
        }
    }
    
    getTextureFilter() {
        return this.qualitySettings[this.currentQuality].textureFiltering;
    }
    
    setQuality(quality) {
        if (this.qualitySettings[quality]) {
            this.currentQuality = quality;
            this.applyQualitySettings();
        }
    }
    
    getQuality() {
        return this.currentQuality;
    }
    
    getStats() {
        return { ...this.stats };
    }
    
    reduceQuality() {
        const qualityOrder = ['high', 'medium', 'low', 'mobile'];
        const currentIndex = qualityOrder.indexOf(this.currentQuality);
        
        if (currentIndex < qualityOrder.length - 1) {
            this.currentQuality = qualityOrder[currentIndex + 1];
            this.applyQualitySettings();
        }
    }
    
    increaseQuality() {
        const qualityOrder = ['mobile', 'low', 'medium', 'high'];
        const currentIndex = qualityOrder.indexOf(this.currentQuality);
        
        if (currentIndex < qualityOrder.length - 1) {
            this.currentQuality = qualityOrder[currentIndex + 1];
            this.applyQualitySettings();
        }
    }
    
    // Funciones para optimizar objetos específicos
    optimizeSprite(sprite) {
        if (!sprite) return;
        
        // Configurar blend mode
        if (sprite.setBlendMode) {
            sprite.setBlendMode(Phaser.BlendModes.NORMAL);
        }
        
        // Optimizar renderizado
        sprite.setPipeline('Sprite');
        
        // Para sprites estáticos, desactivar actualización
        if (sprite.body && sprite.body.type === Phaser.Physics.Arcade.STATIC_BODY) {
            sprite.setStatic(true);
        }
    }
    
    batchSprites(sprites) {
        if (!sprites || !sprites.length) return;
        
        // Agrupar sprites por textura para minimizar cambios de estado
        const batches = {};
        
        for (const sprite of sprites) {
            if (!sprite || !sprite.texture) continue;
            
            const key = sprite.texture.key;
            if (!batches[key]) {
                batches[key] = [];
            }
            batches[key].push(sprite);
        }
        
        // Procesar cada batch
        for (const [textureKey, batch] of Object.entries(batches)) {
            // Aplicar optimizaciones a cada batch
            for (const sprite of batch) {
                this.optimizeSprite(sprite);
            }
        }
    }
}

// Inicializar el render optimizer
window.renderOptimizer = null;
window.initRenderOptimizer = function(game) {
    if (!window.renderOptimizer) {
        window.renderOptimizer = new RenderOptimizer(game);
    }
    return window.renderOptimizer;
};
