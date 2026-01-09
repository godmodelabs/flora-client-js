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
            globalThis.setTimeout(() => {
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
                ...(typeof window['authTestHandler'] === 'function' ? { auth: window['authTestHandler'] } : null),
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

                expect(request.method()).toEqual('POST');
                expect(request.postData()).toBeNull();
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

            expect(request.method()).toEqual('POST');

            const headers = request.headers();
            expect(headers).toHaveProperty('content-type', 'application/json; charset=utf-8');
            expect(request.postData()).toEqual('{"title":"Lorem Ipsum","author":{"id":1337}}');

            const url = new URL(request.url());
            expect(url.searchParams.has('data')).toBe(false);
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
            expect(url.searchParams.has('foo')).toBe(true);
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
            expect(url.searchParams.has('foobar')).toBe(true);
            expect(url.searchParams.get('foobar')).toBe('1');
            expect(url.searchParams.has('data')).toBe(false);
        });

        test.describe('HTTP methods', () => {
            test('should overwrite HTTP method with parameter', async ({ page }) => {
                const { request } = await runRequestTest(page, {
                    executeArgs: { resource: 'article', action: 'update', data: { title: 'Updated title' }, httpMethod: 'PATCH' },
                });

                expect(request.method()).toEqual('PATCH');

                const url = new URL(request.url());
                expect(url.searchParams.get('action')).toEqual('update');
                expect(url.searchParams.has('httpMethod')).toBe(false);
                expect(url.searchParams.has('data')).toBe(false);

                expect(request.postData()).toEqual('{"title":"Updated title"}');
            });

            test('should switch to POST if querystring is too large', async ({ page }) => {
                const select = 'select'.repeat(150);
                const filter = 'filter'.repeat(150);
                const search = 'search term'.repeat(150);
                const { request } = await runRequestTest(page, {
                    executeArgs: {
                        resource: 'article',
                        select,
                        filter,
                        search,
                        limit: 100,
                        page: 10,
                    },
                });

                const url = new URL(request.url());
                expect(request.method()).toEqual('POST');
                expect(url.pathname).toEqual('/api/article/');
                expect(url.searchParams.has('select')).toBe(false);
                expect(url.searchParams.has('filter')).toBe(false);
                expect(url.searchParams.has('search')).toBe(false);
                expect(url.searchParams.has('limit')).toBe(false);
                expect(url.searchParams.has('page')).toBe(false);

                const headers = request.headers();
                expect(headers).toHaveProperty('content-type', 'application/x-www-form-urlencoded');

                const searchParams = new URLSearchParams(request.postData());
                expect(searchParams.get('select')).toEqual(select);
                expect(searchParams.get('filter')).toEqual(filter);
                expect(searchParams.get('search')).toEqual(search);
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
                // functions cannot be serialized => add global function as workaround
                await page.evaluate(() => {
                    window.authTestHandler = async (request) => {
                        await new Promise((resolve) => globalThis.setTimeout(resolve, 10));
                        request.headers.set('Authorization', 'Bearer __token__');
                        return request;
                    };
                });

                const { request } = await runRequestTest(page, {
                    executeArgs: { resource: 'article', filter: 'isPremium=true', auth: true },
                });

                const url = new URL(request.url());
                expect(url.searchParams.has('auth')).toBe(false);

                const headers = request.headers();
                expect(headers).toHaveProperty('authorization', 'Bearer __token__');
            });
        });

        test('HTTP headers', async ({ page }) => {
            const { request } = await runRequestTest(page, {
                executeArgs: { resource: 'article', httpHeaders: { 'X-Foo': 'bar' } },
            });

            const headers = request.headers();
            expect(headers).toHaveProperty('x-foo', 'bar');

            const url = new URL(request.url());
            expect(url.searchParams.has('httpHeaders')).toBe(false);
        });

        test.describe('responses', () => {
            test('should parse JSON automatically', async ({ page }) => {
                const { result } = await runRequestTest(page, {
                    executeArgs: { resource: 'article', select: 'title' },
                    response: { json: { data: [{ title: 'Awesome title' }] } },
                });

                expect(result).toHaveProperty('data', [{ title: 'Awesome title' }]);
            });

            test('test non-JSON content-types', async ({ page }) => {
                const match = 'http://api.example.com/no-json/**';

                await page.route(match, async (route) => {
                    try {
                        await route.fulfill({ status: 500, contentType: 'text/html', body: '500 Internal Server Error' });
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
                    } finally {
                        await page.unroute(match);
                    }
                });

                const result = await page.evaluate(async () => {
                    try {
                        const client = new window.FloraClient({ url: 'http://api.example.com/' });
                        await client.execute({ resource: 'invalid-json' });
                        return { ok: true };
                    } catch (err) {
                        // Playwright wraps errors in generic Error object
                        return {
                            ok: false,
                            errName: err.name,
                        };
                    }
                });

                expect(result.ok).toBe(false);
                expect(result.errName).toEqual('SyntaxError');
            });
        });

        test('should support timeout setting', async ({ page }) => {
            const call = page.evaluate((url) => {
                const client = new window.FloraClient({ url, timeout: 250 });
                return client.execute({ resource: 'timeout', delay: 500 });
            }, httpServer.url);

            await expect(call).rejects.toThrow(/(?:Timeout|Abort)Error|The operation timed out/);
        });

        test('should abort requests using signals', async ({ page }) => {
            const failedReqPromise = page.waitForEvent('requestfailed', (req) => URL.parse(req.url())?.pathname.startsWith('/timeout'));
            const call = page.evaluate((url) => {
                const controller = new AbortController();
                const client = new window.FloraClient({
                    url,
                    auth: (request) =>
                        new Promise((resolve) =>
                            setTimeout(() => {
                                request.headers.set('Authorization', 'Bearer __token__');
                                resolve(request);
                            }, 1),
                        ),
                });
                setTimeout(() => controller.abort(), 100);
                return client.execute({ resource: 'timeout', auth: true, signal: controller.signal });
            }, httpServer.url);

            await expect(call).rejects.toThrow(/AbortError|operation was aborted/);

            const failedRequest = await failedReqPromise;
            expect(failedRequest.headers()).toEqual(expect.objectContaining({ authorization: 'Bearer __token__' }));

            const url = URL.parse(failedRequest?.url());
            expect(url).not.toBeNull();
            expect(url.searchParams.has('signal')).toBeFalsy();

            expect(failedRequest.failure()?.errorText).toMatch(/net::ERR_ABORTED|NS_BINDING_ABORTED|request cancelled/);
        });
    });
});
