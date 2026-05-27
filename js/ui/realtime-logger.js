// Real-time Logger for execution progress
export class RealtimeLogger {
    constructor(outputElement) {
        this.output = outputElement;
        this.steps = [];
    }

    clear() {
        this.steps = [];
        if (this.output) {
            this.output.innerHTML = '';
        }
    }

    addStep(stepName, status = 'pending') {
        const step = {
            id: Date.now() + Math.random(),
            name: stepName,
            status: status,
            timestamp: new Date()
        };
        this.steps.push(step);
        this.render();
        return step;
    }

    updateStep(stepName, status, message = null) {
        const step = this.steps.find(s => s.name === stepName);
        if (step) {
            step.status = status;
            if (message) {
                step.message = message;
            }
            this.render();
        }
    }

    addOutput(text) {
        const line = document.createElement('div');
        line.className = 'log-step completed';
        line.textContent = text;
        this.output.appendChild(line);
        this.scrollToBottom();
    }

    addError(text) {
        const line = document.createElement('div');
        line.className = 'log-step failed';
        line.textContent = text;
        this.output.appendChild(line);
        this.scrollToBottom();
    }

    render() {
        if (!this.output) return;
        
        const stepsHtml = this.steps.map(step => {
            let icon = '';
            if (step.status === 'pending') icon = '○';
            if (step.status === 'running') icon = '◐';
            if (step.status === 'completed') icon = '✓';
            if (step.status === 'failed') icon = '✗';
            
            return `<div class="log-step ${step.status}">${icon} ${step.name}</div>`;
        }).join('');
        
        const existingOutput = this.output.querySelector('.log-steps-container');
        if (existingOutput) {
            existingOutput.innerHTML = stepsHtml;
        } else {
            const container = document.createElement('div');
            container.className = 'log-steps-container';
            container.innerHTML = stepsHtml;
            this.output.appendChild(container);
        }
        
        this.scrollToBottom();
    }

    scrollToBottom() {
        if (this.output) {
            this.output.scrollTop = this.output.scrollHeight;
        }
    }

    showInitializing() {
        this.clear();
        this.addStep('Initializing Python environment', 'running');
    }

    showReady() {
        this.updateStep('Initializing Python environment', 'completed');
        this.addOutput('COBRA ready');
        this.addOutput('Configure GitHub token in Settings for cloud execution');
    }

    showExecutionStart(libraries) {
        this.clear();
        this.addStep('Analyzing code', 'running');
        
        setTimeout(() => {
            this.updateStep('Analyzing code', 'completed');
            if (libraries.length > 0) {
                this.addStep(`Detected libraries: ${libraries.join(', ')}`, 'running');
                setTimeout(() => {
                    this.updateStep(`Detected libraries: ${libraries.join(', ')}`, 'completed');
                }, 500);
            }
        }, 300);
    }

    showCloudExecution(libraries) {
        this.addStep('Cloud execution required', 'running');
        setTimeout(() => {
            this.updateStep('Cloud execution required', 'completed');
            this.addStep(`Running on GitHub Actions`, 'running');
        }, 500);
    }
}
