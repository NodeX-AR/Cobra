# COBRA - Python IDE

A professional Python IDE that runs in your browser with local and cloud execution support.

## Features

- Local execution for lightweight libraries (NumPy, Pandas, Matplotlib)
- Cloud execution for heavy libraries (PyTorch, TensorFlow) via GitHub Actions
- Persistent package caching using IndexedDB
- Mobile-friendly responsive design
- GitHub token stored locally in your browser

## Quick Start

### Local Setup

1. Clone this repository
2. Serve the files using any static server
3. Open index.html in your browser

### GitHub Integration (Optional)

To use cloud execution for heavy libraries:

1. Create a GitHub Personal Access Token
   - Settings → Developer settings → Personal access tokens
   - Scopes needed: `repo`, `workflow`

2. Create a repository with the workflow file
   - Copy `.github/workflows/execute-python.yml` to your repo

3. Configure COBRA
   - Click Settings in the top right
   - Enter your token and repository name

## Usage

1. Write Python code in the editor
2. Click Run to execute
3. Light libraries run locally
4. Heavy libraries automatically route to GitHub Actions

## Examples

- Basic Python - Standard library only
- NumPy - Array operations and statistics
- Pandas - Data manipulation
- PyTorch - Tensor operations (cloud)

## Requirements

- Modern browser with WebAssembly support
- GitHub account (optional, for cloud execution)

## License

MIT
