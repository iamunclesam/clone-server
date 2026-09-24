# Clone AI OS — Disaster Recovery & Backup Procedures

## 1. Data Backup Policy

Clone stores state across three data tiers:
1. **Primary Database (MongoDB):** Organizations, AI Employee profiles, state machine tasks, long-term memory vectors, audit logs.
2. **Cache & Rate Limits (Redis):** Short-lived rate limit counters and ephemeral execution state.
3. **Encrypted Vault Secrets:** OAuth refresh tokens and external service keys.

### Backup Schedule
- **MongoDB Atlas Automated Backups:** Continuous archiving (Point-In-Time Recovery) + hourly snapshots retained for 35 days.
- **Self-Hosted MongoDB (`mongodump`):** Daily automated cron execution with output piped to AWS S3 / Cloudflare R2 bucket with object locking enabled (WORM compliance).

---

## 2. Automated MongoDB Backup Script

```bash
#!/usr/bin/env bash
set -euo pipefail

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/tmp/clone_backup_${TIMESTAMP}"
S3_BUCKET="s3://clone-production-backups-secure"

echo "[INFO] Starting MongoDB dump for Clone OS..."
mongodump --uri="${MONGODB_URI}" --out="${BACKUP_DIR}" --gzip

echo "[INFO] Uploading encrypted backup snapshot to object storage..."
aws s3 cp "${BACKUP_DIR}" "${S3_BUCKET}/${TIMESTAMP}/" --recursive --sse aws:kms

echo "[INFO] Cleaning up local temporary backup directory..."
rm -rf "${BACKUP_DIR}"

echo "[SUCCESS] Disaster recovery snapshot created at ${TIMESTAMP}."
```

---

## 3. Disaster Recovery (RTO & RPO Targets)

- **Recovery Time Objective (RTO):** < 15 minutes for full API and DB restoration.
- **Recovery Point Objective (RPO):** < 5 seconds with MongoDB replica set oplog tailing.
