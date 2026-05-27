// IDBFS Manager - Persistent storage for Python packages
export class IDBFSManager {
    constructor(pyodideInstance) {
        this.pyodide = pyodideInstance;
        this.isMounted = false;
        this.cachedPackages = new Set();
        this.mountPoint = '/cached_packages';
    }

    async mount() {
        console.log('Mounting persistent storage...');
        
        try {
            this.pyodide.FS.mkdir(this.mountPoint);
        } catch (e) {
            // Directory already exists
        }
        
        this.pyodide.FS.mount(
            this.pyodide.FS.filesystems.IDBFS,
            { root: '.', fsName: 'cobra_packages' },
            this.mountPoint
        );
        
        await this.syncFromStorage();
        
        // Add to Python path
        this.pyodide.runPython(`
import sys
site_packages = '/cached_packages/lib/python3.11/site-packages'
if site_packages not in sys.path:
    sys.path.insert(0, site_packages)
        `);
        
        this.isMounted = true;
        console.log(`Mounted IDBFS with ${this.cachedPackages.size} cached packages`);
    }

    syncFromStorage() {
        return new Promise((resolve, reject) => {
            this.pyodide.FS.syncfs(true, (error) => {
                if (error) {
                    reject(error);
                } else {
                    this.scanCachedPackages();
                    resolve();
                }
            });
        });
    }

    syncToStorage() {
        return new Promise((resolve, reject) => {
            this.pyodide.FS.syncfs(false, (error) => {
                if (error) reject(error);
                else resolve();
            });
        });
    }

    scanCachedPackages() {
        try {
            const sitePackagesPath = `${this.mountPoint}/lib/python3.11/site-packages`;
            const packages = this.pyodide.FS.readdir(sitePackagesPath);
            packages.forEach(pkg => {
                if (pkg !== '.' && pkg !== '..') {
                    this.cachedPackages.add(pkg);
                }
            });
        } catch (e) {
            // Directory doesn't exist yet
        }
    }

    isPackageCached(packageName) {
        return this.cachedPackages.has(packageName);
    }

    async cachePackage(packageName) {
        if (this.isPackageCached(packageName)) {
            return true;
        }
        
        const sitePackagesPath = `${this.mountPoint}/lib/python3.11/site-packages/${packageName}`;
        
        try {
            this.pyodide.FS.mkdirTree(sitePackagesPath);
            
            // Mark as cached
            this.cachedPackages.add(packageName);
            await this.syncToStorage();
            
            console.log(`Cached package: ${packageName}`);
            return true;
        } catch (error) {
            console.error(`Failed to cache ${packageName}:`, error);
            return false;
        }
    }

    getCacheStats() {
        return {
            packageCount: this.cachedPackages.size,
            packages: Array.from(this.cachedPackages),
            mountPoint: this.mountPoint,
            isMounted: this.isMounted
        };
    }

    async clearCache() {
        try {
            const files = this.pyodide.FS.readdir(this.mountPoint);
            for (const file of files) {
                if (file !== '.' && file !== '..') {
                    this.pyodide.FS.unlink(`${this.mountPoint}/${file}`);
                }
            }
            
            this.cachedPackages.clear();
            await this.syncToStorage();
            console.log('Cache cleared');
        } catch (error) {
            console.error('Failed to clear cache:', error);
        }
    }
}
