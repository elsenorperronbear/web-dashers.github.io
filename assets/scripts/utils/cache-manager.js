/**
 * Game Cache Manager - Versión Optimizada
 * Usa tanto IndexedDB (para archivos grandes) como localStorage (para archivos pequeños)
 * Integra con PerformanceOptimizer para mejor gestión de recursos
 */

class GameCacheManager {
    constructor() {
        this.CACHE_PREFIX = 'webdash_cache_';
        this.CACHE_VERSION_KEY = 'webdash_cache_version';
        this.CACHE_VERSION = '2.0.0';
        this.CACHE_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 días
        this.cachedFiles = new Map();
        this.loadingPromises = new Map();
        this.largeFileThreshold = 1024 * 1024; // 1MB - archivos más grandes van a IndexedDB
    }
    
    /**
     * Verifica si la caché es válida
     */
    isCacheValid() {
        const cachedVersion = localStorage.getItem(this.CACHE_VERSION_KEY);
        return cachedVersion === this.CACHE_VERSION;
    }
    
    /**
     * Limpia toda la caché
     */
    clearCache() {
        // Limpiar localStorage
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
            if (key.startsWith(this.CACHE_PREFIX)) {
                localStorage.removeItem(key);
            }
        });
        localStorage.removeItem(this.CACHE_VERSION_KEY);
        
        // Limpiar IndexedDB a través de PerformanceOptimizer
        if (window.performanceOptimizer) {
            window.performanceOptimizer.clearAllCache();
        }
        
        this.cachedFiles.clear();
        this.loadingPromises.clear();
    }
    
    /**
     * Genera una clave de caché para una URL
     */
    getCacheKey(url) {
        return this.CACHE_PREFIX + btoa(encodeURIComponent(url)).replace(/[^a-zA-Z0-9]/g, '');
    }
    
    /**
     * Verifica si un archivo está en caché
     */
    async isFileCached(url) {
        // Primero verificar en memoria
        if (this.cachedFiles.has(url)) {
            return true;
        }
        
        // Verificar en PerformanceOptimizer (IndexedDB)
        if (window.performanceOptimizer) {
            const cached = await window.performanceOptimizer.getCachedFile(url);
            if (cached) {
                this.cachedFiles.set(url, cached);
                return true;
            }
        }
        
        // Verificar en localStorage (para compatibilidad)
        const cacheKey = this.getCacheKey(url);
        const cached = localStorage.getItem(cacheKey);
        
        if (!cached) return false;
        
        try {
            const data = JSON.parse(cached);
            if (Date.now() - data.timestamp < this.CACHE_EXPIRY) {
                this.cachedFiles.set(url, data.content);
                return true;
            } else {
                localStorage.removeItem(cacheKey);
                return false;
            }
        } catch (e) {
            localStorage.removeItem(cacheKey);
            return false;
        }
    }
    
    /**
     * Obtiene un archivo de la caché
     */
    async getCachedFile(url) {
        // Verificar en memoria primero
        if (this.cachedFiles.has(url)) {
            return this.cachedFiles.get(url);
        }
        
        // Verificar en PerformanceOptimizer
        if (window.performanceOptimizer) {
            const cached = await window.performanceOptimizer.getCachedFile(url);
            if (cached) {
                this.cachedFiles.set(url, cached);
                return cached;
            }
        }
        
        // Verificar en localStorage
        const cacheKey = this.getCacheKey(url);
        const cached = localStorage.getItem(cacheKey);
        
        if (!cached) return null;
        
        try {
            const data = JSON.parse(cached);
            if (Date.now() - data.timestamp < this.CACHE_EXPIRY) {
                this.cachedFiles.set(url, data.content);
                return data.content;
            } else {
                localStorage.removeItem(cacheKey);
                return null;
            }
        } catch (e) {
            localStorage.removeItem(cacheKey);
            return null;
        }
    }
    
    /**
     * Guarda un archivo en la caché
     */
    async cacheFile(url, content, isLargeFile = false) {
        // Determinar si es un archivo grande
        const contentSize = typeof content === 'string' ? content.length : content.byteLength || 0;
        const shouldUseIndexedDB = isLargeFile || contentSize > this.largeFileThreshold;
        
        // Guardar en memoria
        this.cachedFiles.set(url, content);
        
        // Guardar en PerformanceOptimizer (IndexedDB para archivos grandes)
        if (shouldUseIndexedDB && window.performanceOptimizer) {
            return window.performanceOptimizer.cacheFile(url, content, true);
        }
        
        // Guardar en localStorage para archivos pequeños
        const cacheKey = this.getCacheKey(url);
        const data = {
            content: content,
            timestamp: Date.now(),
            url: url
        };
        
        try {
            localStorage.setItem(cacheKey, JSON.stringify(data));
            return true;
        } catch (e) {
            console.warn('Error al guardar en caché:', url, e);
            
            if (e.name === 'QuotaExceededError') {
                this.clearOldestCache();
                try {
                    localStorage.setItem(cacheKey, JSON.stringify(data));
                    return true;
                } catch (e2) {
                    console.warn('No se pudo guardar después de limpieza:', url);
                    return false;
                }
            }
            return false;
        }
    }
    
    /**
     * Limpia las entradas más antiguas de la caché
     */
    clearOldestCache() {
        const keys = Object.keys(localStorage)
            .filter(key => key.startsWith(this.CACHE_PREFIX))
            .map(key => {
                try {
                    const data = JSON.parse(localStorage.getItem(key));
                    return { key, timestamp: data.timestamp || 0 };
                } catch (e) {
                    return { key, timestamp: 0 };
                }
            })
            .sort((a, b) => a.timestamp - b.timestamp);
        
        // Eliminar el 25% más antiguo
        const toRemove = Math.ceil(keys.length * 0.25);
        for (let i = 0; i < toRemove; i++) {
            localStorage.removeItem(keys[i].key);
        }
    }
    
    /**
     * Carga un archivo desde la red o caché
     */
    async loadFile(url, options = {}) {
        const { forceReload = false, isLargeFile = false } = options;
        
        // Verificar si ya está cargado en memoria
        if (!forceReload && this.cachedFiles.has(url)) {
            return this.cachedFiles.get(url);
        }
        
        // Verificar si está en caché
        if (!forceReload) {
            const cached = await this.getCachedFile(url);
            if (cached) {
                return cached;
            }
        }
        
        // Verificar si ya hay una promesa de carga
        if (this.loadingPromises.has(url)) {
            return this.loadingPromises.get(url);
        }
        
        // Crear nueva promesa de carga
        const promise = this.fetchAndCache(url, isLargeFile);
        this.loadingPromises.set(url, promise);
        
        // Limpiar la promesa después de completarse
        promise.finally(() => {
            this.loadingPromises.delete(url);
        });
        
        return promise;
    }
    
    /**
     * Descarga un archivo y lo guarda en caché
     */
    async fetchAndCache(url, isLargeFile) {
        try {
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            let content;
            const contentType = response.headers.get('content-type');
            
            if (contentType && contentType.includes('application/json')) {
                content = await response.json();
            } else if (contentType && contentType.includes('text')) {
                content = await response.text();
            } else {
                const arrayBuffer = await response.arrayBuffer();
                content = this.arrayBufferToBase64(arrayBuffer);
            }
            
            // Guardar en caché
            await this.cacheFile(url, content, isLargeFile);
            
            return content;
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
     * Inicializa el gestor de caché
     */
    init() {
        if (!this.isCacheValid()) {
            this.clearCache();
            localStorage.setItem(this.CACHE_VERSION_KEY, this.CACHE_VERSION);
        }
        
        // Inicializar PerformanceOptimizer si existe
        if (window.performanceOptimizer) {
            window.performanceOptimizer.initDB();
        }
    }
    
    /**
     * Obtiene estadísticas de la caché
     */
    getCacheStats() {
        const localStorageKeys = Object.keys(localStorage)
            .filter(key => key.startsWith(this.CACHE_PREFIX));
        
        let totalSize = 0;
        let validEntries = 0;
        
        localStorageKeys.forEach(key => {
            const size = localStorage.getItem(key).length;
            totalSize += size;
            
            try {
                const data = JSON.parse(localStorage.getItem(key));
                if (Date.now() - data.timestamp < this.CACHE_EXPIRY) {
                    validEntries++;
                }
            } catch (e) {
                // Entrada inválida
            }
        });
        
        return {
            totalEntries: localStorageKeys.length + this.cachedFiles.size,
            validEntries: validEntries + this.cachedFiles.size,
            totalSize: totalSize,
            totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2),
            inMemory: this.cachedFiles.size
        };
    }
    
    /**
     * Pre-carga múltiples archivos
     */
    async preloadFiles(urls, options = {}) {
        const promises = urls.map(url => this.loadFile(url, options));
        return Promise.allSettled(promises);
    }
}

// Inicializar el gestor de caché global
window.gameCache = new GameCacheManager();
