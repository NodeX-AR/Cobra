// COBRA Engine - No user configuration needed
let pyodide = null;
let cachedPackages = new Set();

const codeEditor = document.getElementById('codeEditor');
const outputArea = document.getElementById('outputArea');
const runBtn = document.getElementById('runBtn');
const clearBtn = document.getElementById('clearBtn');
const exampleSelect = document.getElementById('exampleSelect');
const statusText = document.getElementById('statusText');
const modeText = document.getElementById('modeText');
const cacheText = document.getElementById('cacheText');
const loadingOverlay = document.getElementById('loadingOverlay');
const loadingMessage = document.getElementById('loadingMessage');

const STANDARD_LIB = new Set([
    'sys', 'os', 'math', 'json', 're', 'datetime', 'random', 'time',
    'collections', 'itertools', 'functools', 'threading', 'socket',
    'subprocess', 'argparse', 'logging', 'hashlib', 'base64', 'csv',
    'sqlite3', 'xml', 'html', 'copy', 'glob', 'pathlib', 'statistics'
]);

const LIBRARY_DB = {
    numpy: { size: 15, mode: 'local' },
    pandas: { size: 12, mode: 'local' },
    matplotlib: { size: 10, mode: 'local' },
    scipy: { size: 28, mode: 'cloud' },
    torch: { size: 150, mode: 'cloud' },
    tensorflow: { size: 200, mode: 'cloud' },
    transformers: { size: 180, mode: 'cloud' },
    scikit_learn: { size: 30, mode: 'cloud' }
};

function log(message, type = 'info') {
    const line = document.createElement('div');
    line.className = `log-line ${type}`;
    line.textContent = message;
    outputArea.appendChild(line);
    outputArea.scrollTop = outputArea.scrollHeight;
}

function clearOutput() {
    outputArea.innerHTML = '';
    log('Output cleared');
}

function detectLibraries(code) {
    const detected = new Set();
    const importPattern = /^(?:from|import)\s+([a-zA-Z_][a-zA-Z0-9_]*)/gm;
    let match;
    
    const aliases = { 'np': 'numpy', 'pd': 'pandas', 'plt': 'matplotlib', 'torch': 'torch' };
    
    while ((match = importPattern.exec(code)) !== null) {
        let lib = match[1];
        lib = aliases[lib] || lib;
        if (!STANDARD_LIB.has(lib) && lib !== '__future__') {
            detected.add(lib);
        }
    }
    
    if (code.includes('np.') && !detected.has('numpy')) detected.add('numpy');
    if (code.includes('pd.') && !detected.has('pandas')) detected.add('pandas');
    if (code.includes('torch.') && !detected.has('torch')) detected.add('torch');
    
    return Array.from(detected);
}

function needsCloudExecution(libraries) {
    for (const lib of libraries) {
        if (LIBRARY_DB[lib] && LIBRARY_DB[lib].mode === 'cloud') {
            return true;
        }
    }
    return false;
}

async function loadLocalLibrary(lib) {
    if (cachedPackages.has(lib)) {
        log(`Using cached package: ${lib}`);
        return true;
    }
    
    log(`Downloading ${lib}...`);
    try {
        await pyodide.loadPackage(lib);
        cachedPackages.add(lib);
        updateCacheDisplay();
        log(`Loaded ${lib}`);
        return true;
    } catch (err) {
        log(`Failed to load ${lib}: ${err.message}`, 'error');
        return false;
    }
}

async function executeLocally(code, libraries) {
    for (const lib of libraries) {
        if (LIBRARY_DB[lib] && LIBRARY_DB[lib].mode === 'local') {
            await loadLocalLibrary(lib);
        }
    }
    
    pyodide.runPython(`
import sys
from io import StringIO
sys.stdout = StringIO()
sys.stderr = StringIO()
    `);
    
    try {
        await pyodide.runPythonAsync(code);
        const output = pyodide.runPython('sys.stdout.getvalue()');
        const error = pyodide.runPython('sys.stderr.getvalue()');
        
        if (output) log(output);
        if (error) log(error, 'error');
        if (!output && !error) log('Execution completed');
    } catch (err) {
        log(`Error: ${err.message}`, 'error');
    }
}

