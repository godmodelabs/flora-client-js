const isValidRequestId = (id) => {
    const type = typeof id;

    if (type === 'number') {
        // eslint-disable-next-line no-restricted-globals
        if (isNaN(id)) return false;
        // eslint-disable-next-line no-restricted-globals
        if (!isFinite(id)) return false;
    }

    return type === 'string' || type === 'number';
};

export default isValidRequestId;
