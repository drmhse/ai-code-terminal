#!/bin/bash
# Test rollback migrations for Microsoft To Do integration
set -e

DB_FILE="data/act_test_rollback.db"
echo "Testing rollback migrations..."

# Clean up any previous test database
rm -f "$DB_FILE"

# Create a test database with base schema
echo "Step 1: Creating test database..."
cp data/act.db "$DB_FILE"

# Check tables before rollback
echo -e "\nStep 2: Tables before rollback:"
sqlite3 "$DB_FILE" ".tables" | tr ' ' '\n' | grep -E "(microsoft|oauth|task_sync|workspace_todo)" || echo "  (none found)"

# Apply rollback in correct order (reverse of creation)
echo -e "\nStep 3: Rolling back migration 0006..."
sqlite3 "$DB_FILE" < migrations/0006_oauth_state_down.sql 2>&1 || echo "  (no oauth_states table to drop)"

echo -e "\nStep 4: Rolling back migration 0005..."
sqlite3 "$DB_FILE" < migrations/0005_task_sync_down.sql 2>&1

echo -e "\nStep 5: Rolling back migration 0004..."
sqlite3 "$DB_FILE" < migrations/0004_microsoft_auth_down.sql 2>&1

# Check tables after rollback
echo -e "\nStep 6: Tables after rollback:"
sqlite3 "$DB_FILE" ".tables" | tr ' ' '\n' | grep -E "(microsoft|oauth|task_sync|workspace_todo)" || echo "  (none found - rollback successful)"

# Verify rollback by checking if tables are gone
REMAINING=$(sqlite3 "$DB_FILE" ".tables" | tr ' ' '\n' | grep -E "(microsoft|oauth|task_sync|workspace_todo)" | wc -l)
if [ "$REMAINING" -eq 0 ]; then
    echo -e "\n✅ Rollback test PASSED: All Microsoft integration tables removed"
    rm -f "$DB_FILE"
    exit 0
else
    echo -e "\n❌ Rollback test FAILED: $REMAINING table(s) still exist"
    exit 1
fi