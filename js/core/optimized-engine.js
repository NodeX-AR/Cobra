// COBRA Optimized Engine - Main Application
import { IDBFSManager } from './idbfs-manager.js';
import { PackageManager } from './package-manager.js';
import { RealtimeLogger } from '../ui/realtime-logger.js';

class OptimizedEngine {
    constructor() {
        this.pyodide = null;
        this.idbfs = null;
        this.packageManager = new PackageManager();
        this.logger = null;
        this.githubConfig = this.loadGitHubConfig();
        this.init();
    }

    async init() {
        this.logger = new RealtimeLogger(document.getElementById('outputArea'));
        this.setupEventListeners();
        this.detectDevice();
        this.updateUI();
        
        await this.initializePyodide();
        this.logger.showReady();
    }

    async initializePyodide() {
        this.logger.showInitializing();
        
        try {
            this.pyodide = await loadPyodide({
                indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.24.1/full/'
            });
            
            this.idbfs = new IDBFSManager(this.pyodide);
            await this.idbfs.mount();
            
            const cacheStats = this.idbfs.getCacheStats();
            document.getElementById('cacheStatus').textContent = `${cacheStats.packageCount} packages`;
            
        } catch (error) {
            console.error('Failed to initialize Pyodide:', error);
            this.logger.addError(`Failed to initialize: ${error.message}`);
        }
    }

    setupEventListeners() {
        document.getElementById('runBtn').addEventListener('click', () => this.executeCode());
        document.getElementById('clearOutputBtn').addEventListener('click', () => this.clearOutput());
        document.getElementById('settingsBtn').addEventListener('click', () => this.showSettings());
        document.getElementById('exampleSelect').addEventListener('change', (e) => this.loadExample(e.target.value));
        
        document.getElementById('saveSettingsBtn').addEventListener('click', () => this.saveSettings());
        document.getElementById('cancelSettingsBtn').addEventListener('click', () => this.hideSettings());
        document.getElementById('closeModalBtn').addEventListener('click', () => this.hideSettings());
    }

    async executeCode() {
        const code = document.getElementById('codeEditor').value;
        
        if (!code.trim()) {
            this.logger.addError('No code to execute');
            return;
        }
        
        const libraries = this.packageManager.detectLibraries(code);
        const needsCloud = this.packageManager.needsCloudExecution(libraries);
        
        this.logger.showExecutionStart(libraries);
        
        const loadingOverlay = document.getElementById('loadingOverlay');
        const loadingText = document.getElementById('loadingText');
        
        loadingOverlay.style.display = 'block';
        
        try {
            if (needsCloud && this.githubConfig.token && this.githubConfig.repo) {
                loadingText.textContent = 'Running on GitHub Actions...';
                await this.executeOnGitHub(code, libraries);
            } else {
                loadingText.textContent = 'Running locally...';
                await this.executeLocally(code, libraries);
            }
        } catch (error) {
            this.logger.addError(`Execution failed: ${error.message}`);
        } finally {
            loadingOverlay.style.display = 'none';
        }
    }

    async executeLocally(code, libraries) {
        const localLibraries = libraries.filter(lib => {
            const info = this.packageManager.getPackageInfo(lib);
            return info.mode === 'local';
        });
        
        for (const lib of localLibraries) {
            if (!this.idbfs.isPackageCached(lib)) {
                this.logger.addStep(`Loading ${lib}`, 'running');
                await this.pyodide.loadPackage(lib);
                await this.idbfs.cachePackage(lib);
                this.logger.updateStep(`Loading ${lib}`, 'completed');
            } else {
                this.logger.addOutput(`Using cached package: ${lib}`);
            }
        }
        
        this.pyodide.runPython(`
import sys
from io import StringIO
sys.stdout = StringIO()
sys.stderr = StringIO()
        `);
        
        try {
            await this.pyodide.runPythonAsync(code);
            const output = this.pyodide.runPython('sys.stdout.getvalue()');
            const error = this.pyodide.runPython('sys.stderr.getvalue()');
            
            if (output) this.logger.addOutput(output);
            if (error) this.logger.addError(error);
            if (!output && !error) this.logger.addOutput('Execution completed successfully');
            
        } catch (error) {
            this.logger.addError(error.message);
        }
    }

