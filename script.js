let pyodide = null;
let isReady = false;

const editor = document.getElementById('editor');
const output = document.getElementById('output');
const runBtn = document.getElementById('runBtn');
const clearBtn = document.getElementById('clearBtn');
const copyBtn = document.getElementById('copyBtn');
const clearOutputBtn = document.getElementById('clearOutputBtn');
const statusText = document.getElementById('statusText');
const statusIndicator = document.getElementById('statusIndicator');

function updateStatus(message, state = 'loading') {
    statusText.textContent = message;
    statusIndicator.className = 'indicator';
    if (state === 'ready') {
        statusIndicator.classList.add('ready');
    } else if (state === 'loading') {
        statusIndicator.classList.add('loading');
    }
}

function appendOutput(text, isError = false) {
    const outputDiv = output;
    const line = document.createElement('div');
    line.textContent = text;
    if (isError) {
        line.style.color = '#f48771';
    }
    outputDiv.appendChild(line);
    outputDiv.scrollTop = outputDiv.scrollHeight;
}

function clearOutput() {
    output.innerHTML = '';
}

async function initializePyodide() {
    try {
        updateStatus('Loading Python runtime...', 'loading');
        
        pyodide = await loadPyodide({
            indexURL: "https://cdn.jsdelivr.net/pyodide/v0.27.0/full/",
        });
        
        updateStatus('Loading packages...', 'loading');
        
        await pyodide.loadPackage(['micropip']);
        
        pyodide.runPython(`
import sys
from io import StringIO

class OutputCapture:
    def __init__(self):
        self.buffer = StringIO()
    
    def write(self, data):
        self.buffer.write(data)
    
    def flush(self):
        pass
    
    def get(self):
        return self.buffer.getvalue()

capture = OutputCapture()
sys.stdout = capture
sys.stderr = capture
        `);
        
        updateStatus('Ready', 'ready');
        isReady = true;
        runBtn.disabled = false;
        
        appendOutput('Python environment ready\n');
        
    } catch (error) {
        console.error('Init failed:', error);
        updateStatus('Failed to load', 'error');
        appendOutput(`Error: ${error.message}`, true);
    }
}

async function runCode() {
    if (!isReady || !pyodide) {
        appendOutput('Python environment not ready', true);
        return;
    }
    
    const code = editor.value;
    if (!code.trim()) {
        appendOutput('No code to run', true);
        return;
    }
    
    runBtn.disabled = true;
    runBtn.textContent = 'Running...';
    
    try {
        clearOutput();
        
        pyodide.runPython(`
capture.buffer = StringIO()
sys.stdout = capture
sys.stderr = capture
        `);
        
        const result = pyodide.runPython(code);
        const capturedOutput = pyodide.runPython('capture.get()');
        
        if (capturedOutput) {
            appendOutput(capturedOutput);
        }
        
        if (result !== undefined && result !== null && !capturedOutput) {
            appendOutput(String(result));
        }
        
    } catch (error) {
        appendOutput(`Error: ${error.message}`, true);
    } finally {
        runBtn.disabled = false;
        runBtn.textContent = 'Run Code';
    }
}

function clearEditor() {
    editor.value = '';
    editor.focus();
}

async function copyOutput() {
    const text = output.innerText;
    if (!text || text === 'Ready to run code...') {
        return;
    }
    
    try {
        await navigator.clipboard.writeText(text);
        const originalText = copyBtn.textContent;
        copyBtn.textContent = 'Copied!';
        setTimeout(() => {
            copyBtn.textContent = originalText;
        }, 1500);
    } catch (error) {
        appendOutput('Failed to copy', true);
    }
}

function loadSavedCode() {
    const saved = localStorage.getItem('python_code');
    if (saved) {
        editor.value = saved;
        appendOutput('Loaded saved code');
    }
}

function saveCode() {
    const code = editor.value;
    if (code) {
        localStorage.setItem('python_code', code);
        appendOutput('Code saved');
        setTimeout(() => {
            if (output.lastChild && output.lastChild.textContent === 'Code saved') {
                output.lastChild.remove();
            }
        }, 1500);
    }
}

runBtn.addEventListener('click', runCode);
clearBtn.addEventListener('click', clearEditor);
copyBtn.addEventListener('click', copyOutput);
clearOutputBtn.addEventListener('click', clearOutput);

editor.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        runCode();
    }
    
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveCode();
    }
});

editor.addEventListener('blur', () => {
    localStorage.setItem('python_code', editor.value);
});

loadSavedCode();
initializePyodide();
