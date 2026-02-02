-- NUCLEAR CLEANUP & RESET SCRIPT (Development Only)
-- This script will wipe ALL data and recreate the schema

-- 1. Drop existing tables (in order of dependency)
DROP TABLE IF EXISTS otp_codes CASCADE;
DROP TABLE IF EXISTS patient_auth CASCADE;
DROP TABLE IF EXISTS loyalty_transactions CASCADE;
DROP TABLE IF EXISTS loyalty_rules CASCADE;
DROP TABLE IF EXISTS medicine_sales CASCADE;
DROP TABLE IF EXISTS medicines CASCADE;
DROP TABLE IF EXISTS clinical_records CASCADE;
DROP TABLE IF EXISTS appointments CASCADE;
DROP TABLE IF EXISTS doctor_schedules CASCADE;
DROP TABLE IF EXISTS doctors CASCADE;
DROP TABLE IF EXISTS patient_files CASCADE;
DROP TABLE IF EXISTS patients CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS expenses CASCADE;
DROP TABLE IF EXISTS locations CASCADE;
DROP TABLE IF EXISTS treatments CASCADE;
DROP TABLE IF EXISTS treatment_types CASCADE;

-- 2. Recreate Core Tables

-- Locations
CREATE TABLE locations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  address TEXT,
  phone VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Users (Staff)
CREATE TABLE users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  location_id UUID REFERENCES locations(id),
  username VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(20) DEFAULT 'normal',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Patients
CREATE TABLE patients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  location_id UUID REFERENCES locations(id),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  balance DECIMAL(12,2) DEFAULT 0,
  loyalty_points INTEGER DEFAULT 0,
  medical_history TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Patient Auth (Updated with password column)
CREATE TABLE patient_auth (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  email VARCHAR(255) UNIQUE,
  password VARCHAR(255) NOT NULL, -- Plain text password for development
  is_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- OTP Codes
CREATE TABLE otp_codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  code VARCHAR(6) NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Treatment Types
CREATE TABLE treatment_types (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  location_id UUID REFERENCES locations(id),
  name VARCHAR(255) NOT NULL,
  cost DECIMAL(12,2) NOT NULL,
  category VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Treatments (Clinical Records)
CREATE TABLE treatments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  location_id UUID REFERENCES locations(id),
  patient_id UUID REFERENCES patients(id),
  teeth INTEGER[],
  description TEXT,
  cost DECIMAL(12,2),
  date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Appointments
CREATE TABLE appointments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  location_id UUID REFERENCES locations(id),
  patient_id UUID REFERENCES patients(id),
  doctor_id UUID, -- Link to doctors table if exists
  date DATE NOT NULL,
  time TIME NOT NULL,
  type VARCHAR(100),
  status VARCHAR(20) DEFAULT 'Scheduled',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Medicines
CREATE TABLE medicines (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  location_id UUID REFERENCES locations(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  unit VARCHAR(50) DEFAULT 'pack',
  price DECIMAL(12,2) DEFAULT 0,
  stock INTEGER DEFAULT 0,
  min_stock INTEGER DEFAULT 0,
  category VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Insert Initial Data
INSERT INTO locations (name, address, phone) 
VALUES ('Main Clinic', '123 Dental St, Yangon', '09-123456789');

-- Default Admin Account
-- Username: admin, Password: admin123
INSERT INTO users (username, password, role, location_id) 
SELECT 'admin', 'admin123', 'admin', id FROM locations LIMIT 1;

-- Sample Treatment Types
INSERT INTO treatment_types (location_id, name, cost, category)
SELECT id, 'Scaling', 30000, 'Preventative' FROM locations LIMIT 1;
INSERT INTO treatment_types (location_id, name, cost, category)
SELECT id, 'Filling', 50000, 'Restorative' FROM locations LIMIT 1;
INSERT INTO treatment_types (location_id, name, cost, category)
SELECT id, 'Extraction', 40000, 'Surgery' FROM locations LIMIT 1;
