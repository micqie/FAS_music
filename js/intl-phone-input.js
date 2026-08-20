(function (global) {
    const UTILS_SCRIPT = 'https://cdn.jsdelivr.net/npm/intl-tel-input@18.1.1/build/js/utils.js';
    const PREFERRED_COUNTRIES = ['ph', 'us', 'gb', 'jp'];

    function getMaxLength(countryCode) {
        switch (countryCode) {
            case 'ph':
            case 'us':
            case 'gb':
            case 'jp':
                return 10;
            default:
                return 15;
        }
    }

    function formatPhonePlaceholder(exampleNumber, selectedCountry) {
        const countryCode = selectedCountry?.iso2 || '';
        if (countryCode === 'ph') {
            return '09x-xxx-xxxx';
        }

        const example = String(exampleNumber || '').trim();
        if (!example) {
            return 'Phone number';
        }

        let digitCount = 0;
        const masked = example.replace(/\d/g, (digit) => {
            digitCount += 1;
            return digitCount <= 2 ? digit : 'x';
        });

        return masked.replace(/\s+/g, ' ').trim();
    }

    function initInput(input) {
        if (!input || input.dataset.intlTelReady === '1') {
            return input?._iti || null;
        }
        if (typeof global.intlTelInput !== 'function') {
            return null;
        }

        const iti = global.intlTelInput(input, {
            initialCountry: 'ph',
            preferredCountries: PREFERRED_COUNTRIES,
            separateDialCode: true,
            autoPlaceholder: 'polite',
            customPlaceholder: formatPhonePlaceholder,
            formatOnDisplay: true,
            utilsScript: UTILS_SCRIPT
        });

        input.dataset.intlTelReady = '1';
        input._iti = iti;

        const normalizePhone = () => {
            const countryCode = iti.getSelectedCountryData()?.iso2 || '';
            const maxLength = getMaxLength(countryCode);
            input.value = input.value.replace(/\D/g, '').slice(0, maxLength);
        };

        input.addEventListener('input', normalizePhone);
        input.addEventListener('countrychange', () => {
            input.value = '';
            input.placeholder = formatPhonePlaceholder('', iti.getSelectedCountryData());
        });

        input.placeholder = formatPhonePlaceholder('', iti.getSelectedCountryData());
        return iti;
    }

    function init(root) {
        const scope = root && root.querySelectorAll ? root : document;
        scope.querySelectorAll('.intl-phone-input, [data-intl-phone]').forEach(initInput);
    }

    function getValue(input) {
        if (!input) return '';
        return String(input.value || '').trim();
    }

    function setValue(input, value) {
        if (!input) return;

        const normalized = String(value || '').trim();
        if (!normalized) {
            input.value = '';
            return;
        }

        const iti = input._iti;
        if (iti && typeof iti.setNumber === 'function') {
            iti.setNumber(normalized);
            return;
        }

        input.value = normalized;
    }

    function reset(input) {
        if (!input) return;

        const iti = input._iti;
        if (iti && typeof iti.setCountry === 'function') {
            iti.setCountry('ph');
        }
        input.value = '';
    }

    function resetForm(form) {
        if (!form) return;
        form.querySelectorAll('.intl-phone-input, [data-intl-phone]').forEach(reset);
    }

    global.FasIntlPhone = {
        init,
        initInput,
        getValue,
        setValue,
        reset,
        resetForm
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => init());
    } else {
        init();
    }
})(window);
