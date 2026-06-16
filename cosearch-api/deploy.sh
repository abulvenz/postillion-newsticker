#!/usr/bin/env bash
set -euo pipefail

# ==========================================================================
# deploy.sh – Cosearch API auf Scaleway Serverless Container deployen
#
# Voraussetzungen:
#   1. Scaleway Account + API-Key (https://console.scaleway.com/iam/api-keys)
#   2. Docker installiert
#   3. scw CLI installiert und konfiguriert:
#        brew install scw        # macOS
#        scw init                # fragt nach Access Key, Secret Key, Project ID
#
# Usage:
#   ./deploy.sh                  # Erstmalig: erstellt Registry + Container
#   ./deploy.sh update           # Nur neues Image pushen + Container updaten
# ==========================================================================

REGION="${SCW_REGION:-fr-par}"
NAMESPACE_NAME="cosearch"
CONTAINER_NAME="cosearch-api"
IMAGE_NAME="cosearch-api"
REGISTRY_ENDPOINT="rg.${REGION}.scw.cloud"

echo "=== Cosearch API Deploy ==="
echo "Region: ${REGION}"
echo ""

# ------------------------------------------------------------------
# Step 1: Container Registry erstellen (einmalig)
# ------------------------------------------------------------------
if ! scw registry namespace list -o json | python3 -c "
import json,sys
ns = json.load(sys.stdin)
found = any(n['name'] == '${NAMESPACE_NAME}' for n in ns)
sys.exit(0 if found else 1)
" 2>/dev/null; then
    echo "Creating container registry namespace '${NAMESPACE_NAME}'..."
    scw registry namespace create name="${NAMESPACE_NAME}" region="${REGION}"
else
    echo "Registry namespace '${NAMESPACE_NAME}' already exists."
fi

REGISTRY_NS=$(scw registry namespace list -o json | python3 -c "
import json,sys
ns = json.load(sys.stdin)
for n in ns:
    if n['name'] == '${NAMESPACE_NAME}':
        print(n['endpoint'])
        break
")
echo "Registry: ${REGISTRY_NS}"

# ------------------------------------------------------------------
# Step 2: Docker Image bauen
# ------------------------------------------------------------------
echo ""
echo "Building Docker image..."

# Ticker-Daten in den Build-Context kopieren
mkdir -p data
cp ../tickers_cosearch.js data/

docker build -t "${IMAGE_NAME}" .

# ------------------------------------------------------------------
# Step 3: Docker Login + Push
# ------------------------------------------------------------------
echo ""
echo "Logging into Scaleway Container Registry..."
scw registry login

FULL_IMAGE="${REGISTRY_NS}/${IMAGE_NAME}:latest"
echo "Tagging and pushing as ${FULL_IMAGE}..."
docker tag "${IMAGE_NAME}" "${FULL_IMAGE}"
docker push "${FULL_IMAGE}"

# ------------------------------------------------------------------
# Step 4: Serverless Container erstellen/updaten
# ------------------------------------------------------------------
echo ""

# Check if serverless namespace exists
if ! scw container namespace list -o json | python3 -c "
import json,sys
ns = json.load(sys.stdin)
found = any(n['name'] == '${NAMESPACE_NAME}' for n in ns)
sys.exit(0 if found else 1)
" 2>/dev/null; then
    echo "Creating serverless container namespace '${NAMESPACE_NAME}'..."
    scw container namespace create name="${NAMESPACE_NAME}" region="${REGION}"
    sleep 5
fi

NAMESPACE_ID=$(scw container namespace list -o json | python3 -c "
import json,sys
ns = json.load(sys.stdin)
for n in ns:
    if n['name'] == '${NAMESPACE_NAME}':
        print(n['id'])
        break
")

# Check if container exists
CONTAINER_ID=$(scw container container list namespace-id="${NAMESPACE_ID}" -o json | python3 -c "
import json,sys
cs = json.load(sys.stdin)
for c in cs:
    if c['name'] == '${CONTAINER_NAME}':
        print(c['id'])
        break
" 2>/dev/null || echo "")

if [ -z "${CONTAINER_ID}" ]; then
    echo "Creating serverless container '${CONTAINER_NAME}'..."
    scw container container create \
        namespace-id="${NAMESPACE_ID}" \
        name="${CONTAINER_NAME}" \
        registry-image="${FULL_IMAGE}" \
        port=8080 \
        min-scale=0 \
        max-scale=5 \
        memory-limit=512 \
        region="${REGION}"

    CONTAINER_ID=$(scw container container list namespace-id="${NAMESPACE_ID}" -o json | python3 -c "
import json,sys
cs = json.load(sys.stdin)
for c in cs:
    if c['name'] == '${CONTAINER_NAME}':
        print(c['id'])
        break
")
else
    echo "Updating existing container '${CONTAINER_NAME}'..."
    scw container container update \
        "${CONTAINER_ID}" \
        registry-image="${FULL_IMAGE}" \
        region="${REGION}"
fi

echo ""
echo "Deploying container..."
scw container container deploy "${CONTAINER_ID}" region="${REGION}"

# Wait for deployment
echo "Waiting for deployment..."
sleep 10

# Get the URL
CONTAINER_URL=$(scw container container get "${CONTAINER_ID}" -o json | python3 -c "
import json,sys
c = json.load(sys.stdin)
print(c.get('domain_name',''))
")

echo ""
echo "=== Done! ==="
echo "API URL: https://${CONTAINER_URL}"
echo ""
echo "Test it:"
echo "  curl https://${CONTAINER_URL}/health"
echo "  curl 'https://${CONTAINER_URL}/search?q=Astronaut'"
echo ""
echo "Set this URL in the frontend:"
echo "  localStorage.setItem('cosearch-api', 'https://${CONTAINER_URL}')"
