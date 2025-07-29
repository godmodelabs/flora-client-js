import isEmpty from './util/isempty';
import querystringify from './util/querystringify';
import httpmethod from './util/httpmethod';
import isValidRequestId from './util/valid-request-id';
import stringify from './util/stringify';

/**
 * Client config options
 */
export type FloraClientOptions = { 
    /**
     * URL of Flora instance
     */
    url: string; 
    /**
     * Instance of HTTP adapter
     */
    adapter: FloraClientHttpAdapter; 
    /**
     * Parameters added to each request automatically
     */
    defaultParams?: Record<string, string | number> | null;  
    /**
     * Parameters are always send in query string
     * @default ['client_id', 'action', 'access_token']
     */
    forceGetParams?: Array<string> | null; 
    /**
     * Auth handler (Promise)
     */
    auth?: Promise<unknown> | null;
};

type FloraClientRequestOptions = { 
    resource: string; 
    id?: number | string; 
    /**
     * @default 'json'
     */
    format?: string; 
    /**
     * @default 'retrieve'
     */
    action?: string; 
    select?: string; 
    filter?: string; 
    order?: string; 
    limit?: number; 
    page?: number; 
    search?: string; 
    data?: object; 
    /**
     * @default true
     */
    cache?: boolean; 
    httpMethod?: string; 
    httpHeaders?: Record<string, string>,
    /**
     * @default true
     * NOTE(dledda): is this deprecated? Doesn't appear in this file.
     */
    authenticate?: boolean; 
    /**
     * @default true
     */
    auth?: boolean,
};

type FloraClientRequestAdapterOptions = {
    resource: string,
    id?: number | string,
    params: Record<string, string | number | boolean>,
    headers: Record<string, string>,
    jsonData?: string,
    url?: string,
};

export interface FloraClientHttpAdapter {
    request(httpMethod: string, options: FloraClientRequestAdapterOptions): Promise<unknown>;
};

/**
 * Simple client to access Flora APIs.
 *
 * Uses {@link https://developer.mozilla.org/en/docs/Web/API/XMLHttpRequest|XMLHttpRequest} in browsers and
 * {@link https://nodejs.org/api/http.html|http}/{@link https://nodejs.org/api/https.html|https} module in Node.js
 * to run requests against Flora instance.
 */
export default class Client {
    /**
     * URL of Flora instance
     */
    readonly url: string;

    forceGetParams: string[];

    defaultParams: Record<string, string | number | boolean> = {};

    adapter: FloraClientHttpAdapter;

    auth?: (req: FloraClientRequestOptions) => Promise<unknown>;

    constructor(options: FloraClientOptions) {
        if (!options.url) throw new Error('Flora API url must be set');

        this.url = options.url[options.url.length - 1] === '/' ? options.url : options.url + '/';

        const defaultParams = options.defaultParams;
        if (defaultParams && !isEmpty(defaultParams)) {
            this.defaultParams = Object.keys(defaultParams)
                .filter((key) => Object.prototype.hasOwnProperty.call(options.defaultParams, key))
                .reduce((acc, key) => {
                    acc[key] = defaultParams[key];
                    return acc;
                }, {} as Record<string, string | number | boolean>);
        }

        this.forceGetParams = ['client_id', 'action', 'access_token'];
        const userForceGetParams = options.forceGetParams;
        if (Array.isArray(userForceGetParams) && userForceGetParams.length) {
            userForceGetParams
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
     */
    async execute(request: FloraClientRequestOptions) {
        if (Object.prototype.hasOwnProperty.call(request, 'id') && !isValidRequestId(request.id)) {
            return Promise.reject(new Error('Request id must be of type number or string'));
        }

        if (request.auth) {
            if (!this.auth) {
                return Promise.reject(new Error('Auth requests require an auth handler'));
            }

            request.httpHeaders = request.httpHeaders || {};
            return this.auth(request).then(() => this.#execute(request));
        }

        return this.#execute(request);
    }

    #execute(request: FloraClientRequestOptions) {
        const skipCache = Object.prototype.hasOwnProperty.call(request, 'cache') && !!request.cache === false;
        const opts: FloraClientRequestAdapterOptions = {
            resource: request.resource,
            id: request.id,
            params: {},
            headers: request.httpHeaders || {},
        };
        let getParams: Record<string, string | number | boolean>;

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
            .filter((key) => Object.prototype.hasOwnProperty.call(request, key))
            .filter((key) => ['resource', 'id', 'cache', 'data', 'auth', 'httpMethod', 'httpHeaders'].indexOf(key) === -1)
            .reduce((acc, key) => {
                acc[key] = request[key];
                return acc;
            }, {} as Record<string, string | number | boolean>);

        if (this.defaultParams) {
            opts.params = Object.keys(this.defaultParams)
                .filter((key) => !has(opts.params, key))
                .reduce((acc, key) => {
                    acc[key] = this.defaultParams[key];
                    return acc;
                }, opts.params);
        }

        if (opts.params.action && opts.params.action === 'retrieve') delete opts.params.action;
        const httpMethod = !has(request, 'httpMethod') ? httpmethod(opts) : request.httpMethod;
        if (httpMethod === 'POST' && !opts.jsonData) opts.headers['Content-Type'] = 'application/x-www-form-urlencoded';

        if (this.forceGetParams.length) {
            getParams = this.forceGetParams
                .filter((key) => typeof opts.params[key] !== 'undefined')
                .reduce((acc, key) => {
                    acc[key] = opts.params[key];
                    delete opts.params[key]; // TODO: move somewhere else
                    return acc;
                }, {} as Record<string, string | boolean | number>);
        }

        if (typeof opts.params === 'object' && !isEmpty(opts.params) && (opts.jsonData || httpMethod === 'GET')) {
            getParams = Object.keys(opts.params)
                .filter((key) => Object.prototype.hasOwnProperty.call(opts.params, key))
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
