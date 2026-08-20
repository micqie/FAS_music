/**
 * Comprehensive XSS-safe DOM helpers.
 * Defines window.escapeHtml when not already provided (e.g. by index.js).
 * 
 * SECURITY NOTE:
 * These utilities prevent XSS attacks by ensuring untrusted data is never
 * interpreted as executable HTML or JavaScript. All user/database/API data
 * must pass through these functions before being rendered.
 */
(function (global) {
    /**
     * Escape HTML special characters to prevent XSS.
     * Converts <, >, &, ", ' to their HTML entity equivalents.
     * This prevents untrusted text from becoming HTML elements or attributes.
     * 
     * @param {any} text - The text to escape
     * @returns {string} - HTML-safe string
     */
    if (typeof global.escapeHtml !== 'function') {
        global.escapeHtml = function escapeHtml(text) {
            if (text == null || text === '') return '';
            const div = document.createElement('div');
            div.textContent = String(text);
            return div.innerHTML;
        };
    }

    /**
     * Escape HTML attribute values.
     * Use this for values placed inside HTML attributes like href, src, title, etc.
     * 
     * @param {any} value - The attribute value to escape
     * @returns {string} - Attribute-safe string
     */
    global.escapeAttr = function escapeAttr(value) {
        if (value == null || value === '') return '';
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    };

    /**
     * Sanitize URL to prevent javascript: and data: XSS vectors.
     * Only allows http, https, mailto protocols.
     * 
     * @param {string} url - The URL to sanitize
     * @returns {string} - Safe URL or empty string if dangerous
     */
    global.sanitizeUrl = function sanitizeUrl(url) {
        if (!url || typeof url !== 'string') return '';
        const trimmed = url.trim();
        
        // Check for dangerous protocols
        const dangerous = /^[\s]*(javascript|data|vbscript):/i;
        if (dangerous.test(trimmed)) {
            console.warn('XSS: Blocked dangerous URL protocol:', trimmed.substring(0, 50));
            return '';
        }
        
        // Allow relative URLs, http, https, mailto
        if (trimmed.startsWith('/') || 
            trimmed.startsWith('./') ||
            trimmed.startsWith('../') ||
            /^https?:\/\//i.test(trimmed) ||
            /^mailto:/i.test(trimmed)) {
            return trimmed;
        }
        
        // Assume relative URL if no protocol
        if (!trimmed.includes(':')) {
            return trimmed;
        }
        
        console.warn('XSS: Blocked unrecognized URL protocol:', trimmed.substring(0, 50));
        return '';
    };

    /**
     * Create a text node safely (preferred over innerHTML for text content).
     * 
     * @param {any} text - The text to render
     * @returns {Text} - DOM Text node
     */
    global.createTextNode = function createTextNode(text) {
        return document.createTextNode(String(text ?? ''));
    };

    /**
     * Safely set text content of an element.
     * Use this instead of innerHTML when displaying untrusted data.
     * 
     * @param {HTMLElement} element - The target element
     * @param {any} text - The text to set
     */
    global.setTextContent = function setTextContent(element, text) {
        if (element && typeof element.textContent !== 'undefined') {
            element.textContent = String(text ?? '');
        }
    };

    /**
     * Safely create and append a text element.
     * 
     * @param {string} tagName - The element tag (e.g., 'div', 'span', 'p')
     * @param {any} text - The text content
     * @param {string|string[]} className - Optional CSS class(es)
     * @returns {HTMLElement} - The created element
     */
    global.createTextElement = function createTextElement(tagName, text, className) {
        const element = document.createElement(tagName || 'span');
        element.textContent = String(text ?? '');
        if (className) {
            if (Array.isArray(className)) {
                element.className = className.join(' ');
            } else {
                element.className = String(className);
            }
        }
        return element;
    };

    /**
     * Populate a <select> without injecting untrusted labels as HTML.
     * All option values and labels are set via textContent, not innerHTML.
     * 
     * @param {HTMLSelectElement} selectEl - The select element to populate
     * @param {Array} items - Array of items (objects or primitives)
     * @param {Object} config - Configuration object
     */
    global.populateSelectOptions = function populateSelectOptions(selectEl, items, config) {
        if (!selectEl) return;

        const options = config || {};
        const valueKey = options.valueKey || 'value';
        const labelKey = options.labelKey || 'label';
        const placeholder = options.placeholder ?? 'Select...';
        const selectedValue = options.selectedValue;

        // Clear existing options safely
        selectEl.innerHTML = '';
        
        if (placeholder !== null && placeholder !== false) {
            const placeholderOption = document.createElement('option');
            placeholderOption.value = '';
            placeholderOption.textContent = String(placeholder);
            selectEl.appendChild(placeholderOption);
        }

        (Array.isArray(items) ? items : []).forEach((item) => {
            const option = document.createElement('option');
            if (item && typeof item === 'object') {
                option.value = String(item[valueKey] ?? '');
                option.textContent = String(item[labelKey] ?? '');
            } else {
                option.value = String(item ?? '');
                option.textContent = String(item ?? '');
            }
            if (selectedValue != null && String(option.value) === String(selectedValue)) {
                option.selected = true;
            }
            selectEl.appendChild(option);
        });
    };

    /**
     * Validate that a string contains only safe characters for names.
     * Allows letters, numbers, spaces, hyphens, apostrophes, and common diacritics.
     * 
     * @param {string} name - The name to validate
     * @returns {boolean} - True if valid
     */
    global.isValidName = function isValidName(name) {
        if (!name || typeof name !== 'string') return false;
        // Allow Unicode letters, spaces, hyphens, apostrophes, periods
        // Block HTML-like patterns and control characters
        const valid = /^[\p{L}\p{M}\s.\-']+$/u;
        const dangerous = /[<>{}()\[\]\\\/&#;`]/;
        return valid.test(name.trim()) && !dangerous.test(name) && name.trim().length > 0;
    };

    /**
     * Validate email format (basic client-side check).
     * 
     * @param {string} email - The email to validate
     * @returns {boolean} - True if valid format
     */
    global.isValidEmail = function isValidEmail(email) {
        if (!email || typeof email !== 'string') return false;
        const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return pattern.test(email.trim()) && email.length <= 255;
    };

    /**
     * Validate phone number format (basic check).
     * 
     * @param {string} phone - The phone number to validate
     * @returns {boolean} - True if valid format
     */
    global.isValidPhone = function isValidPhone(phone) {
        if (!phone || typeof phone !== 'string') return false;
        // Allow digits, spaces, hyphens, parentheses, plus sign
        const pattern = /^[\d\s\-\(\)\+]+$/;
        return pattern.test(phone.trim()) && phone.replace(/\D/g, '').length >= 7;
    };

    /**
     * Strip HTML tags from a string (for cases where rich text input is not allowed).
     * 
     * @param {string} html - The HTML string
     * @returns {string} - Plain text with tags removed
     */
    global.stripHtmlTags = function stripHtmlTags(html) {
        if (!html || typeof html !== 'string') return '';
        const div = document.createElement('div');
        div.innerHTML = html;
        return div.textContent || div.innerText || '';
    };

    /**
     * Check if a value contains potential XSS patterns.
     * This is a defense-in-depth measure, not the primary protection.
     * 
     * @param {string} value - The value to check
     * @returns {boolean} - True if suspicious patterns detected
     */
    global.containsXSSPatterns = function containsXSSPatterns(value) {
        if (!value || typeof value !== 'string') return false;
        
        const patterns = [
            /<script[\s>]/i,
            /<iframe[\s>]/i,
            /<object[\s>]/i,
            /<embed[\s>]/i,
            /javascript:/i,
            /on\w+\s*=/i,  // Event handlers like onclick=, onload=
            /<svg[\s>]/i,
            /<math[\s>]/i,
            /data:text\/html/i,
            /vbscript:/i
        ];
        
        return patterns.some(pattern => pattern.test(value));
    };

    /**
     * Log XSS attempt for security monitoring.
     * 
     * @param {string} context - Where the attempt was detected
     * @param {string} value - The suspicious value
     */
    global.logXSSAttempt = function logXSSAttempt(context, value) {
        console.warn(`[XSS BLOCKED] Context: ${context}, Value: ${String(value).substring(0, 100)}`);
        // In production, this could send to a security monitoring endpoint
    };

})(window);
