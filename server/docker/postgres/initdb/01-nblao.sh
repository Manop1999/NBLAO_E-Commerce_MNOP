#!/bin/sh
# Creates the restricted application role and the two allow-listed databases (see assertLocalDatabase).
# Runs only when the data volume is empty. The password comes from NBLAO_APP_PASSWORD (server/.env).
set -eu

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres \
  --set app_password="$NBLAO_APP_PASSWORD" <<'SQL'
CREATE ROLE nblao_app LOGIN PASSWORD :'app_password'
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;

CREATE DATABASE nblao_dev OWNER nblao_app;
CREATE DATABASE nblao_test OWNER nblao_app;

-- Only the owner (and the superuser) may connect to the application databases.
REVOKE ALL ON DATABASE nblao_dev FROM PUBLIC;
REVOKE ALL ON DATABASE nblao_test FROM PUBLIC;
-- nblao_app has no business in the maintenance database.
REVOKE CONNECT ON DATABASE postgres FROM PUBLIC;
SQL
