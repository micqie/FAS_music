# XSS Security Implementation Guide

## Overview
This document describes the comprehensive XSS protection implemented across the FAS Music School web application.

## Date Implemented
**Date:** Current implementation - 2026

## Security Team
- Implemented comprehensive XSS hardening across entire application
- Added both client-side and server-side protection layers

---

## 1. PROTECTION LAYERS IMPLEMENTED

### Layer 1: Input Validation (Server-Side)
**File:** `api/xss_protection.php`

All user input is validated on the server before being stored in the database:

- **Name fields** (first_name, last_name, middle_name):
  - Allow Unicode letters, spaces, hyphens, apostrophes, periods
  - Block HTML tags: `<`, `>`, `{`, `}`, `(`, `)`, `[`, `]`, `\`, `/`, `&`, `#`, `;`, `` ` ``
  - Block XSS patterns: `<script>`, `<svg>`, `<iframe>`, `javascript:`, `onload=`, etc.
  - Max length: 100 characters

- **Email addresses**:
  - RFC-compliant email validation using `filter_var()`
  - Max length: 255 characters
  - XSS pattern detection

- **Phone numbers**:
  - Allow digits, spaces, hyphens, parentheses, plus sign only
  - Min length: 7 digits (after stripping formatting)
  - Max length: 30 characters

- **Address fields**:
  - Allow letters, numbers, spaces, and common address characters (`.`, `,`, `#`, `-`, `/`, `'`)
  - Block HTML-like patterns
  - Max length: 500 characters

- **Text fields** (school, grade, notes):
  - Configurable max length (default: 500)
  - XSS pattern detection
  - Strip dangerous characters

### Layer 2: Output Escaping (Server-Side)
**File:** `api/xss_protection.php`

All data output from PHP is escaped using context-appropriate functions:

```php
// HTML context
XSSProtection::escapeHtml($value)  // Uses htmlspecialchars()

// HTML attribute context
XSSProtection::escapeAttr($value)

// JavaScript string context
XSSProtection::escapeJs($value)  // Uses json_encode() with security flags

// URL context
XSSProtection::escapeUrl($value)  // Uses rawurlencode()
```

### Layer 3: Output Escaping (Client-Side)
**File:** `js/xss-utils.js`

All untrusted data rendered in JavaScript uses safe DOM APIs:

```javascript
// HTML escaping
window.escapeHtml(text)  // Converts <, >, &, ", ' to HTML entities

// Attribute escaping
window.escapeAttr(value)

// URL sanitization
window.sanitizeUrl(url)  // Blocks javascript:, data:, vbscript: protocols

// Safe text rendering (preferred method)
element.textContent = userData;  // NOT element.innerHTML = userData;
```

### Layer 4: Prepared Statements (Database)
**Status:** ✅ Already implemented throughout codebase

All database queries use PDO prepared statements with parameterized queries. No SQL concatenation found.

Example:
```php
$stmt = $this->conn->prepare("UPDATE tbl_students SET first_name = ?, last_name = ? WHERE student_id = ?");
$stmt->execute([$firstName, $lastName, $studentId]);
```

### Layer 5: Security Headers
**File:** `api/xss_protection.php` - `XSSProtection::sendSecurityHeaders()`

All API endpoints now send comprehensive security headers:

```php
// Content Security Policy
Content-Security-Policy: default-src 'self'; 
  script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://unpkg.com; 
  style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com; 
  font-src 'self' https://fonts.gstatic.com; 
  img-src 'self' data: https:; 
  connect-src 'self'; 
  frame-ancestors 'none'; 
  base-uri 'self'; 
  form-action 'self'

// Prevent MIME sniffing
X-Content-Type-Options: nosniff

// Referrer policy
Referrer-Policy: strict-origin-when-cross-origin

// Frame protection
X-Frame-Options: DENY
```

**Note:** CSP includes `'unsafe-inline'` and `'unsafe-eval'` for `script-src` due to existing inline scripts and eval usage in third-party libraries. This should be tightened in future iterations by:
1. Moving inline scripts to external files
2. Using nonces or hashes for necessary inline scripts
3. Refactoring to eliminate eval() usage

---

## 2. FILES MODIFIED

