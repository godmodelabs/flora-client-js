import http from 'node:http';
import https from 'node:https';
import path from 'node:path';

import querystringify from '../util/querystringify';

type NodeAdapterOptions = { 
    /**
     * Timeout in milliseconds
     * @default 15000
     */
    timeout?: number,
};

export default class Node {
    #timeout: number;

    constructor(opts: NodeAdapterOptions) {
        this.#timeout = opts.timeout ?? 15000;
    }

    request(method, { url, headers, params, jsonData }: FloraClientRequestAdapterOptions) {
        let postBody;

        headers.Referer = process.argv.length > 0 ? 'file://' + path.resolve(process.argv[1]) : '';

        if (jsonData) postBody = jsonData;
        if (params && method === 'POST') postBody = querystringify(params);
        if (postBody) headers['Content-Length'] = Buffer.from(postBody).byteLength;

        return new Promise((resolve, reject) => {
            const req = (url.indexOf('https:') === 0 ? https : http).request(url, { method, headers }, (res) => {
                let str = '';

                res.on('data', (chunk) => {
                    str += chunk;
                });

                res.on('end', () => {
                    let response;
                    const {
                        headers: { 'content-type': contentType },
                    } = res;

                    if (!contentType.startsWith('application/json')) {
                        if (res.statusCode < 400) return reject(new Error(`Server Error: Invalid content type: "${contentType}")`));
                        return reject(new Error(`Server Error: ${res.statusMessage || `Invalid content type: "${contentType}"`}`));
                    }

                    try {
                        response = JSON.parse(str);
                    } catch (e) {
                        return reject(e);
                    }

                    if (res.statusCode < 400) return resolve(response);

                    const msg = response.error && response.error.message
                        ? response.error.message
                        : `Server Error: ${res.statusMessage || 'Invalid JSON'}`;
                    const err = new Error(msg);
                    err.response = response;
                    return reject(err);
                });
            });

            req.setTimeout(this.#timeout, () => req.abort());

            if (postBody) req.write(postBody);

            req.on('error', (err) => {
                if (req.aborted) {
                    err = new Error(`Request timed out after ${this.#timeout} milliseconds`);
                    err.code = 'ETIMEDOUT';
                }
                reject(err);
            });
            req.end();
        });
    }
}
