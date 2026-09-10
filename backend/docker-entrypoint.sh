#!/bin/sh
set -e
mkdir -p "${UPLOAD_DIR:-/app/uploads}"
npx prisma migrate deploy
node prisma/seed.js
exec node dist/main.js
