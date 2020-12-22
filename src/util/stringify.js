'use-strict';

/**
 * @param {Array|Object|string} spec
 * @return string
 */

function stringify(spec) {
    if (Array.isArray(spec)) {
        return spec.map(stringify).join(',');
    }

    const entries = (obj) => {
        const keys = Object.keys(obj);
        let keysCount = keys.length;
        const iter = new Array(keysCount);
        while (keysCount--) iter[keysCount] = [keys[keysCount], obj[keys[keysCount]]];
        return iter;
    };

    if (typeof spec === 'object') {
        return entries(spec)
            .map(([key, value]) => {
<<<<<<< HEAD
                const hasMultipleSubItems = (Array.isArray(value) && value.length > 1) || (typeof value === 'object' && Object.entries(value).length > 1);
=======
                const hasMultipleSubItems = (Array.isArray(value) && value.length > 1)
                    || (Array.isArray(value) && value.map((_) => (typeof _ === 'object' ? entries(_).length : 1)).reduce((a, b) => a + b)) > 1
                    || (typeof value === 'object' && entries(value).length > 1);
>>>>>>> 6ee0f00 (optimise stringify method and tests; run linter)

                value = stringify(value);
                return key + (hasMultipleSubItems ? `[${value}]` : `.${value}`);
            })
            .join(',');
    }

    return spec;
}

module.exports = stringify;
