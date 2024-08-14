import { expect, test } from '@playwright/test';
import http from 'node:http';

let httpServer;

// Webkit doesn't trigger timeouts for intercepted requests
async function startHttpServer() {
    const server = http.createServer((req, res) => {
        const url = URL.parse(req.url, 'http://localhost');

        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');

        if (req.method === 'OPTIONS') {
            res.statusCode = 204;
            return res.end();
        }

        if (url.pathname === '/') {
            res.setHeader('Content-Type', 'text/html');
            res.end('<!doctype html><html lang="en"><head><meta charset="UTF-8"><title>test</title></head><body></body></html>');
            return;
        }

        const data = JSON.stringify({ data: [] });
        if (url.pathname.startsWith('/timeout')) {
            const delay = parseInt(url.searchParams.get('delay'), 10);
            setTimeout(() => {
                res.setHeader('Content-Type', 'application/json');
                res.end(data);
            }, delay || 500);
            return;
        }

        res.setHeader('Content-Type', 'application/json');
        return res.end(data);
    });

    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

    const address = server.address();
    const port = address?.port ?? 0;
    const url = `http://127.0.0.1:${port}`;

    return {
        url,
        close: () => new Promise((resolve) => server.close(() => resolve())),
    };
}

async function runRequestTest(page, { ctorArgs = {}, executeArgs, response = { json: { data: [] } } }) {
    const apiUrl = page.url() + 'api/';
    const interceptPromise = new Promise((resolve, reject) => {
        const match = apiUrl + 'article/**';

        page.route(match, async (route) => {
            try {
                const request = route.request();
                await route.fulfill(response);
                resolve(request);
            } catch (err) {
                reject(err);
            } finally {
                await page.unroute(match);
            }
        });
    });
    const callPromise = page.evaluate(
        ([ctorArgs, apiUrl, args]) => {
            const client = new window.FloraClient({
                url: apiUrl,
                ...ctorArgs,
                ...(typeof window['authFn'] === 'function' ? { auth: window['authFn'] } : null),
            });
            return client.execute(args);
        },
        [ctorArgs, apiUrl, executeArgs],
    );

    const [request, result] = await Promise.all([interceptPromise, callPromise]);
    return { request, result };
}

test.beforeAll(async () => {
    httpServer = await startHttpServer();
});
test.afterAll(async () => httpServer?.close());

test.beforeEach(async ({ page }) => {
    await page.goto(httpServer.url);
    await page.addScriptTag({ path: 'dist/flora-client.umd.js' });

    // TODO: activate for local development only
    /*
    page.on('console', (m) => console.log('[console]', m.type(), m.text()));
    page.on('pageerror', (e) => console.error('[pageerror]', e));
    page.on('requestfailed', (r) => console.log('failed', r.url(), r.failure()?.errorText));
*/
});

