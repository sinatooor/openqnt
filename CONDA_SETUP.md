# OpenQwnt Conda Environment Setup

## Quick Setup

Run these commands in your terminal:

```bash
# Navigate to project
cd /Users/sina/project-fire/openqwnt

# Initialize conda (if not already done)
eval "$(/opt/miniconda3/bin/conda shell.zsh hook)"

# Remove old ppm environment if it exists
conda env remove -n ppm -y 2>/dev/null || true

# Create new openqwnt environment
conda create -n openqwnt python=3.12 -c conda-forge -y

# Activate the environment
conda activate openqwnt

# Install all dependencies
pip install -r backend/requirements.txt

# Verify installation
python --version
pip list | grep fastapi
```

## Verify It Works

```bash
conda activate openqwnt
cd backend
python -c "import fastapi; print('✅ FastAPI installed')"
python -c "import nautilus_trader; print('✅ NautilusTrader installed')"
```

## Troubleshooting

If `conda activate openqwnt` doesn't work:

1. **Make sure conda is initialized:**
   ```bash
   eval "$(/opt/miniconda3/bin/conda shell.zsh hook)"
   ```

2. **Check if environment exists:**
   ```bash
   conda env list
   ```

3. **If it doesn't exist, create it manually:**
   ```bash
   /opt/miniconda3/bin/conda create -n openqwnt python=3.12 -c conda-forge -y
   ```

4. **Then activate and install:**
   ```bash
   conda activate openqwnt
   pip install -r backend/requirements.txt
   ```

## Add to Shell Profile

Add this to your `~/.zshrc` for easy access:

```bash
# OpenQwnt project shortcut
alias openqwnt="cd /Users/sina/project-fire/openqwnt && eval \"\$(/opt/miniconda3/bin/conda shell.zsh hook)\" && conda activate openqwnt"
```

Then just type `openqwnt` to jump into the project!
