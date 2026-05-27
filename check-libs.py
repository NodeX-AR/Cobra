#!/usr/bin/env python3
import os
import re
from pathlib import Path

def check_libraries():
    libs_file = 'lib.txt'
    libs_dir = Path('libs')
    
    if not os.path.exists(libs_file):
        print("lib.txt not found")
        return
    
    requested = []
    with open(libs_file, 'r') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#'):
                name = re.split(r'[=<>!]', line)[0].strip()
                requested.append(name)
    
    existing = set()
    if libs_dir.exists():
        for file in libs_dir.rglob('*'):
            if file.suffix in ['.whl', '.gz', '.zip']:
                match = re.match(r'([a-zA-Z0-9_\-]+)-[0-9]', file.name)
                if match:
                    existing.add(match.group(1))
    
    missing = [lib for lib in requested if lib not in existing]
    
    print(f"\nLibrary Status")
    print(f"-" * 40)
    print(f"Requested: {len(requested)}")
    print(f"Downloaded: {len(existing)}")
    print(f"Missing: {len(missing)}")
    
    if missing:
        print(f"\nMissing libraries:")
        for lib in missing:
            print(f"  - {lib}")
    
    return missing

if __name__ == "__main__":
    check_libraries()