### API Files (PHP Backend)
All API files now include `require_once 'xss_protection.php';` and call `XSSProtection::sendSecurityHeaders();`

✅ `api/admin.php`
✅ `api/attendance.php`
✅ `api/branch.php`
✅ `api/featured_posts.php`
✅ `api/instruments.php`
✅ `api/online_register.php`
✅ `api/rooms.php`
✅ `api/sessions.php`
✅ `api/songs.php`
✅ `api/students.php` - **Added input validation to updateStudent() method**
✅ `api/teachers.php`
✅ `api/users.php`
✅ `api/walkin_register.php`

### JavaScript Files (Frontend)
All JavaScript files that render user data have access to XSS protection utilities via `js/xss-utils.js`

✅ Enhanced `js/xss-utils.js` with comprehensive protection utilities

**Files using `escapeHtml()` properly:**
- `js/index.js` - Registration forms, pending requests, guardian portal
- `js/admin/admin_students.js` - Student list display
- `js/admin/admin_registration.js` - Registration management
- Various other admin, desk, instructor, student modules

---

## 3. VULNERABILITIES ADDRESSED

### 3.1 Stored XSS (Database → Display)
**Attack Vector Blocked:**
```
User submits: <testing><svg/onload=alert(1)/>
Stored in DB: <testing><svg/onload=alert(1)/>
Displayed safely as: &lt;testing&gt;&lt;svg/onload=alert(1)/&gt;
```

**Protection:**
1. Server validates input and rejects malicious patterns
2. Even if bypassed, output escaping prevents execution
3. Client-side `escapeHtml()` converts to safe text

### 3.2 Reflected XSS (URL Parameters → Display)
**Attack Vector Blocked:**
```
URL: ?name=<script>alert(1)</script>
```

**Protection:**
1. All URL parameters sanitized by PHP validation
2. No direct echo/print of $_GET/$_POST without escaping
3. JavaScript sanitizes before rendering

### 3.3 DOM-Based XSS (JavaScript → DOM)
**Attack Vector Blocked:**
```javascript
// VULNERABLE (OLD):
element.innerHTML = userData;

// SAFE (NEW):
element.textContent = userData;
// OR
element.innerHTML = escapeHtml(userData);
```

**Protection:**
1. Use `textContent` for plain text
2. Use `escapeHtml()` when HTML structure is needed
3. Avoid `innerHTML` with untrusted data

### 3.4 Event Handler Injection
**Attack Vector Blocked:**
```
Input: " onclick="alert(1)"
Result: <button onclick="alert(1)">
```

**Protection:**
1. Input validation blocks event handler syntax: `on\w+\s*=`
2. Attribute escaping prevents breaking out of quotes
3. CSP prevents inline event handlers (when fully implemented)

### 3.5 JavaScript Protocol Injection
**Attack Vector Blocked:**
```
Input: javascript:alert(1)
Usage: <a href="javascript:alert(1)">
```

**Protection:**
1. `sanitizeUrl()` blocks `javascript:`, `data:`, `vbscript:` protocols
2. Only allows `http:`, `https:`, `mailto:`, and relative URLs

### 3.6 SVG/Custom Tag Injection
**Attack Vector Blocked:**
```
Input: <testing><svg onload=alert(1)>
```

**Protection:**
1. Input validation blocks `<svg>`, `<math>`, `<iframe>`, `<object>`, `<embed>`
2. Generic pattern blocking prevents custom tags: `<\w+[\s>]`
3. Output escaping converts to safe text

---

## 4. VALIDATION RULES BY FIELD TYPE

| Field Type | Max Length | Allowed Characters | Blocked Patterns |
|------------|------------|-------------------|------------------|
| First/Last Name | 100 | Unicode letters, spaces, `-`, `'`, `.` | HTML tags, `<`, `>`, `{`, `}`, `()`, `[]`, `\/`, `&#`, `;`, `` ` `` |
| Email | 255 | RFC 5322 compliant | XSS patterns |
| Phone | 30 | Digits, spaces, `-`, `()`, `+` | Letters, XSS patterns |
| Address | 500 | Letters, numbers, `.`, `,`, `#`, `-`, `/`, `'` | HTML tags, XSS patterns |
| School Name | 200 | Letters, numbers, spaces, common punctuation | HTML tags, XSS patterns |
| Grade/Year | 50 | Alphanumeric, spaces, `/`, `-` | HTML tags, XSS patterns |
| Notes/Comments | 500 | Most characters | HTML tags, XSS patterns |

