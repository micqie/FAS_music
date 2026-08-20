# XSS Protection Quick Reference

**Quick guide for developers working on FAS Music School application**

---

## ⚡ Quick Rules

1. **NEVER** use `innerHTML` with user data without `escapeHtml()`
2. **ALWAYS** validate input on the server
3. **ALWAYS** use prepared statements for SQL queries
4. **ALWAYS** escape output appropriate to context

---

## 🛡️ PHP (Server-Side)

### Validating Input

```php
// Include at top of file
require_once 'xss_protection.php';

// Validate name
$result = XSSProtection::validateName($firstName);
if (!$result['valid']) {
    return ['error' => $result['error']];
}

// Validate email
$result = XSSProtection::validateEmail($email);
if (!$result['valid']) {
    return ['error' => $result['error']];
}

// Validate phone
$result = XSSProtection::validatePhone($phone);
if (!$result['valid']) {
    return ['error' => $result['error']];
}

// Sanitize text
$result = XSSProtection::sanitizeText($notes, 500);
if (!$result['valid']) {
    return ['error' => $result['error']];
}
$cleanNotes = $result['value'];
```

### Escaping Output

```php
// HTML context
echo XSSProtection::escapeHtml($userName);

// Attribute context
echo '<input value="' . XSSProtection::escapeAttr($userInput) . '">';

// JavaScript context
echo 'var name = ' . XSSProtection::escapeJs($userName) . ';';

// URL context
echo 'redirect.php?next=' . XSSProtection::escapeUrl($userPath);
```

### Logging Security Events

```php
XSSProtection::logSecurityEvent(
    'XSS_ATTEMPT',
    'Suspicious input detected',
    ['field' => 'first_name', 'value' => substr($input, 0, 50)]
);
```

---

## 💻 JavaScript (Client-Side)

### Load XSS Utils

```html
<script src="../js/xss-utils.js"></script>
```

### Safe Text Rendering

```javascript
// BEST: Use textContent (automatically safe)
const cell = document.createElement('td');
cell.textContent = student.first_name;

// GOOD: Use escapeHtml() in template strings
element.innerHTML = `
    <div>${escapeHtml(student.first_name)}</div>
    <div>${escapeHtml(student.email)}</div>
`;

// NEVER DO THIS ❌
element.innerHTML = student.first_name;  // DANGEROUS!
```

### Safe URL Handling

```javascript
// Sanitize URLs
const cleanUrl = sanitizeUrl(userProvidedUrl);
if (cleanUrl) {
    link.href = cleanUrl;
} else {
    console.warn('Blocked dangerous URL');
}

// Escape URLs in HTML
element.innerHTML = `<a href="${escapeHtml(sanitizeUrl(url))}">Link</a>`;
```

### Safe Form Population

```javascript
// Populate select element safely
populateSelectOptions(selectElement, branches, {
    valueKey: 'branch_id',
    labelKey: 'branch_name',
    placeholder: 'Select branch...',
    selectedValue: currentBranchId
});
```

### Client-Side Validation

```javascript
// Validate before submission
if (!isValidName(firstName)) {
    showError('Name contains invalid characters');
    return;
}

if (!isValidEmail(email)) {
    showError('Invalid email format');
    return;
}

if (!isValidPhone(phone)) {
    showError('Invalid phone number');
    return;
}
```

---

## 🚫 What NOT To Do

### ❌ NEVER: innerHTML without escaping
```javascript
// DANGEROUS
element.innerHTML = userData;
```

### ❌ NEVER: SQL string concatenation
```php
// DANGEROUS
$query = "SELECT * FROM users WHERE name = '$name'";
```

### ❌ NEVER: Direct output without escaping
```php
// DANGEROUS
echo $_GET['name'];
echo $dbResult['user_name'];
```

### ❌ NEVER: Trust any data source
```javascript
// ALL OF THESE ARE UNTRUSTED:
// - URL parameters
// - Form input
// - Database values
// - API responses
// - localStorage
// - Cookies
```

---

## ✅ Safe Patterns

### ✅ Safe SQL Queries
```php
$stmt = $conn->prepare("UPDATE users SET name = ? WHERE id = ?");
$stmt->execute([$name, $userId]);
```

