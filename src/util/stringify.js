/**
 * @param {Array|Object|string} spec
 * @return string
 */
function stringify(spec) {
    if (Array.isArray(spec)) {
        return spec.map(stringify).join(',');
    }

    if (typeof spec === 'object') {
        return Object.entries(spec)
            .map(([key, value]) => {
                const hasMultipleSubItems =
                    (Array.isArray(value) && value.length > 1) ||
                    (Array.isArray(value) &&
                        value.map((_) => (typeof _ === 'object' ? Object.entries(_).length : 1)).reduce((a, b) => a + b)) > 1 ||
                    (typeof value === 'object' && Object.entries(value).length > 1);
                value = stringify(value);
                return key + (hasMultipleSubItems ? `[${value}]` : `.${value}`);
            })
            .join(',');
    }

    return spec;
}

export default stringify;
