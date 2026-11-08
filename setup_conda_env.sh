#!/bin/bash
# Setup script to create openqnt conda environment

set -e

echo "🔧 Creating openqnt conda environment..."

# Initialize conda
eval "$(/opt/miniconda3/bin/conda shell.bash hook)"

# Check if openqnt environment already exists
if conda env list | grep -q "^openqnt "; then
    echo "⚠️  openqnt environment already exists. Removing it first..."
    conda env remove -n openqnt -y
fi

# Create new openqnt environment
echo "📦 Creating openqnt environment with Python 3.12..."
conda create -n openqnt python=3.12 -c conda-forge -y

# Activate and install dependencies
echo "📥 Installing dependencies..."
conda activate openqnt
pip install -r backend/requirements.txt

echo "✅ openqnt conda environment created successfully!"
echo ""
echo "To activate it, run:"
echo "  conda activate openqnt"
