-- ============================================
-- FAS MUSIC SCHOOL DATABASE SCHEMA
-- ============================================

-- 1️⃣ ROLES
CREATE TABLE tbl_roles (
    role_id INT AUTO_INCREMENT PRIMARY KEY,
    role_name VARCHAR(50) NOT NULL UNIQUE -- e.g., SuperAdmin, Admin, Teacher, Student
);

-- 2️⃣ USERS (for login/authentication)
CREATE TABLE tbl_users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL, -- hashed
    role_id INT NOT NULL,
    first_name VARCHAR(50),
    last_name VARCHAR(50),
    email VARCHAR(100),
    phone VARCHAR(20),
    status ENUM('Active','Inactive') DEFAULT 'Active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (role_id) REFERENCES tbl_roles(role_id)
);

-- 3️⃣ BRANCHES
CREATE TABLE tbl_branches (
    branch_id INT AUTO_INCREMENT PRIMARY KEY,
    branch_name VARCHAR(100) NOT NULL,
    address TEXT,
    phone VARCHAR(20),
    email VARCHAR(100),
    status ENUM('Active','Inactive') DEFAULT 'Active'
);

-- 4️⃣ STUDENTS
CREATE TABLE tbl_students (
    student_id INT AUTO_INCREMENT PRIMARY KEY,
    branch_id INT NOT NULL,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    middle_name VARCHAR(50),
    date_of_birth DATE,
    age INT,
    phone VARCHAR(20),
    email VARCHAR(100),
    address TEXT,
    school VARCHAR(100),
    grade_year VARCHAR(50),
    health_diagnosis TEXT,
    enrollment_date DATE,
    registration_fee_amount DECIMAL(10,2) DEFAULT 0,
    registration_fee_paid DECIMAL(10,2) DEFAULT 0,
    registration_status ENUM('Pending','Fee Paid','Approved','Rejected') DEFAULT 'Pending',
    status ENUM('Active','Inactive') DEFAULT 'Inactive',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (branch_id) REFERENCES tbl_branches(branch_id)
);

