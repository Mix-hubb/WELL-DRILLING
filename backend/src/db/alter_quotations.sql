SET NAMES utf8mb4;
USE well_drilling;

ALTER TABLE quotations
  ADD COLUMN requested_depth_m DECIMAL(7,2) NULL AFTER repair_request_id,
  ADD COLUMN requested_diameter_m DECIMAL(7,2) NULL AFTER requested_depth_m;