    async executeOnGitHub(code, libraries) {
        this.logger.addStep('Triggering GitHub Actions workflow', 'running');
        
        const cloudLibraries = libraries.filter(lib => {
            const info = this.packageManager.getPackageInfo(lib);
            return info.mode === 'cloud';
        });
        
        this.logger.addOutput(`Cloud libraries: ${cloudLibraries.join(', ')}`);
        
        const encodedCode = btoa(unescape(encodeURIComponent(code)));
        const [owner, repo] = this.githubConfig.repo.split('/');
        
        const workflowResponse = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${this.githubConfig.workflow}/dispatches`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `token ${this.githubConfig.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    ref: 'main',
                    inputs: { code: encodedCode }
                })
            }
        );
        
        if (!workflowResponse.ok) {
            throw new Error('Failed to trigger workflow');
        }
        
        this.logger.updateStep('Triggering GitHub Actions workflow', 'completed');
        this.logger.addStep('Waiting for runner', 'running');
        
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        this.logger.updateStep('Waiting for runner', 'completed');
        this.logger.addOutput('Workflow triggered. Check GitHub Actions tab for output.');
    }

    loadExample(exampleType) {
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
print("Sum:", arr.sum())
print("Min:", arr.min())
print("Max:", arr.max())`,
            
            pandas: `# Pandas Example
import pandas as pd

data = {
    'Name': ['Alice', 'Bob', 'Charlie', 'Diana'],
    'Age': [25, 30, 35, 28],
    'Salary': [50000, 60000, 75000, 55000]
}

df = pd.DataFrame(data)
print("Employee Data:")
print(df)
print(f"\\nAverage Age: {df['Age'].mean():.1f}")
print(f"Average Salary: ${df['Salary'].mean():,.0f}")`,
            
            torch: `# PyTorch Example
import torch

print(f"PyTorch version: {torch.__version__}")

# Create a tensor
x = torch.tensor([1.0, 2.0, 3.0, 4.0, 5.0])
print(f"Tensor: {x}")
print(f"Mean: {x.mean().item()}")
print(f"Sum: {x.sum().item()}")

# Matrix multiplication
a = torch.randn(3, 3)
b = torch.randn(3, 3)
c = torch.mm(a, b)
print(f"\\nMatrix multiplication shape: {c.shape}")`
        };
        
        if (examples[exampleType]) {
            document.getElementById('codeEditor').value = examples[exampleType];
        }
    }

    loadGitHubConfig() {
        try {
            const saved = localStorage.getItem('cobra_github_config');
            if (saved) {
                return JSON.parse(saved);
            }
        } catch (e) {}
        
        return { token: null, repo: null, workflow: 'execute-python.yml' };
    }

    saveGitHubConfig(token, repo, workflow) {
        this.githubConfig = { token, repo, workflow };
        localStorage.setItem('cobra_github_config', JSON.stringify(this.githubConfig));
        this.updateUI();
    }

    showSettings() {
        const modal = document.getElementById('settingsModal');
        document.getElementById('githubTokenInput').value = this.githubConfig.token || '';
        document.getElementById('githubRepoInput').value = this.githubConfig.repo || '';
        document.getElementById('workflowInput').value = this.githubConfig.workflow || 'execute-python.yml';
        modal.style.display = 'flex';
    }

    hideSettings() {
        document.getElementById('settingsModal').style.display = 'none';
    }

    saveSettings() {
        const token = document.getElementById('githubTokenInput').value.trim();
        const repo = document.getElementById('githubRepoInput').value.trim();
        const workflow = document.getElementById('workflowInput').value.trim();
        
        this.saveGitHubConfig(token, repo, workflow);
        this.hideSettings();
        this.updateUI();
        
        if (token && repo) {
            this.logger.addOutput('GitHub configuration saved');
        }
    }

    updateUI() {
        const githubStatus = document.getElementById('githubStatus');
        const executionMode = document.getElementById('executionMode');
        
        if (this.githubConfig.token && this.githubConfig.repo) {
            githubStatus.textContent = 'Connected';
            githubStatus.style.color = '#238636';
            executionMode.textContent = 'Hybrid';
        } else {
            githubStatus.textContent = 'Not configured';
            githubStatus.style.color = '#8b949e';
            executionMode.textContent = 'Local Only';
        }
    }

    detectDevice() {
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        document.getElementById('deviceInfo').textContent = isMobile ? 'Mobile' : 'Desktop';
    }

    clearOutput() {
        this.logger.clear();
        this.logger.addOutput('Output cleared');
    }
}

// Start the application
window.addEventListener('DOMContentLoaded', () => {
    new OptimizedEngine();
});
