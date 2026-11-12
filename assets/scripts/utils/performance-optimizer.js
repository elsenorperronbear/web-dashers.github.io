/**
 * Web Dashers Performance Optimizer
 * Optimiza el rendimiento del juego mediante:
 * - Caché en IndexedDB para archivos grandes
 * - Compresión de assets
 * - Carga lazy de recursos
 * - Gestión inteligente de memoria
 */

class PerformanceOptimizer {
    constructor() {
        this.DB_NAME = 'WebDashersCache';
        this.DB_VERSION = 2;
        this.STORE_NAME = 'assets';
        this.db = null;
        this.cachePromises = new Map();
        this.loadingQueue = [];
        this.maxConcurrentLoads = 6;
        this.activeLoads = 0;
        this.stats = {
            cacheHits: 0,
            cacheMisses: 0,
            bytesLoaded: 0,
            bytesCached: 0
        };
        
        this.initDB();
    }
    
    /**
     * Inicializa la base de datos IndexedDB
     */
    async initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);
            
            request.onerror = (event) => {
                console.warn('IndexedDB no disponible, usando fallback a localStorage');
                this.db = null;
                resolve();
            };
            
            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve();
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.STORE_NAME)) {
                    db.createObjectStore(this.STORE_NAME, { keyPath: 'url' });
                }
            };
        });
    }
    
    /**
     * Verifica si IndexedDB está disponible
     */
    isIndexedDBAvailable() {
        return this.db !== null;
    }
    
    /**
     * Obtiene un archivo de la caché (IndexedDB o localStorage)
     */
    async getCachedFile(url) {
        if (!url) return null;
        
        // Primero intenta con IndexedDB
        if (this.isIndexedDBAvailable()) {
            try {
                const tx = this.db.transaction(this.STORE_NAME, 'readonly');
                const store = tx.objectStore(this.STORE_NAME);
                const request = store.get(url);
                
                return new Promise((resolve) => {
                    request.onsuccess = () => {
                        if (request.result) {
                            this.stats.cacheHits++;
                            this.stats.bytesLoaded += request.result.data.length;
                            resolve(request.result.data);
                        } else {
                            this.stats.cacheMisses++;
                            resolve(null);
                        }
                    };
                    request.onerror = () => resolve(null);
                });
            } catch (e) {
                console.warn('Error al leer de IndexedDB:', e);
            }
        }
        
        // Fallback a localStorage (para datos pequeños)
        try {
            const cached = localStorage.getItem(`wd_cache_${url}`);
            if (cached) {
                const data = JSON.parse(cached);
                if (data && data.data) {
                    this.stats.cacheHits++;
                    return data.data;
                }
            }
        } catch (e) {
            console.warn('Error al leer de localStorage:', e);
        }
        
        return null;
    }
    
    /**
     * Guarda un archivo en la caché
     */
    async cacheFile(url, data, isLargeFile = false) {
        if (!url || !data) return false;
        
        // Para archivos grandes, usa IndexedDB
        if (isLargeFile && this.isIndexedDBAvailable()) {
            try {
                const tx = this.db.transaction(this.STORE_NAME, 'readwrite');
                const store = tx.objectStore(this.STORE_NAME);
                
                const cacheEntry = {
                    url: url,
                    data: data,
                    timestamp: Date.now(),
                    size: data.length
                };
                
                store.put(cacheEntry);
                this.stats.bytesCached += data.length;
                return true;
            } catch (e) {
                console.warn('Error al guardar en IndexedDB:', e);
                return false;
            }
        }
        
        // Para archivos pequeños, usa localStorage
        if (data.length < 1024 * 1024) { // Menos de 1MB
            try {
                localStorage.setItem(`wd_cache_${url}`, JSON.stringify({
                    data: data,
                    timestamp: Date.now()
                }));
                this.stats.bytesCached += data.length;
                return true;
            } catch (e) {
                console.warn('Error al guardar en localStorage:', e);
                // Limpiar caché si está lleno
                this.clearOldCache();
                try {
                    localStorage.setItem(`wd_cache_${url}`, JSON.stringify({
                        data: data,
                        timestamp: Date.now()
                    }));
                    return true;
                } catch (e2) {
                    return false;
                }
            }
        }
        
        return false;
    }
    
    /**
     * Limpia entradas antiguas de la caché
     */
    clearOldCache() {
        if (this.isIndexedDBAvailable()) {
            const tx = this.db.transaction(this.STORE_NAME, 'readwrite');
            const store = tx.objectStore(this.STORE_NAME);
            const request = store.openCursor();
            
            request.onsuccess = () => {
                const cursor = request.result;
                if (cursor) {
                    const entry = cursor.value;
                    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
                    if (entry.timestamp < oneWeekAgo) {
                        cursor.delete();
                    }
                    cursor.continue();
                }
            };
        }
        
        // Limpiar localStorage
        const keys = Object.keys(localStorage).filter(k => k.startsWith('wd_cache_'));
        const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        
        keys.forEach(key => {
            try {
                const data = JSON.parse(localStorage.getItem(key));
                if (data && data.timestamp < oneWeekAgo) {
                    localStorage.removeItem(key);
                }
            } catch (e) {
                localStorage.removeItem(key);
            }
        });
    }
    
    /**
     * Carga un archivo con caché inteligente
     */
    async loadFile(url, options = {}) {
        const { isLargeFile = false, compress = false } = options;
        
        // Verificar si ya está en caché
        const cached = await this.getCachedFile(url);
        if (cached) {
            return cached;
        }
        
        // Usar cola de carga para evitar sobrecargar el navegador
        return new Promise((resolve, reject) => {
            this.loadingQueue.push({
                url,
                isLargeFile,
                compress,
                resolve,
                reject
            });
            this.processQueue();
        });
    }
    
    /**
     * Procesa la cola de carga
     */
    async processQueue() {
        while (this.activeLoads < this.maxConcurrentLoads && this.loadingQueue.length > 0) {
            const task = this.loadingQueue.shift();
            this.activeLoads++;
            
            this.loadSingleFile(task)
                .then(data => task.resolve(data))
                .catch(err => task.reject(err))
                .finally(() => {
                    this.activeLoads--;
                    this.processQueue();
                });
        }
    }
    
    /**
     * Carga un solo archivo
     */
    async loadSingleFile(task) {
        const { url, isLargeFile, compress } = task;
        
        try {
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            let data;
            const contentType = response.headers.get('content-type');
            
            if (contentType && contentType.includes('application/json')) {
                data = await response.json();
            } else if (contentType && contentType.includes('text')) {
                data = await response.text();
            } else {
                const arrayBuffer = await response.arrayBuffer();
                data = this.arrayBufferToBase64(arrayBuffer);
            }
            
            // Guardar en caché
            await this.cacheFile(url, data, isLargeFile);
            
            return data;
        } catch (error) {
            console.error('Error loading file:', url, error);
            throw error;
        }
    }
    
    /**
     * Convierte ArrayBuffer a Base64
     */
    arrayBufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }
    
    /**
     * Convierte Base64 a ArrayBuffer
     */
    base64ToArrayBuffer(base64) {
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes.buffer;
    }
    
    /**
     * Obtiene estadísticas de rendimiento
     */
    getStats() {
        return { ...this.stats };
    }
    
    /**
     * Limpia toda la caché
     */
    async clearAllCache() {
        if (this.isIndexedDBAvailable()) {
            const tx = this.db.transaction(this.STORE_NAME, 'readwrite');
            const store = tx.objectStore(this.STORE_NAME);
            store.clear();
        }
        
        const keys = Object.keys(localStorage).filter(k => k.startsWith('wd_cache_'));
        keys.forEach(key => localStorage.removeItem(key));
        
        this.stats = {
            cacheHits: 0,
            cacheMisses: 0,
            bytesLoaded: 0,
            bytesCached: 0
        };
    }
    
    /**
     * Configuración de gráficos optimizados
     */
    getGraphicsSettings() {
        return {
            enableGlow: true,
            blendMode: Phaser.BlendModes.ADD,
            useLowQuality: false,
            maxParticles: 500,
            batchSize: 2000
        };
    }
    
    /**
     * Optimiza el renderizado
     */
    optimizeRendering(game) {
        if (!game || !game.renderer) return;
        
        // Configurar antialiasing
        game.renderer.antialias = false;
        
        // Optimizar el renderizado de sprites
        game.renderer.roundPixels = true;
        
        // Configurar el clear color
        game.renderer.setClearColor(0, 0, 0, 1);
    }
    
    /**
     * Pre-carga assets críticos
     */
    async preloadCriticalAssets(game, assets) {
        const criticalAssets = assets.filter(a => a.critical);
        
        for (const asset of criticalAssets) {
            await this.loadFile(asset.url, { isLargeFile: asset.isLarge });
        }
    }
    
    /**
     * Carga assets en segundo plano
     */
    loadInBackground(assets) {
        // Implementar carga en segundo plano usando requestIdleCallback
        const loadChunk = (index) => {
            if (index >= assets.length) return;
            
            requestIdleCallback(() => {
                const asset = assets[index];
                this.loadFile(asset.url, { isLargeFile: asset.isLarge })
                    .catch(() => {});
                loadChunk(index + 1);
            }, { timeout: 1000 });
        };
        
        loadChunk(0);
    }
}

// Exportar para uso global
window.performanceOptimizer = new PerformanceOptimizer();
