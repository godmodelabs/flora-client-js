import querystringify from './util/querystringify.js';
import httpmethod from './util/httpmethod.js';
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
        // eslint-disable-next-line no-restricted-globals
        if (isNaN(id)) return false;
        // eslint-disable-next-line no-restricted-globals
        if (!isFinite(id)) return false;
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
         * @name FloraClient#url
         * @type {string}
         * @readonly
         */
        this.url = options.url.substr(-1) === '/' ? options.url : options.url + '/';

        if (options.defaultParams && !isEmpty(options.defaultParams)) {
            this.defaultParams = Object.keys(options.defaultParams)
                .filter((key) => hasOwn(options.defaultParams, key))
                .reduce((acc, key) => {
                    acc[key] = options.defaultParams[key];
                    return acc;
                }, {});
        }

        this.forceGetParams = ['client_id', 'action', 'access_token'];
        if (Array.isArray(options.forceGetParams) && options.forceGetParams.length) {
            options.forceGetParams
                .filter((param) => this.forceGetParams.indexOf(param) === -1)
                .forEach((param) => this.forceGetParams.push(param));
        }

        if (options.auth && typeof options.auth === 'function') {
            this.auth = options.auth;
        }

        this.timeout = options.timeout || 15000;
    }

    /**
     * Execute request against configured Flora instance.
     *
     * @param {Object}  request                     - Request configuration object
     * @param {string}  request.resource            - Resource name
     * @param {(number|string)=} request.id         - Unique identifier of an item
     * @param {string=} [request.format=json]       - Response format
     * @param {string=} [request.action=retrieve]   - API action
     * @param {string=} request.select              - Retrieve given resource attributes
     * @param {string=} request.filter              - Filter items by given criteria
     * @param {string=} request.order               - Order items by given criteria
     * @param {number=} request.limit               - Limit result set
     * @param {number=} request.page                - Paginate through result
     * @param {string=} request.search              - Search items by full text search
     * @param {Object=} request.data                - Send data as JSON
     * @param {boolean=}[request.cache=true]        - Use HTTP caching
     * @param {string=} request.httpMethod          - Explicitly overwrite HTTP method
     * @param {Object=} request.httpHeaders         - Additional HTTP headers
     * @param {boolean=} [request.authenticate=false]- Use the authentication handler for request
     * @return {Promise}
     */
    execute(request) {
        if (hasOwn(request, 'id') && !isValidRequestId(request.id)) {
            return Promise.reject(new Error('Request id must be of type number or string'));
        }

        return this._execute(request);
    }

    _execute(request) {
        const url = new URL('/' + request.resource + '/' + (request.id || ''), this.url);
        const init = { headers: new Headers() };
        const skipCache = hasOwn(request, 'cache') && !!request.cache === false;
        const opts = {
            resource: request.resource,
            id: request.id,
            params: {},
            headers: request.httpHeaders || {},
        };
        let getParams;

        if (globalThis.process) init.headers.set('referer', new URL('file://' + process.argv[1] + '/').href);

        if (request.format && String(request.format).toLocaleLowerCase() !== 'json') {
            return Promise.reject(new Error('Only JSON format supported'));
        }

        if (typeof request.select === 'object') request.select = stringify(request.select);
        if (request.data) {
            // post property as JSON
            opts.jsonData = JSON.stringify(request.data);
            init.headers.set('content-type', 'application/json; charset=utf-8');
        }

        opts.params = Object.keys(request)
            .filter((key) => hasOwn(request, key))
            .filter((key) => ['resource', 'id', 'cache', 'data', 'auth', 'httpMethod', 'httpHeaders'].indexOf(key) === -1)
            .reduce((acc, key) => {
                acc[key] = request[key];
                return acc;
            }, {});

        if (this.defaultParams) {
            opts.params = Object.keys(this.defaultParams)
                .filter((key) => !hasOwn(opts.params, key))
                .reduce((acc, key) => {
                    acc[key] = this.defaultParams[key];
                    return acc;
                }, opts.params);
        }

        if (opts.params.action && opts.params.action === 'retrieve') delete opts.params.action;
        const httpMethod = !hasOwn(request, 'httpMethod') ? httpmethod(opts) : request.httpMethod;
        init.method = httpMethod;
        if (httpMethod === 'POST' && !opts.jsonData) init.headers.set('content-type', 'application/x-www-form-urlencoded');

        if (this.forceGetParams.length) {
            getParams = this.forceGetParams
                .filter((key) => typeof opts.params[key] !== 'undefined')
                .reduce((acc, key) => {
                    acc[key] = opts.params[key];
                    delete opts.params[key]; // TODO: move somewhere else
                    return acc;
                }, {});
        }

        if (typeof opts.params === 'object' && !isEmpty(opts.params) && (opts.jsonData || httpMethod === 'GET')) {
            getParams = Object.keys(opts.params)
                .filter((key) => hasOwn(opts.params, key))
                .reduce((acc, key) => {
                    acc[key] = opts.params[key];
                    return acc;
                }, getParams);
            delete opts.params;
        }

        if (isEmpty(opts.params)) delete opts.params;
        if (!isEmpty(getParams)) {
            Object.entries(getParams).forEach(([param, value]) => url.searchParams.append(param, value));
        }

        // add cache breaker to bypass HTTP caching
        if (skipCache) url.searchParams.append('_', String(Date.now()));

        if (opts.jsonData) init.body = opts.jsonData;
        if (opts.params && httpMethod === 'POST') init.body = querystringify(opts.params);
        if (init.body) init.headers.set('content-length', String(new Blob([init.body]).size));

        const req = new Request(url, init);
        if (!request.auth) {
            return this._request(req);
        }

        if (!this.auth) {
            return Promise.reject(new Error('Auth requests require an auth handler'));
        }

        return this.auth(req).then(this._request.bind(this));
    }

    async _request(req) {
        const response = await fetch(req, { signal: AbortSignal.timeout(this.timeout) });

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
