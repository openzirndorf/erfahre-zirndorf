#!/bin/bash
# Lokale Assets aus erfahre-assets synchronisieren
ASSETS="../erfahre-assets"
cp "$ASSETS/challenges.json" backend/challenges.json
cp "$ASSETS/images/"*.webp  frontend/public/images/ 2>/dev/null || true
cp "$ASSETS/images/"*.png   frontend/public/images/ 2>/dev/null || true
cp "$ASSETS/images/"*.jpg   frontend/public/images/ 2>/dev/null || true
echo "Assets synchronisiert."
