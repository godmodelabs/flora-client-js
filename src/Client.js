import isEmpty from './util/isempty.js';
import querystringify from './util/querystringify.js';
import httpmethod from './util/httpmethod.js';
import isValidRequestId from './util/valid-request-id.js';
import stringify from './util/stringify.js';

function hasOwn(obj, key) {
    return Object.prototype.hasOwnProperty.call(obj, key);
}

class Client {
    /**
     * Simple client to access Flora APIs.
     *
     * Uses {@link https://developer.mozilla.org/en/docs/Web/API/XMLHttpRequest|XMLHttpRequest} in browsers and
     * {@link https://nodejs.org/api/http.html|http}/{@link https://nodejs.org/api/https.html|https} module in Node.js
     * to run requests against Flora instance.
     *
     * @param {Object}  options                     - Client config options
     * @param {string}  options.url                 - URL of Flora instance
     * @param {Object}  options.adapter             - Instance of HTTP adapter
     * @param {?Object} options.defaultParams       - Parameters added to each request automatically
     * @param {?Array}  [options.forceGetParams=['client_id', 'action', 'access_token']]
     *                                              - Parameters are always send in query string
     * @param {?Function}   options.auth            - Auth handler (Promise)
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

        this.adapter = options.adapter;
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

        if (request.auth) {
            if (!this.auth) {
                return Promise.reject(new Error('Auth requests require an auth handler'));
            }

            request.httpHeaders = request.httpHeaders || {};
            return this.auth(request).then((authenticatedRequest) => this._execute(authenticatedRequest));
        }

        return this._execute(request);
    }

    _execute(request) {
        const skipCache = hasOwn(request, 'cache') && !!request.cache === false;
        const opts = {
            resource: request.resource,
            id: request.id,
            params: {},
            headers: request.httpHeaders || {},
        };
        let getParams;

        opts.url = this.url + request.resource + '/' + (request.id || '');

        if (request.format && String(request.format).toLocaleLowerCase() !== 'json') {
            return Promise.reject(new Error('Only JSON format supported'));
        }

        if (typeof request.select === 'object') request.select = stringify(request.select);
        if (request.data) {
            // post property as JSON
            opts.jsonData = JSON.stringify(request.data);
            opts.headers['Content-Type'] = 'application/json; charset=utf-8';
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
        if (httpMethod === 'POST' && !opts.jsonData) opts.headers['Content-Type'] = 'application/x-www-form-urlencoded';

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
        if (!isEmpty(getParams)) opts.url += '?' + querystringify(getParams);

        // add cache breaker to bypass HTTP caching
        if (skipCache) opts.url += (opts.url.indexOf('?') !== -1 ? '&' : '?') + '_=' + new Date().getTime();

        return this.adapter.request(httpMethod, opts);
    }
}

export default Client;