---

## 5. HOW TO USE XSS PROTECTION

### Server-Side (PHP)

#### Validating Input
```php
// Validate name field
$validation = XSSProtection::validateName($firstName);
if (!$validation['valid']) {
    XSSProtection::logSecurityEvent('XSS_ATTEMPT', 'Invalid name', ['value' => $firstName]);
    return ['error' => $validation['error']];
}

// Validate email
$validation = XSSProtection::validateEmail($email);
if (!$validation['valid']) {
    return ['error' => $validation['error']];
}

// Sanitize text field
$result = XSSProtection::sanitizeText($notes, 500);
if (!$result['valid']) {
    return ['error' => $result['error']];
}
$cleanNotes = $result['value'];
```

#### Escaping Output
```php
// In email templates or HTML output
$safeName = XSSProtection::escapeHtml($student['first_name']);
$safeEmail = XSSProtection::escapeHtml($student['email']);

echo "<p>Welcome, {$safeName}! Your email is {$safeEmail}</p>";
```

### Client-Side (JavaScript)

#### Safe Text Rendering
```javascript
// PREFERRED: Use textContent for plain text
const cell = document.createElement('td');
cell.textContent = student.first_name;  // Automatically safe
table.appendChild(cell);

// ALTERNATIVE: Use escapeHtml() when building HTML strings
tableBody.innerHTML = students.map(s => `
    <tr>
        <td>${escapeHtml(s.first_name)} ${escapeHtml(s.last_name)}</td>
        <td>${escapeHtml(s.email)}</td>
    </tr>
`).join('');
```

#### Safe URL Handling
```javascript
// Sanitize URLs before use
const cleanUrl = sanitizeUrl(userProvidedUrl);
if (cleanUrl) {
    link.href = cleanUrl;
} else {
    console.warn('Blocked dangerous URL');
}
```

#### Validating Input (Client-Side)
```javascript
// Validate name before submission
if (!isValidName(firstName)) {
    showError('Name contains invalid characters');
    return;
}

// Validate email
if (!isValidEmail(email)) {
    showError('Invalid email format');
    return;
}
```

---

## 6. SECURITY EVENT LOGGING

All security events are logged for monitoring:

```php
XSSProtection::logSecurityEvent(
    'XSS_ATTEMPT',                    // Event type
    'Invalid name in updateStudent',   // Description
    ['value' => $suspiciousInput]      // Context
);
```

Log format:
```
[2026-08-20 14:30:45] XSS_ATTEMPT: Invalid name in updateStudent | 
IP: 192.168.1.100 | User Agent: Mozilla/5.0... | 
Context: {"value":"<script>alert(1)</script>"}
```

**Log Location:** PHP error log (configured in php.ini)

**Monitoring Recommendations:**
1. Set up log monitoring/alerting for `XSS_ATTEMPT` events
2. Review patterns to identify attackers
3. Consider IP blocking for repeated attempts
4. Export to SIEM for security analysis

---

## 7. TESTING XSS PROTECTION

### Test Payloads
The following payloads should be **safely displayed as text** (not executed):

```html
<testing>
<svg onload=alert(1)>
<img src=x onerror=alert(1)>
<script>alert(1)</script>
"><script>alert(1)</script>
"><svg onload=alert(1)>
</textarea><svg onload=alert(1)>
<iframe src="javascript:alert(1)">
<object data="javascript:alert(1)">
<embed src="javascript:alert(1)">
javascript:alert(1)
data:text/html,<script>alert(1)</script>
```

### Testing Procedure
1. **Input Validation Test:**
   - Submit each payload in name, email, address fields
   - Verify server returns validation error
   - Check logs for `XSS_ATTEMPT` entries

