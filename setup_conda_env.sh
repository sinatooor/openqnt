#!/bin/bash
# Setup script to create openqwnt conda environment

set -e

echo "🔧 Creating openqwnt conda environment..."

# Initialize conda
eval "$(/opt/miniconda3/bin/conda shell.bash hook)"

# Check if openqwnt environment already exists
if conda env list | grep -q "^openqwnt "; then
    echo "⚠️  openqwnt environment already exists. Removing it first..."
    conda env remove -n openqwnt -y
fi

# Create new openqwnt environment
echo "📦 Creating openqwnt environment with Python 3.12..."
conda create -n openqwnt python=3.12 -c conda-forge -y

# Activate and install dependencies
echo "📥 Installing dependencies..."
conda activate openqwnt
pip install -r backend/requirements.txt

echo "✅ openqwnt conda environment created successfully!"
echo ""
echo "To activate it, run:"
echo "  conda activate openqwnt"
