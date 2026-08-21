/**
 * Birthdate Validation Utility
 * Prevents future dates and validates age requirements
 */

(function() {
    'use strict';

    /**
     * Get today's date in YYYY-MM-DD format
     */
    function getTodayDate() {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    /**
     * Get date for minimum age (3 years old)
     */
    function getMinimumAgeDate(minAge = 3) {
        const today = new Date();
        today.setFullYear(today.getFullYear() - minAge);
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    /**
     * Get maximum reasonable date (150 years ago)
     */
    function getMaximumAgeDate(maxAge = 150) {
        const today = new Date();
        today.setFullYear(today.getFullYear() - maxAge);
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    /**
     * Calculate age from birthdate
     */
    function calculateAge(birthdate) {
        if (!birthdate) return null;
        
        const birth = new Date(birthdate);
        const today = new Date();
        
        if (isNaN(birth.getTime())) return null;
        if (birth > today) return null; // Future date
        
        let age = today.getFullYear() - birth.getFullYear();
        const monthDiff = today.getMonth() - birth.getMonth();
        
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
            age--;
        }
        
        return age;
    }

    /**
     * Format age display
     */
    function formatAgeDisplay(age) {
        if (age === null || age === undefined) {
            return '- Select date of birth -';
        }
        if (age < 0) {
            return 'Invalid date';
        }
        if (age === 0) {
            return 'Less than 1 year old';
        }
        if (age === 1) {
            return '1 year old';
        }
        return `${age} years old`;
    }

    /**
     * Validate birthdate input
     */
    function validateBirthdate(input, options = {}) {
        const {
            minAge = 3,
            maxAge = 150,
            ageDisplayId = null,
            errorDisplayId = null,
            guardianRequiredCallback = null
        } = options;

        if (!input) return;

        const value = input.value;
        const errorEl = errorDisplayId ? document.getElementById(errorDisplayId) : null;
        const ageEl = ageDisplayId ? document.getElementById(ageDisplayId) : null;

        // Clear previous errors
        if (errorEl) {
            errorEl.classList.add('hidden');
            errorEl.textContent = '';
        }
        if (input) {
            input.setCustomValidity('');
            input.classList.remove('border-red-500', 'border-red-300');
        }

        if (!value) {
            if (ageEl) ageEl.textContent = '- Select date of birth -';
            return false;
        }

        const selectedDate = new Date(value);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        selectedDate.setHours(0, 0, 0, 0);

        // Check if date is in the future
        if (selectedDate > today) {
            const error = 'Birthdate cannot be in the future';
            if (errorEl) {
                errorEl.textContent = error;
                errorEl.classList.remove('hidden');
            }
            if (input) {
                input.setCustomValidity(error);
                input.classList.add('border-red-500');
            }
            if (ageEl) ageEl.textContent = 'Invalid date (future)';
            return false;
        }

        const age = calculateAge(value);

        // Check minimum age
        if (age !== null && age < minAge) {
            const error = `Student must be at least ${minAge} years old`;
            if (errorEl) {
                errorEl.textContent = error;
                errorEl.classList.remove('hidden');
            }
            if (input) {
                input.setCustomValidity(error);
                input.classList.add('border-red-500');
            }
            if (ageEl) ageEl.textContent = formatAgeDisplay(age) + ' (too young)';
            return false;
        }

        // Check maximum age (prevent unrealistic dates)
        if (age !== null && age > maxAge) {
            const error = 'Please check the birthdate - this seems incorrect';
            if (errorEl) {
                errorEl.textContent = error;
                errorEl.classList.remove('hidden');
            }
            if (input) {
                input.setCustomValidity(error);
                input.classList.add('border-red-500');
            }
            if (ageEl) ageEl.textContent = 'Invalid date (too old)';
            return false;
        }

        // Valid date
        if (ageEl) ageEl.textContent = formatAgeDisplay(age);
        if (input) {
            input.classList.remove('border-red-500');
            input.classList.add('border-emerald-300');
        }

        // Guardian requirement callback
        if (guardianRequiredCallback && typeof guardianRequiredCallback === 'function') {
            guardianRequiredCallback(age !== null && age < 18);
        }

        return true;
    }

    /**
     * Initialize birthdate input with validation
     */
    function initBirthdateInput(inputId, options = {}) {
        const input = document.getElementById(inputId);
        if (!input) return;

        const today = getTodayDate();
        const minAgeDate = getMinimumAgeDate(options.minAge || 3);
        const maxAgeDate = getMaximumAgeDate(options.maxAge || 150);

        // Set HTML5 validation attributes
        input.setAttribute('max', today);
        input.setAttribute('min', maxAgeDate);
        
        // Add placeholder
        if (!input.placeholder) {
            input.placeholder = 'YYYY-MM-DD';
        }

        // Add title tooltip
        input.setAttribute('title', `Birthdate cannot be in the future. Must be at least ${options.minAge || 3} years old.`);

        // Validate on change
        input.addEventListener('change', function() {
            validateBirthdate(input, options);
        });

        // Validate on blur
        input.addEventListener('blur', function() {
            if (input.value) {
                validateBirthdate(input, options);
            }
        });

        // Prevent manual typing of future dates
        input.addEventListener('input', function() {
            if (input.value) {
                const selectedDate = new Date(input.value);
                const today = new Date();
                if (selectedDate > today) {
                    input.value = '';
                    const errorEl = options.errorDisplayId ? document.getElementById(options.errorDisplayId) : null;
                    if (errorEl) {
                        errorEl.textContent = 'Cannot select future dates';
                        errorEl.classList.remove('hidden');
                        setTimeout(() => {
                            errorEl.classList.add('hidden');
                        }, 3000);
                    }
                }
            }
        });

        // Initial validation if value exists
        if (input.value) {
            validateBirthdate(input, options);
        }
    }

    /**
     * Initialize all birthdate inputs on a page
     */
    function initAllBirthdateInputs() {
        // Common birthdate input IDs across the system
        const birthdateConfigs = [
            // Admin registration
            {
                inputId: 'walkin_student_dob',
                ageDisplayId: 'walkin_student_age_display',
                errorDisplayId: 'walkin_student_dob_error',
                minAge: 3,
                guardianRequiredCallback: function(required) {
                    // Update guardian fields
                    const guardianFields = document.querySelectorAll('.guardian-field');
                    const guardianLabels = document.querySelectorAll('.guardian-label');
                    const guardianBadge = document.getElementById('guardian_required_badge');
                    
                    if (required) {
                        guardianFields.forEach(field => field.required = true);
                        guardianLabels.forEach(label => {
                            if (!label.textContent.includes('*')) {
                                label.innerHTML = label.innerHTML.replace(/(<\/span>)?$/, ' *');
                            }
                        });
                        if (guardianBadge) guardianBadge.classList.remove('hidden');
                    } else {
                        guardianFields.forEach(field => field.required = false);
                        guardianLabels.forEach(label => {
                            label.innerHTML = label.innerHTML.replace(' *', '');
                        });
                        if (guardianBadge) guardianBadge.classList.add('hidden');
                    }
                }
            },
            // Desk registration
            {
                inputId: 'desk_student_dob',
                ageDisplayId: 'desk_student_age_display',
                errorDisplayId: 'desk_student_dob_error',
                minAge: 3
            },
            // Manager registration
            {
                inputId: 'manager_student_dob',
                ageDisplayId: 'manager_student_age_display',
                errorDisplayId: 'manager_student_dob_error',
                minAge: 3
            },
            // Guardian student registration
            {
                inputId: 'guardian_student_dob',
                ageDisplayId: 'guardian_student_age_display',
                errorDisplayId: 'guardian_student_dob_error',
                minAge: 3
            },
            // Student self-registration (if they can register minors)
            {
                inputId: 'student_dob',
                ageDisplayId: 'student_age_display',
                errorDisplayId: 'student_dob_error',
                minAge: 3
            }
        ];

        // Initialize each configured birthdate input
        birthdateConfigs.forEach(config => {
            if (document.getElementById(config.inputId)) {
                initBirthdateInput(config.inputId, config);
            }
        });
    }

    // Auto-initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initAllBirthdateInputs);
    } else {
        initAllBirthdateInputs();
    }

    // Export functions for manual use
    window.BirthdateValidator = {
        init: initBirthdateInput,
        initAll: initAllBirthdateInputs,
        validate: validateBirthdate,
        calculateAge: calculateAge,
        getTodayDate: getTodayDate,
        getMinimumAgeDate: getMinimumAgeDate
    };

})();
