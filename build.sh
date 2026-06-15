#!/bin/bash
set -e

# Install Python dependencies
pip install -r requirements.txt

# Build frontend
cd frontend
npm install
npm run build
cd ..

echo "Build complete. Frontend dist at frontend/dist/"
