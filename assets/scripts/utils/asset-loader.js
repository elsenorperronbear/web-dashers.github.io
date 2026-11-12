/**
 * Asset Loader Optimizado
 * Carga inteligente de assets para mejorar el rendimiento
 */

class AssetLoader {
    constructor(game) {
        this.game = game;
        this.loadedAssets = new Set();
        this.loadingQueue = [];
        this.priorityQueue = [];
        this.maxConcurrentLoads = window.maxConcurrentLoads || 6;
        this.activeLoads = 0;
        this.assetManifest = {};
        
        this.init();
    }
    
    init() {
        // Crear manifesto de assets
        this.createAssetManifest();
        
        // Iniciar carga de assets críticos
        this.loadCriticalAssets();
    }
    
    createAssetManifest() {
        // Definir assets críticos (se cargan primero)
        this.assetManifest.critical = [
            { id: 'phaser', url: 'assets/scripts/libs/phaser.min.js', type: 'script', critical: true },
            { id: 'pako', url: 'assets/scripts/libs/pako.min.js', type: 'script', critical: true },
            { id: 'allObjects', url: 'assets/scripts/game/allObjects.js', type: 'script', critical: true },
            { id: 'allLevels', url: 'assets/scripts/game/allLevels.js', type: 'script', critical: true },
            { id: 'GJ_GameSheet', url: 'assets/sheets/GJ_GameSheet.json', type: 'json', critical: true },
            { id: 'GJ_WebSheet', url: 'assets/sheets/GJ_WebSheet.json', type: 'json', critical: true }
        ];
        
        // Definir assets de sprites
        this.assetManifest.sprites = this.getSpriteAssets();
        
        // Definir assets de audio
        this.assetManifest.audio = this.getAudioAssets();
        
        // Definir assets de niveles
        this.assetManifest.levels = this.getLevelAssets();
    }
    
    getSpriteAssets() {
        const sprites = [];
        const spriteDirs = ['sprites', 'sheets'];
        
        // Esto se podría generar dinámicamente, pero por ahora usamos una lista estática
        return [
            { id: 'export', url: 'assets/sprites/export.png', type: 'image', priority: 'high' },
            { id: 'game_bg_01_001', url: 'assets/sprites/game_bg_01_001.png', type: 'image', priority: 'medium' },
            { id: 'loadingCircle', url: 'assets/sprites/loadingCircle.png', type: 'image', priority: 'high' }
        ];
    }
    
    getAudioAssets() {
        return [
            { id: 'BackOnTrack', url: 'assets/music/BackOnTrack.mp3', type: 'audio', priority: 'low' },
            { id: 'BaseAfterBase', url: 'assets/music/BaseAfterBase.mp3', type: 'audio', priority: 'low' },
            { id: 'endStart_02', url: 'assets/sfx/endStart_02.ogg', type: 'audio', priority: 'medium' },
            { id: 'explode_11', url: 'assets/sfx/explode_11.ogg', type: 'audio', priority: 'medium' }
        ];
    }
    
    getLevelAssets() {
        return [
            { id: 'level_1', url: 'assets/levels/1.txt', type: 'text', priority: 'high' },
            { id: 'level_2', url: 'assets/levels/2.txt', type: 'text', priority: 'medium' },
            { id: 'level_3', url: 'assets/levels/3.txt', type: 'text', priority: 'medium' }
        ];
    }
    
    async loadCriticalAssets() {
        if (!this.assetManifest.critical) return;
        
        console.log('Cargando assets críticos...');
        
        for (const asset of this.assetManifest.critical) {
            await this.loadAsset(asset, true);
        }
        
        console.log('Assets críticos cargados');
    }
    
    async loadAsset(asset, isCritical = false) {
        if (this.loadedAssets.has(asset.id)) {
            return this.getAsset(asset.id);
        }
        
        const queue = isCritical ? this.priorityQueue : this.loadingQueue;
        
        return new Promise((resolve, reject) => {
            queue.push({
                asset,
                resolve,
                reject
            });
            this.processQueue();
        });
    }
    
    async processQueue() {
        const queue = this.activeLoads < this.maxConcurrentLoads 
            ? this.priorityQueue.length > 0 ? this.priorityQueue : this.loadingQueue
            : [];
        
        while (this.activeLoads < this.maxConcurrentLoads && queue.length > 0) {
            const task = queue.shift();
            this.activeLoads++;
            
            this.loadSingleAsset(task.asset)
                .then(data => {
                    this.loadedAssets.add(task.asset.id);
                    task.resolve(data);
                })
                .catch(err => {
                    task.reject(err);
                })
                .finally(() => {
                    this.activeLoads--;
                    this.processQueue();
                });
        }
    }
    
    async loadSingleAsset(asset) {
        // Usar cache manager si está disponible
        if (window.gameCache) {
            try {
                const cached = await window.gameCache.getCachedFile(asset.url);
                if (cached) {
                    return cached;
                }
            } catch (e) {
                console.warn('Error al obtener de caché:', e);
            }
        }
        
        // Cargar desde la red
        const response = await fetch(asset.url);
        
        if (!response.ok) {
            throw new Error(`Failed to load ${asset.url}: ${response.status}`);
        }
        
        let data;
        switch (asset.type) {
            case 'script':
                // Los scripts ya se cargaron en el HTML
                return null;
            case 'json':
                data = await response.json();
                break;
            case 'image':
                data = await response.blob();
                break;
            case 'audio':
                data = await response.blob();
                break;
            case 'text':
                data = await response.text();
                break;
            default:
                data = await response.text();
        }
        
        // Guardar en caché
        if (window.gameCache) {
            await window.gameCache.cacheFile(asset.url, data, asset.type === 'image' || asset.type === 'audio');
        }
        
        return data;
    }
    
    getAsset(id) {
        // Implementar obtención de asset desde el almacén
        // Por ahora, solo verificamos si está cargado
        return this.loadedAssets.has(id);
    }
    
    preloadLevelAssets(levelId) {
        // Pre-cargar assets específicos de un nivel
        const levelAssets = this.getLevelDependencies(levelId);
        
        for (const asset of levelAssets) {
            this.loadAsset(asset, false);
        }
    }
    
    getLevelDependencies(levelId) {
        // Retornar assets necesarios para un nivel específico
        return [
            { id: `level_${levelId}`, url: `assets/levels/${levelId}.txt`, type: 'text', priority: 'high' },
            { id: `music_${levelId}`, url: `assets/music/${this.getLevelMusic(levelId)}.mp3`, type: 'audio', priority: 'medium' }
        ];
    }
    
    getLevelMusic(levelId) {
        const levelMusicMap = {
            '1': 'StereoMadness',
            '2': 'BackOnTrack',
            '3': 'Polargeist',
            // Añadir más mapeos según sea necesario
        };
        return levelMusicMap[levelId] || 'BackOnTrack';
    }
    
    getProgress() {
        const totalAssets = this.assetManifest.critical.length + 
                           this.assetManifest.sprites.length + 
                           this.assetManifest.audio.length;
        const loaded = this.loadedAssets.size;
        
        return {
            loaded: loaded,
            total: totalAssets,
            progress: (loaded / totalAssets) * 100
        };
    }
    
    clear() {
        this.loadedAssets.clear();
        this.loadingQueue = [];
        this.priorityQueue = [];
        this.activeLoads = 0;
    }
}

// Inicializar el asset loader cuando el juego esté listo
window.assetLoader = null;
window.initAssetLoader = function(game) {
    if (!window.assetLoader) {
        window.assetLoader = new AssetLoader(game);
    }
    return window.assetLoader;
};
