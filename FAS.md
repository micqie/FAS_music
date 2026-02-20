1. Student Enrollment Process:
   Admin/Student → Creates Enrollment (with registration fields)
   → If student doesn't exist, create student record
   → Registration status: Pending → Fee Paid → Approved
   → Enrollment status: Pending Payment → Ongoing → Completed

2. Attendance Tracking:
   Session created → Status: Scheduled
   Session completed → Status: Completed (Present)
   Session cancelled → Status: Cancelled/No Show (Absent)

3. Payment Tracking:
   Registration Payment → Updates enrollment.registration_fee_paid
   Enrollment Payment → Updates enrollment.paid_amount
   Balance = total_amount - SUM(payments)
