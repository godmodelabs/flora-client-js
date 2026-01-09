import stringify from './util/stringify.js';

function hasOwn(obj, key) {
    return Object.prototype.hasOwnProperty.call(obj, key);
}

function isEmpty(obj) {
    return obj === null || typeof obj === 'undefined' || Object.keys(obj).length === 0;
}

function isValidRequestId(id) {
    const type = typeof id;

    if (type === 'number') {
        if (Number.isNaN(id)) return false;
        if (!Number.isFinite(id)) return false;
    }

    return type === 'string' || type === 'number';
}

class Client {
    /**
     * Simple client to access Flora APIs.
     *
     * @param {Object}  options                     - Client config options
     * @param {string}  options.url                 - URL of Flora instance
     * @param {?Object} options.defaultParams       - Parameters added to each request automatically
     * @param {?Array}  [options.forceGetParams=['client_id', 'action', 'access_token']]
     *                                              - Parameters are always send in query string
     * @param {?Function}   options.auth            - Auth handler (Promise)
     * @param {?number} [options.timeout=15000]     - default request timeout
     */
    constructor(options) {
        if (!options.url) throw new Error('Flora API url must be set');

        /**
         * URL of Flora instance
         *
         * @name Client#url
         * @type {string}
         * @readonly
         */
        this.url = options.url.substr(-1) === '/' ? options.url : options.url + '/';

        this.defaultParams = !isEmpty(options?.defaultParams) ? options.defaultParams : {};

        this.forceGetParams = [
            ...new Set(['client_id', 'action', 'access_token', ...(Array.isArray(options.forceGetParams) ? options.forceGetParams : [])]),
        ];

        this.auth =
            typeof options.auth === 'function' ? options.auth : () => Promise.reject(new Error('Auth requests require an auth handler'));

        this.timeout = options.timeout || 15000;
    }

    /**
     * Execute floraRequest against configured Flora instance.
     *
     * @param {Object}  floraRequest                     - Request configuration object
     * @param {string}  floraRequest.resource            - Resource name
     * @param {(number|string)=} floraRequest.id         - Unique identifier of an item
     * @param {string=} [floraRequest.format=json]       - Response format
     * @param {string=} [floraRequest.action=retrieve]   - API action
     * @param {string=} floraRequest.select              - Retrieve given resource attributes
     * @param {string=} floraRequest.filter              - Filter items by given criteria
     * @param {string=} floraRequest.order               - Order items by given criteria
     * @param {number=} floraRequest.limit               - Limit result set
     * @param {number=} floraRequest.page                - Paginate through result
     * @param {string=} floraRequest.search              - Search items by full text search
     * @param {Object=} floraRequest.data                - Send data as JSON
     * @param {boolean=}[floraRequest.cache=true]        - Use HTTP caching
     * @param {string=} floraRequest.httpMethod          - Explicitly overwrite HTTP method
     * @param {Object=} floraRequest.httpHeaders         - Additional HTTP headers
     * @param {AbortSignal=} floraRequest.signal         - Abort request using signal
     * @param {boolean=} [floraRequest.auth=false]       - Use the authentication handler for floraRequest
     * @return {Promise}
     */
    execute(floraRequest) {
        if (hasOwn(floraRequest, 'id') && !isValidRequestId(floraRequest.id)) {
            return Promise.reject(new Error('Request id must be of type number or string'));
        }

        if (floraRequest.format && String(floraRequest.format).toLocaleLowerCase() !== 'json') {
            return Promise.reject(new Error('Only JSON format supported'));
        }

        const request = this._prepare(floraRequest);
        return (floraRequest.auth ? this.auth(request) : Promise.resolve(request)).then((request) =>
            this._request(request, floraRequest.signal),
        );
    }

    _prepare(floraRequest) {
        const url = new URL(this.url);
        const headers = new Headers({
            ...(globalThis.process ? { referer: new URL('file://' + globalThis.process.argv[1] + '/').href } : null),
            ...(floraRequest.httpHeaders && !isEmpty(floraRequest.httpHeaders) ? floraRequest.httpHeaders : null),
        });
        let searchParams = new URLSearchParams();

        url.pathname += floraRequest.resource + '/' + (floraRequest.id || '');

        if (floraRequest?.action === 'retrieve') delete floraRequest.action;
        if (typeof floraRequest.select === 'object') floraRequest.select = stringify(floraRequest.select);

        for (const [param, value] of Object.entries({ ...this.defaultParams, ...floraRequest })) {
            if (['resource', 'id', 'data', 'cache', 'auth', 'httpMethod', 'httpHeaders', 'signal'].includes(param)) {
                continue;
            }

            if (this.forceGetParams.includes(param)) {
                url.searchParams.append(param, value);
                continue;
            }

            searchParams.set(param, value);
        }

        let { method, body, contentType } = (() => {
            if (!isEmpty(floraRequest.data)) {
                return { method: 'POST', body: JSON.stringify(floraRequest.data), contentType: 'application/json; charset=utf-8' };
            }

            if (searchParams.toString().length > 2000) {
                const result = { method: 'POST', body: searchParams.toString(), contentType: 'application/x-www-form-urlencoded' };
                searchParams = new URLSearchParams();
                return result;
            }

            return { method: url.searchParams.has('action') ? 'POST' : 'GET' };
        })();

        if (contentType) headers.set('Content-Type', contentType);
        if (body) headers.set('Content-Length', String(new Blob([body]).size));
        if (searchParams.size) Array.from(searchParams.entries()).forEach(([key, value]) => url.searchParams.set(key, value));

        method = hasOwn(floraRequest, 'httpMethod') ? floraRequest.httpMethod : method;
        // add cache breaker to bypass HTTP caching
        if (method === 'GET' && hasOwn(floraRequest, 'cache') && !!floraRequest.cache === false) {
            url.searchParams.append('_', String(Date.now()));
        }

        return new Request(url, { method, headers, body });
    }

    async _request(request, signal = AbortSignal.timeout(this.timeout)) {
        const response = await fetch(request, { signal });

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

export default Client;
