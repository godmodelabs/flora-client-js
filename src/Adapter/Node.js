import querystringify from '../util/querystringify.js';

class Node {
    /**
     * @param {Object}      opts
     * @param {?number}     [opts.timeout=15000]     - Timeout in milliseconds
     */
    constructor(opts) {
        this.timeout = opts.timeout;
    }

    async request(method, { url, headers, params, jsonData }) {
        let postBody;

        if (globalThis.process) headers.Referer = new URL('file://' + process.argv[1] + '/').href;

        if (jsonData) postBody = jsonData;
        if (params && method === 'POST') postBody = querystringify(params);
        if (postBody) headers['Content-Length'] = new Blob([postBody]).size;

        const response = await fetch(url, {
            method,
            headers,
            ...(postBody && { body: postBody }),
            signal: AbortSignal.timeout(this.timeout),
        });

        const contentType = response.headers.get('content-type');
        if (!contentType?.startsWith('application/json')) {
            if (response.status < 400) throw new Error(`Server Error: Invalid content type: "${contentType}")`);
            throw new Error(`Server Error: ${response.statusText || `Invalid content type: "${contentType}"`}`);
        }

        if (response.status < 400) return response.json();

        const payload = await response.json();
        const err = new Error(payload?.error?.message ?? `Server Error: ${response.status || 'Invalid JSON'}`);
        err.response = payload;
        throw err;
    }
}

export default Node;