### ✅ Safe HTML Output (PHP)
```php
<div class="user-name"><?= XSSProtection::escapeHtml($userName) ?></div>
```

### ✅ Safe HTML Output (JavaScript)
```javascript
const div = document.createElement('div');
div.className = 'user-name';
div.textContent = userName; // Safe!
```

### ✅ Safe Template Strings
```javascript
html = items.map(item => `
    <tr>
        <td>${escapeHtml(item.name)}</td>
        <td>${escapeHtml(item.email)}</td>
    </tr>
`).join('');
```

---

## 🎯 Field-Specific Rules

| Field | Max Length | Validation | Escaping |
|-------|-----------|------------|----------|
| Name | 100 | `validateName()` | `escapeHtml()` |
| Email | 255 | `validateEmail()` | `escapeHtml()` |
| Phone | 30 | `validatePhone()` | `escapeHtml()` |
| Address | 500 | `sanitizeAddress()` | `escapeHtml()` |
| Notes | 500 | `sanitizeText()` | `escapeHtml()` |
| URL | - | `sanitizeUrl()` | `escapeAttr()` + `sanitizeUrl()` |

---

## 🔍 Testing Your Changes

### Manual Test Payloads

Try these in your forms:
```
<script>alert(1)</script>
<svg onload=alert(1)>
<img src=x onerror=alert(1)>
"><script>alert(1)</script>
javascript:alert(1)
<testing>
```

**Expected Results:**
- Server validation rejects with error message
- If bypassed, displayed as plain text (no execution)
- Logs show XSS attempt

### Browser Console Test

```javascript
// Should display as text, not execute
const testDiv = document.createElement('div');
testDiv.textContent = '<script>alert(1)</script>';
document.body.appendChild(testDiv);

// Verify escaping works
console.log(escapeHtml('<script>alert(1)</script>'));
// Output: &lt;script&gt;alert(1)&lt;/script&gt;
```

---

## 📋 Code Review Checklist

Before submitting code, verify:

- [ ] All user input is validated on server
- [ ] All output is escaped appropriately
- [ ] No `innerHTML` with untrusted data
- [ ] No SQL string concatenation
- [ ] No inline event handlers in generated HTML
- [ ] URLs are sanitized before use
- [ ] Prepared statements used for database queries
- [ ] XSS protection functions imported/available

---

## 🆘 Common Issues & Solutions

### Issue: "Why is my HTML showing as text?"

**Cause:** You're using `escapeHtml()` on HTML markup you want to display.

**Solution:** Only use `escapeHtml()` on USER DATA, not on your own HTML structure.

```javascript
// WRONG
element.innerHTML = escapeHtml('<div class="card">content</div>');

// RIGHT
element.innerHTML = `<div class="card">${escapeHtml(userContent)}</div>`;
```

### Issue: "Validation is rejecting valid names"

**Cause:** Name contains characters that look like HTML/XSS.

**Solution:** Check if the validation rules are too strict for your use case. Names with apostrophes (O'Brien), hyphens (Jean-Pierre), and accented characters (José) are allowed.

### Issue: "My JavaScript isn't working after adding CSP"

**Cause:** CSP is blocking inline scripts or eval().

**Solution:** 
1. Move inline scripts to external JS files
2. Use `addEventListener()` instead of onclick=
3. Avoid `eval()`, `new Function()`, `setTimeout(string)`

---

## 📚 More Information

- **Full Documentation:** `SECURITY_XSS_IMPLEMENTATION.md`
- **Test Report:** `XSS_TEST_REPORT.md`
- **Final Report:** `FINAL_SECURITY_REPORT.md`
- **PHP Functions:** `api/xss_protection.php`
- **JS Functions:** `js/xss-utils.js`
- **Test Suite:** `test_xss_protection.html`

---

## ⚠️ When In Doubt

1. **Validate input** on the server
2. **Escape output** at display time
3. **Use textContent** instead of innerHTML
4. **Ask for help** in code review

**Remember:** It's better to be too cautious than to introduce an XSS vulnerability!