-- 5️⃣ GUARDIANS
CREATE TABLE tbl_guardians (
    guardian_id INT AUTO_INCREMENT PRIMARY KEY,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    relationship_type ENUM('Father','Mother','Legal Guardian','Other') NOT NULL,
    phone VARCHAR(20),
    occupation VARCHAR(50),
    email VARCHAR(100),
    address TEXT,
    status ENUM('Active','Inactive') DEFAULT 'Active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6️⃣ STUDENT-GUARDIAN BRIDGE TABLE
CREATE TABLE tbl_student_guardians (
    student_guardian_id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    guardian_id INT NOT NULL,
    is_primary_guardian ENUM('Y','N') DEFAULT 'N',
    can_enroll ENUM('Y','N') DEFAULT 'Y',
    can_pay ENUM('Y','N') DEFAULT 'Y',
    emergency_contact ENUM('Y','N') DEFAULT 'N',
    FOREIGN KEY (student_id) REFERENCES tbl_students(student_id) ON DELETE CASCADE,
    FOREIGN KEY (guardian_id) REFERENCES tbl_guardians(guardian_id) ON DELETE CASCADE,
    UNIQUE KEY unique_student_guardian (student_id, guardian_id)
);

-- Master table for instrument types
CREATE TABLE tbl_instrument_types (
    type_id INT AUTO_INCREMENT PRIMARY KEY,
    type_name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT
);

-- Instruments table now links to type_id
CREATE TABLE tbl_instruments (
    instrument_id INT AUTO_INCREMENT PRIMARY KEY,
    branch_id INT NOT NULL,
    instrument_name VARCHAR(100),
    type_id INT NOT NULL,
    serial_number VARCHAR(50),
    `condition` VARCHAR(50),
    status ENUM('Available','In Use','Under Repair','Inactive') DEFAULT 'Available',
    FOREIGN KEY (branch_id) REFERENCES tbl_branches(branch_id),
    FOREIGN KEY (type_id) REFERENCES tbl_instrument_types(type_id)
);

-- 8️⃣ STUDENT INSTRUMENT PREFERENCES (Instruments students want to learn)
CREATE TABLE tbl_student_instruments (
    student_instrument_id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    instrument_id INT NOT NULL,
    priority_order INT DEFAULT 1, -- 1 = primary, 2 = secondary, etc.
    status ENUM('Active','Inactive','Completed') DEFAULT 'Active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES tbl_students(student_id) ON DELETE CASCADE,
    FOREIGN KEY (instrument_id) REFERENCES tbl_instruments(instrument_id),
    UNIQUE KEY unique_student_instrument (student_id, instrument_id)
);

-- 9️⃣ TEACHERS
CREATE TABLE tbl_teachers (
    teacher_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT, -- Optional link to tbl_users for login
    branch_id INT NOT NULL,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    specialization VARCHAR(100), -- Instruments they teach
    email VARCHAR(100),
    phone VARCHAR(20),
    employment_type ENUM('Full-time','Part-time','Contract') DEFAULT 'Full-time',
    status ENUM('Active','Inactive') DEFAULT 'Active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES tbl_users(user_id) ON DELETE SET NULL,
    FOREIGN KEY (branch_id) REFERENCES tbl_branches(branch_id)
);

-- 🔟 TEACHER INSTRUMENTS (Instruments each teacher can teach)
CREATE TABLE tbl_teacher_instruments (
    teacher_instrument_id INT AUTO_INCREMENT PRIMARY KEY,
    teacher_id INT NOT NULL,
    instrument_id INT NOT NULL,
    proficiency_level VARCHAR(50), -- e.g., Beginner, Intermediate, Advanced, Expert
    FOREIGN KEY (teacher_id) REFERENCES tbl_teachers(teacher_id) ON DELETE CASCADE,
    FOREIGN KEY (instrument_id) REFERENCES tbl_instruments(instrument_id),
    UNIQUE KEY unique_teacher_instrument (teacher_id, instrument_id)
);

-- 1️⃣1️⃣ SCHOOL INSTRUMENTS (Physical instruments owned by the school)
CREATE TABLE tbl_school_instruments (
    school_instrument_id INT AUTO_INCREMENT PRIMARY KEY,
    branch_id INT NOT NULL,
    instrument_id INT NOT NULL, -- Reference to master instrument list
    instrument_name VARCHAR(100), -- Specific name/model
    brand VARCHAR(100),
    serial_number VARCHAR(50),
    purchase_date DATE,
    purchase_cost DECIMAL(10,2),
    `condition` ENUM('Excellent','Good','Fair','Poor') DEFAULT 'Good',
    status ENUM('Available','In Use','Under Repair','Inactive') DEFAULT 'Available',
    FOREIGN KEY (branch_id) REFERENCES tbl_branches(branch_id),
    FOREIGN KEY (instrument_id) REFERENCES tbl_instruments(instrument_id)
);

-- 1️⃣2️⃣ SERVICE PROVIDERS / EXTERNAL TECHNICIANS (For instrument repairs)
CREATE TABLE tbl_service_providers (
    service_provider_id INT AUTO_INCREMENT PRIMARY KEY,
    provider_name VARCHAR(100) NOT NULL, -- e.g., "Yamaha Service Center", "Local Repair Shop"
    provider_type ENUM('Brand Service Center','Independent Technician','Repair Shop','Other') NOT NULL,
    brand_specialization VARCHAR(100), -- If they specialize in specific brands
    contact_person VARCHAR(50),
    phone VARCHAR(20),
    email VARCHAR(100),
    address TEXT,
    status ENUM('Active','Inactive') DEFAULT 'Active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 1️⃣3️⃣ REPAIRS (External repairs - not done by school)
CREATE TABLE tbl_repairs (
    repair_id INT AUTO_INCREMENT PRIMARY KEY,
    school_instrument_id INT NOT NULL,
    service_provider_id INT NOT NULL,
    issue_description TEXT NOT NULL,
    reported_date DATE DEFAULT (CURRENT_DATE),
    repair_date DATE, -- When repair was/will be done
    expected_completion_date DATE,
    actual_completion_date DATE,
    cost DECIMAL(10,2),
    status ENUM('Reported','Scheduled','In Progress','Completed','Cancelled') DEFAULT 'Reported',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (school_instrument_id) REFERENCES tbl_school_instruments(school_instrument_id),
    FOREIGN KEY (service_provider_id) REFERENCES tbl_service_providers(service_provider_id)
);

-- 1️⃣4️⃣ LESSON PACKAGES
CREATE TABLE tbl_lesson_packages (
    package_id INT AUTO_INCREMENT PRIMARY KEY,
    package_name VARCHAR(100) NOT NULL,
    total_sessions INT NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    validity_period INT, -- in days
    description TEXT,
    status ENUM('Active','Inactive') DEFAULT 'Active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 1️⃣5️⃣ ENROLLMENTS
CREATE TABLE tbl_enrollments (
    enrollment_id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    package_id INT NOT NULL,
    instrument_id INT NOT NULL, -- Instrument being learned in this enrollment
    teacher_id INT NOT NULL,
    enrollment_date DATE DEFAULT (CURRENT_DATE),
    start_date DATE,
    end_date DATE,
    total_amount DECIMAL(10,2) NOT NULL, -- Total package price
    paid_amount DECIMAL(10,2) DEFAULT 0, -- Amount paid so far
    payment_deadline_session INT DEFAULT 7, -- Must be paid in full by this session number
    status ENUM('Ongoing','Completed','Dropped','Pending Payment') DEFAULT 'Ongoing',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES tbl_students(student_id),
    FOREIGN KEY (package_id) REFERENCES tbl_lesson_packages(package_id),
    FOREIGN KEY (instrument_id) REFERENCES tbl_instruments(instrument_id),
    FOREIGN KEY (teacher_id) REFERENCES tbl_teachers(teacher_id)
);

-- 1️⃣6️⃣ SESSIONS
CREATE TABLE tbl_sessions (
    session_id INT AUTO_INCREMENT PRIMARY KEY,
    enrollment_id INT NOT NULL,
    teacher_id INT NOT NULL,
    session_number INT NOT NULL, -- Session number within the enrollment (1, 2, 3, etc.)
    session_date DATE NOT NULL,
    start_time TIME,
    end_time TIME,
    session_type ENUM('Regular','Makeup') DEFAULT 'Regular',
    instrument_id INT, -- Instrument used in this session
    school_instrument_id INT, -- If using school instrument (NULL if student brings own)
    status ENUM('Scheduled','Completed','Cancelled','No Show') DEFAULT 'Scheduled',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (enrollment_id) REFERENCES tbl_enrollments(enrollment_id),
    FOREIGN KEY (teacher_id) REFERENCES tbl_teachers(teacher_id),
    FOREIGN KEY (instrument_id) REFERENCES tbl_instruments(instrument_id),
    FOREIGN KEY (school_instrument_id) REFERENCES tbl_school_instruments(school_instrument_id)
);

-- 1️⃣7️⃣ ATTENDANCE
CREATE TABLE tbl_attendance (
    attendance_id INT AUTO_INCREMENT PRIMARY KEY,
    session_id INT NOT NULL,
    student_id INT NOT NULL,
    attendance_status ENUM('Present','Absent','Late','Excused') DEFAULT 'Present',
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    FOREIGN KEY (session_id) REFERENCES tbl_sessions(session_id),
    FOREIGN KEY (student_id) REFERENCES tbl_students(student_id),
    UNIQUE KEY unique_session_student (session_id, student_id)
);

-- 1️⃣8️⃣ MAKEUP SESSIONS
CREATE TABLE tbl_makeup_sessions (
    makeup_id INT AUTO_INCREMENT PRIMARY KEY,
    attendance_id INT NOT NULL, -- Original absent session
    original_session_id INT NOT NULL,
    makeup_session_id INT, -- The makeup session (created in tbl_sessions)
    teacher_id INT NOT NULL,
    status ENUM('Scheduled','Completed','Cancelled','Expired') DEFAULT 'Scheduled',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (attendance_id) REFERENCES tbl_attendance(attendance_id),
    FOREIGN KEY (original_session_id) REFERENCES tbl_sessions(session_id),
    FOREIGN KEY (makeup_session_id) REFERENCES tbl_sessions(session_id),
    FOREIGN KEY (teacher_id) REFERENCES tbl_teachers(teacher_id)
);

-- 1️⃣9️⃣ STUDENT PROGRESS
CREATE TABLE tbl_student_progress (
    progress_id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    session_id INT NOT NULL,
    instrument_id INT NOT NULL,
    skill_level VARCHAR(50), -- e.g., Beginner, Intermediate, Advanced
    remarks TEXT,
    assessment_date DATE DEFAULT (CURRENT_DATE),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES tbl_students(student_id),
    FOREIGN KEY (session_id) REFERENCES tbl_sessions(session_id),
    FOREIGN KEY (instrument_id) REFERENCES tbl_instruments(instrument_id)
);



-- 2️⃣0️⃣ REGISTRATION PAYMENTS (For registration fee)
CREATE TABLE tbl_registration_payments (
    registration_payment_id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    payment_date DATE DEFAULT (CURRENT_DATE),
    amount DECIMAL(10,2) NOT NULL,
    payment_method ENUM('Cash','Card','Bank Transfer','GCash','Check','Other') NOT NULL,
    status ENUM('Paid','Pending','Failed','Refunded') DEFAULT 'Paid',
    receipt_number VARCHAR(50),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES tbl_students(student_id) ON DELETE CASCADE
);

-- 2️⃣1️⃣ PAYMENTS (For enrollment/lesson payments)
CREATE TABLE tbl_payments (
    payment_id INT AUTO_INCREMENT PRIMARY KEY,
    enrollment_id INT NOT NULL,
    payment_date DATE DEFAULT (CURRENT_DATE),
    amount DECIMAL(10,2) NOT NULL,
    payment_method ENUM('Cash','Card','Bank Transfer','GCash','Check','Other') NOT NULL,
    payment_type ENUM('Full Payment','Partial Payment','Installment') DEFAULT 'Partial Payment',
    status ENUM('Paid','Pending','Failed','Refunded') DEFAULT 'Paid',
    receipt_number VARCHAR(50),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (enrollment_id) REFERENCES tbl_enrollments(enrollment_id)
);

-- 2️⃣2️⃣ PAYMENT SCHEDULE (Track payment deadlines per enrollment)
CREATE TABLE tbl_payment_schedule (
    schedule_id INT AUTO_INCREMENT PRIMARY KEY,
    enrollment_id INT NOT NULL,
    session_number INT NOT NULL, -- Session by which payment must be completed
    required_amount DECIMAL(10,2) NOT NULL, -- Amount that must be paid by this session
    paid_amount DECIMAL(10,2) DEFAULT 0, -- Amount actually paid by this session
    deadline_date DATE, -- Calculated based on session date
    status ENUM('Pending','Partial','Paid','Overdue') DEFAULT 'Pending',
    FOREIGN KEY (enrollment_id) REFERENCES tbl_enrollments(enrollment_id),
    UNIQUE KEY unique_enrollment_session (enrollment_id, session_number)
);

-- 2️⃣3️⃣ LEDGER (Financial transactions)
CREATE TABLE tbl_ledger (
    ledger_id INT AUTO_INCREMENT PRIMARY KEY,
    payment_id INT,
    enrollment_id INT NOT NULL,
    transaction_type ENUM('Payment','Refund','Adjustment') DEFAULT 'Payment',
    debit DECIMAL(10,2) DEFAULT 0,
    credit DECIMAL(10,2) DEFAULT 0,
    balance DECIMAL(10,2) DEFAULT 0,
    transaction_date DATE DEFAULT (CURRENT_DATE),
    remarks TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (payment_id) REFERENCES tbl_payments(payment_id) ON DELETE SET NULL,
    FOREIGN KEY (enrollment_id) REFERENCES tbl_enrollments(enrollment_id)
);

-- 2️⃣4️⃣ RECITALS / PERFORMANCES
CREATE TABLE tbl_recitals (
    recital_id INT AUTO_INCREMENT PRIMARY KEY,
    branch_id INT NOT NULL,
    teacher_id INT, -- Organizer/coordinator
    recital_name VARCHAR(100) NOT NULL,
    recital_date DATE NOT NULL,
    start_time TIME,
    end_time TIME,
    venue VARCHAR(100),
    max_audience_capacity INT,
    status ENUM('Scheduled','Completed','Cancelled','Postponed') DEFAULT 'Scheduled',
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (branch_id) REFERENCES tbl_branches(branch_id),
    FOREIGN KEY (teacher_id) REFERENCES tbl_teachers(teacher_id) ON DELETE SET NULL
);

-- 2️⃣5️⃣ RECITAL PARTICIPANTS (Students performing)
CREATE TABLE tbl_recital_participants (
    participant_id INT AUTO_INCREMENT PRIMARY KEY,
    recital_id INT NOT NULL,
    student_id INT NOT NULL,
    instrument_id INT NOT NULL,
    performance_order INT, -- Order of performance
    performance_time TIME, -- Scheduled time for this student's performance
    piece_name VARCHAR(200), -- Name of piece being performed
    evaluation_notes TEXT,
    status ENUM('Confirmed','Cancelled') DEFAULT 'Confirmed',
    FOREIGN KEY (recital_id) REFERENCES tbl_recitals(recital_id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES tbl_students(student_id),
    FOREIGN KEY (instrument_id) REFERENCES tbl_instruments(instrument_id)
);

-- 2️⃣6️⃣ RECITAL AUDIENCE (Guardians attending as audience)
CREATE TABLE tbl_recital_audience (
    audience_id INT AUTO_INCREMENT PRIMARY KEY,
    recital_id INT NOT NULL,
    guardian_id INT NOT NULL,
    student_id INT, -- Which student they're coming to watch (optional)
    number_of_guests INT DEFAULT 1, -- Guardian + additional guests
    confirmed ENUM('Y','N') DEFAULT 'N',
    confirmed_at TIMESTAMP NULL,
    notes TEXT,
    FOREIGN KEY (recital_id) REFERENCES tbl_recitals(recital_id) ON DELETE CASCADE,
    FOREIGN KEY (guardian_id) REFERENCES tbl_guardians(guardian_id),
    FOREIGN KEY (student_id) REFERENCES tbl_students(student_id) ON DELETE SET NULL,
    UNIQUE KEY unique_recital_guardian (recital_id, guardian_id)
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX idx_students_branch ON tbl_students(branch_id);
CREATE INDEX idx_students_status ON tbl_students(status);
CREATE INDEX idx_enrollments_student ON tbl_enrollments(student_id);
CREATE INDEX idx_enrollments_status ON tbl_enrollments(status);
CREATE INDEX idx_sessions_enrollment ON tbl_sessions(enrollment_id);
CREATE INDEX idx_sessions_date ON tbl_sessions(session_date);
CREATE INDEX idx_payments_enrollment ON tbl_payments(enrollment_id);
CREATE INDEX idx_payments_date ON tbl_payments(payment_date);
CREATE INDEX idx_recitals_date ON tbl_recitals(recital_date);
CREATE INDEX idx_attendance_session ON tbl_attendance(session_id);