async function executeOnCloud(code, libraries) {
    const cloudLibs = libraries.filter(lib => LIBRARY_DB[lib] && LIBRARY_DB[lib].mode === 'cloud');
    log(`Cloud execution for: ${cloudLibs.join(', ')}`);
    log('Triggering GitHub Actions workflow...');
    
    const encodedCode = btoa(unescape(encodeURIComponent(code)));
    
    try {
        const response = await fetch('/api/trigger-workflow', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: encodedCode, libraries: cloudLibs })
        });
        
        if (response.ok) {
            const result = await response.json();
            log(`Workflow triggered: ${result.run_id}`);
            log('Check GitHub Actions tab for output');
            log(`Link: ${result.url}`);
        } else {
            throw new Error('Failed to trigger workflow');
        }
    } catch (err) {
        log(`Cloud execution error: ${err.message}`, 'error');
        log('Falling back to local execution...');
        await executeLocally(code, libraries.filter(l => LIBRARY_DB[l]?.mode !== 'cloud'));
    }
}

async function executeCode() {
    const code = codeEditor.value;
    if (!code.trim()) {
        log('No code to execute', 'error');
        return;
    }
    
    const libraries = detectLibraries(code);
    const useCloud = needsCloudExecution(libraries);
    
    log('='.repeat(50));
    log(`Executing at ${new Date().toLocaleTimeString()}`);
    
    if (libraries.length > 0) {
        log(`Detected libraries: ${libraries.join(', ')}`);
    }
    
    loadingOverlay.style.display = 'block';
    modeText.textContent = useCloud ? 'Cloud' : 'Local';
    
    try {
        if (!pyodide) {
            loadingMessage.textContent = 'Loading Python...';
            await initPyodide();
        }
        
        if (useCloud) {
            loadingMessage.textContent = 'Cloud execution...';
            await executeOnCloud(code, libraries);
        } else {
            loadingMessage.textContent = 'Local execution...';
            await executeLocally(code, libraries);
        }
    } catch (err) {
        log(`Execution failed: ${err.message}`, 'error');
    } finally {
        loadingOverlay.style.display = 'none';
        modeText.textContent = useCloud ? 'Cloud (last)' : 'Local';
        log('='.repeat(50));
    }
}

async function initPyodide() {
    statusText.textContent = 'Loading...';
    log('Loading Python runtime...');
    
    try {
        pyodide = await loadPyodide({
            indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.24.1/full/'
        });
        
        // Mount persistent storage
        try {
            pyodide.FS.mkdir('/cached_packages');
            pyodide.FS.mount(pyodide.FS.filesystems.IDBFS, { root: '.' }, '/cached_packages');
            pyodide.FS.syncfs(true, () => {});
        } catch (e) {}
        
        statusText.textContent = 'Ready';
        log('Python ready');
        
        // Load cached packages
        updateCacheDisplay();
        
    } catch (err) {
        statusText.textContent = 'Error';
        log(`Failed to load: ${err.message}`, 'error');
    }
}

function updateCacheDisplay() {
    cacheText.textContent = `${cachedPackages.size} packages`;
}

function loadExample(type) {
    const examples = {
        basic: `# Basic Python Example
print("Hello from COBRA")
print("2 + 2 =", 2 + 2)

for i in range(5):
    print(f"Count: {i}")`,
        
        numpy: `# NumPy Example
import numpy as np

arr = np.array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
print("Array:", arr)
print("Mean:", arr.mean())
print("Standard Deviation:", arr.std())
print("Sum:", arr.sum())`,
        
        pandas: `# Pandas Example
import pandas as pd

data = {
    'Name': ['Alice', 'Bob', 'Charlie', 'Diana'],
    'Age': [25, 30, 35, 28],
    'Score': [85, 92, 88, 95]
}

df = pd.DataFrame(data)
print("Data:")
print(df)
print(f"Average Age: {df['Age'].mean():.1f}")
print(f"Average Score: {df['Score'].mean():.1f}")`,
        
        torch: `# PyTorch Example
import torch

print(f"PyTorch version: {torch.__version__}")

x = torch.tensor([1.0, 2.0, 3.0, 4.0, 5.0])
print(f"Tensor: {x}")
print(f"Mean: {x.mean().item()}")
print(f"Sum: {x.sum().item()}")

a = torch.randn(3, 3)
b = torch.randn(3, 3)
c = torch.mm(a, b)
print(f"Matrix multiplication shape: {c.shape}")`
    };
    
    if (examples[type]) {
        codeEditor.value = examples[type];
        log(`Loaded ${type} example`);
    }
}

function setupEventListeners() {
    runBtn.addEventListener('click', executeCode);
    clearBtn.addEventListener('click', clearOutput);
    exampleSelect.addEventListener('change', (e) => {
        if (e.target.value) {
            loadExample(e.target.value);
            e.target.value = '';
        }
    });
    
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            executeCode();
        }
    });
}

function init() {
    setupEventListeners();
    log('COBRA Python IDE Ready');
    log('Light libraries run locally, heavy libraries use cloud');
    initPyodide();
}

init();