test.describe('FloraClient', () => {
    test('loading', async ({ page }) => {
        const isLoaded = await page.evaluate(() => typeof window.FloraClient === 'function');
        expect(isLoaded).toBe(true);
    });

    test.describe('requests', () => {
        test('add resource to path', async ({ page }) => {
            const { request } = await runRequestTest(page, {
                executeArgs: { resource: 'article' },
            });

            const url = new URL(request.url());
            expect(url.pathname).toEqual('/api/article/');
        });

        test.describe('ids', () => {
            Object.entries({
                number: 1337,
                string: 'abc',
            }).forEach(([type, id]) =>
                test(`add id (${type}) to path`, async ({ page }) => {
                    const { request } = await runRequestTest(page, {
                        executeArgs: { resource: 'article', id },
                    });

                    const url = new URL(request.url());
                    expect(url.pathname).toEqual(`/api/article/${id}`);
                }),
            );

            [true, false, NaN, Infinity, undefined].forEach((id) =>
                test(`reject id (${id})`, async ({ page }) => {
                    const call = page.evaluate((id) => {
                        const client = new window.FloraClient({ url: 'https://api.example.com/' });
                        return client.execute({ resource: 'article', id });
                    }, id);

                    await expect(call).rejects.toThrow('Request id must be of type number or string');
                }),
            );
        });

        test.describe('actions', () => {
            test('should not add default action "retrieve" as parameter', async ({ page }) => {
                const { request } = await runRequestTest(page, {
                    executeArgs: { resource: 'article' },
                });

                const url = new URL(request.url());
                expect(url.searchParams.has('action')).toBe(false);
            });

            test('should add action as parameter', async ({ page }) => {
                const { request } = await runRequestTest(page, {
                    executeArgs: { resource: 'article', action: 'count', id: 1337 },
                });

                const url = new URL(request.url());
                expect(url.searchParams.has('action')).toBe(true);
                expect(url.searchParams.get('action')).toEqual('count');
            });

            Object.entries({
                'should use GET requests if action is not set': { resource: 'article' },
                'should use GET requests for "retrieve" action': { resource: 'article', action: 'retrieve' },
            }).forEach(([description, executeArgs]) =>
                test(description, async ({ page }) => {
                    const { request } = await runRequestTest(page, {
                        executeArgs,
                    });

                    expect(request.method()).toEqual('GET');
                }),
            );

            test('should use POST requests for other actions than "retrieve"', async ({ page }) => {
                const { request } = await runRequestTest(page, {
                    executeArgs: { resource: 'article', action: 'count', id: 1337 },
                });

                const headers = request.headers();

                expect(request.method()).toEqual('POST');
                expect(request.postData()).toBeNull();
                expect(headers).toHaveProperty('content-type');
                expect(headers['content-type']).toEqual('application/x-www-form-urlencoded');
            });
        });

        Object.entries({
            'should add select (string) as parameter': { resource: 'article', select: 'id,title,date' },
            'should add select (array/object) parameter to querystring': {
                resource: 'article',
                select: ['id', 'title', 'date'],
            },
        }).forEach(([description, executeArgs]) =>
            test(description, async ({ page }) => {
                const { request } = await runRequestTest(page, {
                    executeArgs,
                });

                const url = new URL(request.url());
                expect(url.searchParams.has('select')).toBe(true);
                expect(url.searchParams.get('select')).toEqual('id,title,date');
            }),
        );

        test('should add filter parameter to querystring', async ({ page }) => {
            const { request } = await runRequestTest(page, {
                executeArgs: { resource: 'article', filter: 'id=1,3,5' },
            });

            const url = new URL(request.url());
            expect(url.searchParams.has('filter')).toBe(true);
            expect(url.searchParams.get('filter')).toEqual('id=1,3,5');
        });

        Object.entries({
            'should add non-falsy limit parameter to querystring': 15,
            'should add falsy limit parameter to querystring': 0,
        }).forEach(([description, limit]) =>
            test(description, async ({ page }) => {
                const { request } = await runRequestTest(page, {
                    executeArgs: { resource: 'article', limit },
                });

                const url = new URL(request.url());
                expect(url.searchParams.has('limit')).toBe(true);
                expect(url.searchParams.get('limit')).toEqual(String(limit));
            }),
        );

        test('should add page parameter to querystring', async ({ page }) => {
            const { request } = await runRequestTest(page, {
                executeArgs: { resource: 'article', page: 15 },
            });

            const url = new URL(request.url());
            expect(url.searchParams.has('page')).toBe(true);
            expect(url.searchParams.get('page')).toEqual('15');
        });

        test('should add search parameter to querystring', async ({ page }) => {
            const { request } = await runRequestTest(page, {
                executeArgs: { resource: 'article', search: 'some fancy search string' },
            });

            const url = new URL(request.url());
            expect(url.searchParams.has('search')).toBe(true);
            expect(url.searchParams.get('search')).toEqual('some fancy search string');
        });

        test('should add cache breaker to querystring', async ({ page }) => {
            const { request } = await runRequestTest(page, {
                executeArgs: { resource: 'article', cache: false },
            });

            const url = new URL(request.url());
            expect(url.searchParams.has('_')).toBe(true);
            expect(url.searchParams.get('_')).toMatch(/^\d+$/);
        });

        test('should post content in data key as JSON', async ({ page }) => {
            const { request } = await runRequestTest(page, {
                executeArgs: {
                    resource: 'article',
                    action: 'create',
                    data: {
                        title: 'Lorem Ipsum',
                        author: { id: 1337 },
                    },
                },
            });

            const headers = request.headers();

            expect(request.method()).toEqual('POST');
            expect(headers).toHaveProperty('content-type');
            expect(headers['content-type'].toLowerCase()).toEqual('application/json; charset=utf-8');
            expect(request.postData()).toEqual('{"title":"Lorem Ipsum","author":{"id":1337}}');
        });

        test('should add default parameter(s)', async ({ page }) => {
            const { request } = await runRequestTest(page, {
                ctorArgs: { defaultParams: { client_id: 'test' } },
                executeArgs: { resource: 'article' },
            });

            const url = new URL(request.url());
            expect(url.searchParams.has('client_id')).toEqual(true);
            expect(url.searchParams.get('client_id')).toEqual('test');
        });

        test('should overwrite default parameter with request parameter', async ({ page }) => {
            const { request } = await runRequestTest(page, {
                ctorArgs: { defaultParams: { foo: 'test' } },
                executeArgs: { resource: 'article', foo: 'bar' },
            });

            const url = new URL(request.url());
            expect(url.searchParams.has('foo')).toEqual(true);
            expect(url.searchParams.get('foo')).toEqual('bar');
        });

        test('should send selected parameters in querystring', async ({ page }) => {
            const { request } = await runRequestTest(page, {
                ctorArgs: { forceGetParams: ['foobar'] },
                executeArgs: {
                    resource: 'article',
                    action: 'create',
                    data: {
                        title: 'Lorem Ipsum',
                        author: { id: 1337 },
                    },
                    foobar: 1,
                },
            });

            const url = new URL(request.url());
            expect(url.searchParams.has('foobar')).toEqual(true);
            expect(url.searchParams.get('foobar')).toEqual('1');
        });

        test.describe('HTTP methods', () => {
            test('should overwrite HTTP method with parameter', async ({ page }) => {
                const { request } = await runRequestTest(page, {
                    executeArgs: { resource: 'article', action: 'update', data: { title: 'Updated title' }, httpMethod: 'PATCH' },
                });

                const url = new URL(request.url());

                expect(request.method()).toEqual('PATCH');
                expect(url.searchParams.get('action')).toEqual('update');
                expect(url.searchParams.has('httpMethod')).toBe(false);
            });

            test('should switch to POST if querystring is too large', async ({ page }) => {
                const { request } = await runRequestTest(page, {
                    executeArgs: {
                        resource: 'article',
                        select: 'select'.repeat(150),
                        filter: 'filter'.repeat(150),
                        search: 'search term'.repeat(150),
                        limit: 100,
                        page: 10,
                    },
                });

                const url = new URL(request.url());
                expect(request.method()).toEqual('POST');
                expect(url.pathname).toEqual('/api/article/');

                const headers = request.headers();
                expect(headers).toHaveProperty('content-type');
                expect(headers['content-type']).toEqual('application/x-www-form-urlencoded');

                const searchParams = new URLSearchParams(request.postData());
                expect(searchParams.has('select')).toBeTruthy();
                expect(searchParams.has('filter')).toBeTruthy();
                expect(searchParams.has('search')).toBeTruthy();
                expect(searchParams.get('limit')).toEqual('100');
                expect(searchParams.get('page')).toEqual('10');
            });
        });

        test.describe('auth handler', () => {
            test('reject on missing auth handler', async ({ page }) => {
                const call = page.evaluate(() => {
                    const client = new window.FloraClient({ url: 'https://api.example.com/' });
                    return client.execute({ resource: 'article', auth: true });
                });

                await expect(call).rejects.toThrow('Auth requests require an auth handler');
            });

            test('should use configured auth handler', async ({ page }) => {
                // functions cannot be serialized in page.evaluate method
                // add global function as workaround
                await page.exposeFunction('authFn', async (floraReq) => {
                    floraReq.httpHeaders.Authorization = 'Bearer __token__';
                    return Promise.resolve(floraReq);
                });
                const { request } = await runRequestTest(page, {
                    executeArgs: { resource: 'article', filter: 'isPremium=true', auth: true },
                });

                const url = new URL(request.url());
                expect(url.searchParams.has('auth')).toBe(false);

                const headers = request.headers();
                expect(headers).toHaveProperty('authorization');
                expect(headers['authorization']).toEqual('Bearer __token__');
            });
        });

        test('HTTP (default) headers', async ({ page }) => {
            const { request } = await runRequestTest(page, {
                executeArgs: { resource: 'article', httpHeaders: { 'X-Foo': 'bar' } },
            });

            const headers = request.headers();
            expect(headers).toHaveProperty('x-foo');
            expect(headers['x-foo']).toEqual('bar');
        });

        test.describe('responses', () => {
            test('should parse JSON automatically', async ({ page }) => {
                const { result } = await runRequestTest(page, {
                    executeArgs: { resource: 'article', select: 'title' },
                    response: { json: { data: [{ title: 'Awesome title' }] } },
                });

                expect(result).toHaveProperty('data');
                expect(result.data).toEqual([{ title: 'Awesome title' }]);
            });

            test('test non-JSON content-types', async ({ page }) => {
                const match = 'http://api.example.com/no-json/**';

                await page.route(match, async (route) => {
                    try {
                        await route.fulfill({ status: 500, contentType: 'text/html', body: '500 Internal Server Error' });
                    } catch (err) {
                        reject(err);
                    } finally {
                        await page.unroute(match);
                    }
                });

                const call = page.evaluate(() => {
                    const client = new window.FloraClient({ url: 'http://api.example.com/' });
                    return client.execute({ resource: 'no-json' });
                });

                await expect(call).rejects.toThrow('Server Error: Internal Server Error');
            });

            test('test JSON parse errors', async ({ page }) => {
                const match = 'http://api.example.com/invalid-json/**';

                await page.route(match, async (route) => {
                    try {
                        await route.fulfill({ contentType: 'application/json', body: '{' });
                    } catch (err) {
                        reject(err);
                    } finally {
                        await page.unroute(match);
                    }
                });

                const call = page.evaluate(() => {
                    const client = new window.FloraClient({ url: 'http://api.example.com/' });
                    return client.execute({ resource: 'invalid-json' });
                });

                await expect(call).rejects.toThrow(
                    /SyntaxError: Expected property|JSON.parse: end of data while reading object|SyntaxError: JSON Parse error/,
                );
            });
        });

        test('should support timeout setting', async ({ page }) => {
            const call = page.evaluate((url) => {
                const client = new window.FloraClient({ url, timeout: 250 });
                return client.execute({ resource: 'timeout', delay: 500 });
            }, httpServer.url);

            await expect(call).rejects.toThrow('Request timed out after 250 milliseconds');
        });
    });
});