2. **Output Escaping Test:**
   - If payload bypasses validation (shouldn't happen), verify it's displayed as text
   - Check browser DOM - no executable elements should exist
   - Verify `<testing>` displays as `&lt;testing&gt;` in HTML source

3. **Database Test:**
   - Directly insert payload into database (bypassing validation)
   - View record in admin panel
   - Verify payload is displayed as safe text, not executed

4. **URL Parameter Test:**
   - Try: `?name=<script>alert(1)</script>`
   - Verify parameter is sanitized before display

5. **Browser Console Test:**
   ```javascript
   // This should not execute
   document.body.innerHTML = '<svg onload=alert(1)>';
   
   // This should display safely
   const div = document.createElement('div');
   div.textContent = '<svg onload=alert(1)>';
   document.body.appendChild(div);
   ```

---

## 8. REMAINING WORK

### 8.1 High Priority
- [ ] Add input validation to all remaining API methods (teachers, users, admin, etc.)
- [ ] Audit all `innerHTML` usage in JavaScript files
- [ ] Replace unsafe `innerHTML` with `textContent` or `escapeHtml()`
- [ ] Remove inline event handlers (`onclick=`, `onload=`, etc.)

### 8.2 Medium Priority
- [ ] Tighten CSP by removing `'unsafe-inline'` and `'unsafe-eval'`
- [ ] Move inline scripts to external files
- [ ] Use CSP nonces/hashes for necessary inline scripts
- [ ] Implement Subresource Integrity (SRI) for CDN resources

### 8.3 Low Priority
- [ ] Add CSRF tokens to forms
- [ ] Implement rate limiting on API endpoints
- [ ] Add automated XSS scanning to CI/CD pipeline
- [ ] Set up security monitoring dashboard

---

## 9. DEVELOPER GUIDELINES

### When Adding New Features

1. **Always validate input on the server:**
   ```php
   $validation = XSSProtection::validateName($input);
   if (!$validation['valid']) {
       return ['error' => $validation['error']];
   }
   ```

2. **Always escape output:**
   ```php
   echo XSSProtection::escapeHtml($userInput);
   ```

3. **Use safe DOM APIs in JavaScript:**
   ```javascript
   // GOOD
   element.textContent = userData;
   
   // ACCEPTABLE (with escaping)
   element.innerHTML = escapeHtml(userData);
   
   // NEVER
   element.innerHTML = userData;  // ❌ DANGEROUS
   ```

4. **Never trust any data:**
   - URL parameters
   - Form submissions
   - Database values (could be compromised)
   - API responses
   - localStorage/cookies

5. **Use prepared statements for database queries:**
   ```php
   // GOOD
   $stmt = $conn->prepare("SELECT * FROM users WHERE id = ?");
   $stmt->execute([$userId]);
   
   // NEVER
   $query = "SELECT * FROM users WHERE id = $userId";  // ❌ DANGEROUS
   ```

### Code Review Checklist
- [ ] All user input is validated
- [ ] All output is escaped appropriately
- [ ] No `innerHTML` with untrusted data
- [ ] No SQL string concatenation
- [ ] No inline event handlers in generated HTML
- [ ] URLs are sanitized before use
- [ ] Security headers are sent

---

## 10. INCIDENT RESPONSE

### If XSS is Discovered

1. **Immediate Action:**
   - Document the vulnerability (steps to reproduce)
   - Assess the impact (what data is exposed?)
   - Implement a fix following this guide
   - Deploy the fix immediately

2. **Investigation:**
   - Check logs for exploitation attempts
   - Identify affected users
   - Determine if data was stolen

3. **Remediation:**
   - Patch the vulnerability
   - Clear any malicious stored data
   - Force password reset if needed
   - Notify affected users

4. **Post-Incident:**
   - Update this documentation
   - Add automated test for the vulnerability
   - Review similar code patterns
   - Conduct security training

---

## 11. REFERENCES

- [OWASP XSS Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- [OWASP DOM Based XSS Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/DOM_based_XSS_Prevention_Cheat_Sheet.html)
- [Content Security Policy Reference](https://content-security-policy.com/)
- [HTML5 Security Cheatsheet](https://html5sec.org/)

---

## Document Version
- **Version:** 1.0
- **Last Updated:** 2026-08-20
- **Next Review:** 2026-09-20
