#!/bin/bash
# Setup script to create fyer conda environment

set -e

echo "🔧 Creating fyer conda environment..."

# Initialize conda
eval "$(/opt/miniconda3/bin/conda shell.bash hook)"

# Check if fyer environment already exists
if conda env list | grep -q "^fyer "; then
    echo "⚠️  fyer environment already exists. Removing it first..."
    conda env remove -n fyer -y
fi

# Create new fyer environment
echo "📦 Creating fyer environment with Python 3.12..."
conda create -n fyer python=3.12 -c conda-forge -y

# Activate and install dependencies
echo "📥 Installing dependencies..."
conda activate fyer
pip install -r backend/requirements.txt

echo "✅ fyer conda environment created successfully!"
echo ""
echo "To activate it, run:"
echo "  conda activate fyer"
