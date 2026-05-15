-- Run this if your patients table doesn't have discharged_at yet
ALTER TABLE patients ADD COLUMN IF NOT EXISTS discharged_at TIMESTAMP NULL DEFAULT NULL;

-- Backfill: set discharged_at = admitted_at for already-discharged patients (approximate)
UPDATE patients SET discharged_at = admitted_at WHERE status = 'Discharged' AND discharged_at IS NULL;
