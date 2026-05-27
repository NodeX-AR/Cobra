// Package Manager - Handles library detection and loading
export class PackageManager {
    constructor() {
        this.loadedPackages = new Set();
        this.packageDatabase = this.initializeDatabase();
    }

    initializeDatabase() {
        return {
            numpy: { size: 15, mode: 'local', supported: true },
            pandas: { size: 12, mode: 'local', supported: true },
            matplotlib: { size: 10, mode: 'local', supported: true },
            scipy: { size: 28, mode: 'local', supported: true },
            torch: { size: 150, mode: 'cloud', supported: true, note: 'Runs on GitHub Actions' },
            tensorflow: { size: 200, mode: 'cloud', supported: true, note: 'Runs on GitHub Actions' },
            transformers: { size: 180, mode: 'cloud', supported: true, note: 'Runs on GitHub Actions' },
            scikit_learn: { size: 30, mode: 'cloud', supported: true, note: 'Runs on GitHub Actions' }
        };
    }

    detectLibraries(code) {
        const detected = new Set();
        
        const patterns = [
            /import\s+([a-zA-Z_][a-zA-Z0-9_]*)/g,
            /from\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+import/g
        ];
        
        const standardLib = new Set([
            'sys', 'os', 'math', 'json', 're', 'datetime', 'random', 'time',
            'collections', 'itertools', 'functools', 'threading', 'socket',
            'subprocess', 'argparse', 'logging', 'hashlib', 'base64', 'csv',
            'sqlite3', 'xml', 'html', 'copy', 'glob', 'pathlib', 'statistics'
        ]);
        
        const aliasMap = {
            'np': 'numpy',
            'pd': 'pandas',
            'plt': 'matplotlib',
            'sklearn': 'scikit_learn'
        };
        
        for (const pattern of patterns) {
            let match;
            while ((match = pattern.exec(code)) !== null) {
                let libName = match[1];
                libName = aliasMap[libName] || libName;
                
                if (!standardLib.has(libName) && libName !== '__future__') {
                    detected.add(libName);
                }
            }
        }
        
        if (code.includes('np.') && !detected.has('numpy')) detected.add('numpy');
        if (code.includes('pd.') && !detected.has('pandas')) detected.add('pandas');
        if (code.includes('torch.') && !detected.has('torch')) detected.add('torch');
        
        return Array.from(detected);
    }

    getPackageInfo(packageName) {
        return this.packageDatabase[packageName] || { 
            size: 'unknown', 
            mode: 'cloud', 
            supported: true 
        };
    }

    needsCloudExecution(libraries) {
        for (const lib of libraries) {
            const info = this.getPackageInfo(lib);
            if (info.mode === 'cloud') {
                return true;
            }
        }
        return false;
    }
}
