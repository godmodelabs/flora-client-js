import { after, afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import nock from 'nock';
import FloraClient from '../src/Client.js';

describe('Flora node client', () => {
    const url = 'http://api.example.com/';
    const api = new FloraClient({ url });
    const responseHeaders = { 'Content-Type': 'application/json; charset=utf-8' };

    afterEach(() => nock.cleanAll());
    after(() => nock.restore());

    describe('interface', () => {
        it('should require url on initialization', () => {
            assert.throws(() => new FloraClient({}), { message: 'Flora API url must be set' });
        });

        it('should define execute function', () => {
            assert.equal(typeof new FloraClient({ url }).execute, 'function');
        });
    });

    describe('request', () => {
        const response = { meta: {}, data: {} };

        it('should add resource to path', async () => {
            const req = nock(url).get('/user/').reply(200, response, responseHeaders);

            await api.execute({ resource: 'user' });

            assert.ok(req.isDone());
        });

        it('should add id to path', async () => {
            const req = nock(url).get('/user/1337').reply(200, response, responseHeaders);

            await api.execute({ resource: 'user', id: 1337 });

            assert.ok(req.isDone());
        });

        it('should treat action=retrieve as standard (and not transmit it)', async () => {
            const req = nock(url)
                .get('/user/')
                .query((queryObj) => !Object.hasOwn(queryObj, 'action'))
                .reply(200, response, responseHeaders);

            await api.execute({ resource: 'user', action: 'retrieve' });

            assert.ok(req.isDone());
        });

        it('should add action parameter', async () => {
            const req = nock(url).post('/article/1337').query({ action: 'count' }).reply(200, response, responseHeaders);

            await api.execute({ resource: 'article', id: 1337, action: 'count' });

            assert.ok(req.isDone());
        });

        Object.entries({
            string: 'id,lastname,address.city,comments(order=ts:desc)[id,body]',
            'array/object': ['id', 'lastname', 'address.city', { 'comments(order=ts:desc)': ['id', 'body'] }],
        }).forEach(([type, select]) => {
            it(`should add select as ${type} parameter to query`, async () => {
                const req = nock(url)
                    .get('/user/')
                    .query({ select: 'id,lastname,address.city,comments(order=ts:desc)[id,body]' })
                    .reply(200, response, responseHeaders);

                await api.execute({ resource: 'user', select });

                assert.ok(req.isDone());
            });
        });

        it('should add filter parameter to query', async () => {
            const req = nock(url)
                .get('/user/')
                .query({ filter: 'address[country.iso2=DE AND city=Munich] OR profession=Trader' })
                .reply(200, response, responseHeaders);

            await api.execute({ resource: 'user', filter: 'address[country.iso2=DE AND city=Munich] OR profession=Trader' });

            assert.ok(req.isDone());
        });

        it('should add order parameter to query', async () => {
            const req = nock(url).get('/user/').query({ order: 'lastname:asc,firstname:desc' }).reply(200, response, responseHeaders);

            await api.execute({ resource: 'user', order: 'lastname:asc,firstname:desc' });

            assert.ok(req.isDone());
        });

        Object.entries({
            'should add non-falsy limit parameter to query': 15,
            'should add falsy limit parameter to query': 0,
        }).forEach(([description, limit]) => {
            it(description, async () => {
                const req = nock(url).get('/user/').query({ limit }).reply(200, response, responseHeaders);

                await api.execute({ resource: 'user', limit });

                assert.ok(req.isDone());
            });
        });

        it('should add page parameter to query', async () => {
            const req = nock(url).get('/user/').query({ page: 2 }).reply(200, response, responseHeaders);

            await api.execute({ resource: 'user', page: 2 });

            assert.ok(req.isDone());
        });

        it('should add search parameter to query', async () => {
            const req = nock(url).get('/user/?search=full%20text%20search').reply(200, response, responseHeaders);

            await api.execute({ resource: 'user', search: 'full text search' });

            assert.ok(req.isDone());
        });

        it('should add cache breaker parameter to query', async () => {
            const req = nock(url).filteringPath(/_=\d+/, '_=xxx').get('/user/').query({ _: 'xxx' }).reply(200, response, responseHeaders);

            await api.execute({ resource: 'user', cache: false });

            assert.ok(req.isDone());
        });

        it('should post content in data key as JSON', async () => {
            const floraReq = {
                resource: 'article',
                action: 'create',
                data: {
                    title: 'Lorem Ipsum',
                    author: { id: 1337 },
                },
            };
            const req = nock(url, {
                reqheaders: {
                    'content-type': 'application/json; charset=utf-8',
                    'content-length': 44,
                },
            })
                .post('/article/', '{"title":"Lorem Ipsum","author":{"id":1337}}')
                .query((params) => params.action === 'create' && !Object.hasOwn(params, 'data'))
                .reply(200, response, responseHeaders);

            await api.execute(floraReq);

            assert.ok(req.isDone());
        });

        it('should set a proper Content-Length when POSTing Unicode characters', async () => {
            const floraReq = {
                resource: 'article',
                action: 'create',
                data: {
                    title: 'this is a non-breaking space: ',
                    author: { id: 1337 },
                },
            };
            const req = nock(url, {
                reqheaders: {
                    'content-type': 'application/json; charset=utf-8',
                    'content-length': 64,
                },
            })
                .post('/article/', '{"title":"this is a non-breaking space: ","author":{"id":1337}}')
                .query({ action: 'create' })
                .reply(200, response, responseHeaders);

            await api.execute(floraReq);

            assert.ok(req.isDone());
        });

        describe('HTTP method', () => {
            it('should use GET for "retrieve" actions', async () => {
                const req = nock(url).get('/user/1337').reply(200, response, responseHeaders);

                await api.execute({ resource: 'user', id: 1337, action: 'retrieve' });

                assert.ok(req.isDone());
            });

            it('should use GET if action is not set', async () => {
                const req = nock(url).get('/user/1337').reply(200, response);

                await api.execute({ resource: 'user', id: 1337 });

                assert.ok(req.isDone());
            });

            it('should use POST for other actions than "retrieve"', async () => {
                const req = nock(url).post('/user/1337').query({ action: 'lock' }).reply(200, response, responseHeaders);

                await api.execute({ resource: 'user', id: 1337, action: 'lock' });

                assert.ok(req.isDone());
            });

            it('should explicitly overwrite HTTP method by parameter', async () => {
                const req = nock(url, {
                    reqheaders: {
                        'content-type': 'application/json; charset=utf-8',
                        'content-length': 16,
                    },
                })
                    .patch('/article/1337', { title: 'test' })
                    .query({ action: 'update' })
                    .reply(200, response, responseHeaders);

                await api.execute({
                    resource: 'article',
                    id: 1337,
                    action: 'update',
                    data: { title: 'test' },
                    httpMethod: 'PATCH',
                });

                assert.ok(req.isDone());
            });

            it('should switch to POST if querystring gets too large', async () => {
                const select = 'select'.repeat(100);
                const filter = 'filter'.repeat(100);
                const search = 'searchterm'.repeat(100);
                const floraReq = {
                    resource: 'user',
                    select,
                    filter,
                    search,
                    limit: 100,
                    page: 10,
                };
                const req = nock(url, { reqheaders: { 'content-type': 'application/x-www-form-urlencoded' } })
                    .post('/user/', (body) => {
                        const searchParams = new URLSearchParams(body);
                        return (
                            searchParams.get('select') === select &&
                            searchParams.get('filter') === filter &&
                            searchParams.get('search') === search &&
                            searchParams.get('limit') === '100' &&
                            searchParams.get('page') === '10'
                        );
                    })
                    .query(
                        (params) =>
                            !Object.hasOwn(params, 'select') &&
                            !Object.hasOwn(params, 'filter') &&
                            !Object.hasOwn(params, 'search') &&
                            !Object.hasOwn(params, 'limit') &&
                            !Object.hasOwn(params, 'page'),
                    )
                    .reply(200, response);

                await api.execute(floraReq);

                assert.ok(req.isDone());
            });
        });
    });

    describe('parameters', () => {
        it('should support default parameters', async () => {
            const req = nock(url).get('/user/1337').query({ param: 'abc' }).reply(200, {}, responseHeaders);

            await new FloraClient({ url, defaultParams: { param: 'abc' } }).execute({ resource: 'user', id: 1337 });

            assert.ok(req.isDone());
        });

        it('should use request parameter if default exists with same name', async () => {
            const req = nock(url).get('/user/1337').query({ param: 'xyz' }).reply(200, {}, responseHeaders);

            await new FloraClient({ url, defaultParams: { param: 'abc' } }).execute({ resource: 'user', id: 1337, param: 'xyz' });

            assert.ok(req.isDone());
        });

        it('should send selected parameters as part of the querystring', async () => {
            const floraReq = {
                resource: 'article',
                action: 'create',
                data: {
                    title: 'Lorem Ipsum',
                    author: { id: 1337 },
                },
            };
            const req = nock(url)
                .post('/article/', '{"title":"Lorem Ipsum","author":{"id":1337}}')
                .query((params) => params.client_id === 'test' && params.action === 'create' && !Object.hasOwn(params, 'data'))
                .reply(200, {}, responseHeaders);

            await new FloraClient({ url, defaultParams: { client_id: 'test' }, forceGetParams: ['client_id'] }).execute(floraReq);

            assert.ok(req.isDone());
        });

        it('should not add httpHeaders option to request params', async () => {
            const req = nock(url, { reqheaders: { 'x-awesome': 'test' } })
                .get('/user/')
                .query((params) => !Object.hasOwn(params, 'httpHeaders'))
                .reply(200, { meta: {}, data: [] }, responseHeaders);

            await api.execute({ resource: 'user', httpHeaders: { 'X-Awesome': 'test' } });

            assert.ok(req.isDone());
        });

        describe('request id', () => {
            Object.entries({
                /* 'undefined': undefined,
                'null': null, */
                boolean: true,
                NaN,
                Infinity,
            }).forEach(([type, id]) => {
                it(`should reject ${type} as request id`, async () => {
                    await assert.rejects(() => new FloraClient({ url }).execute({ resource: 'user', id }), {
                        name: 'Error',
                        message: 'Request id must be of type number or string',
                    });
                });
            });
        });
    });

    describe('response', () => {
        it('should resolve API response', async () => {
            const data = [{ id: 1337, firstname: 'John', lastname: 'Doe' }];
            const req = nock(url).get('/user/').reply(200, { meta: {}, data }, responseHeaders);

            const response = await api.execute({ resource: 'user' });

            assert.ok(req.isDone());
            assert.ok(Object.hasOwn(response, 'data'));
            assert.deepEqual(response.data, data);
        });

        it('should reject with error', async () => {
            const message = 'Some fancy error message';
            const req = nock(url).get('/user/').reply(
                500,
                {
                    meta: {},
                    data: null,
                    error: { message },
                },
                responseHeaders,
            );

            await assert.rejects(() => api.execute({ resource: 'user' }), { name: 'Error', message });
            assert.ok(req.isDone());
        });

        it('should add response to error object', async () => {
            const floraReq = {
                resource: 'user',
                action: 'lock',
                id: 1337,
            };
            const req = nock(url)
                .post('/user/1337')
                .query({ action: 'lock' })
                .reply(
                    400,
                    {
                        meta: {},
                        data: null,
                        error: {
                            message: 'Account already locked',
                            additional: {
                                info: true,
                            },
                        },
                    },
                    responseHeaders,
                );

            await assert.rejects(
                () => api.execute(floraReq),
                (err) => {
                    assert.ok(Object.hasOwn(err, 'response'));
                    assert.deepEqual(err.response, {
                        meta: {},
                        data: null,
                        error: {
                            message: 'Account already locked',
                            additional: {
                                info: true,
                            },
                        },
                    });
                    return true;
                },
            );
            assert.ok(req.isDone());
        });

        it('should trigger an error if JSON cannot be parsed', async () => {
            const req = nock(url).get('/user/').reply(200, '["test": 123]', responseHeaders);

            await assert.rejects(() => api.execute({ resource: 'user' }), { name: 'SyntaxError' });
            assert.ok(req.isDone());
        });

        it("should not try to parse JSON if content-type doesn't match", async () => {
            const req = nock(url).get('/user/').reply(500, 'Internal Server Error', { 'Content-Type': 'text/html' });

            await assert.rejects(() => api.execute({ resource: 'user' }), {
                name: 'Error',
                message: 'Server Error: Internal Server Error',
            });
            assert.ok(req.isDone());
        });
    });

    describe('authentication', () => {
        it('should call handler function if authentication option is enabled', async () => {
            const req = nock(url, { reqheaders: { Authorization: 'Bearer __token__' } })
                .post('/user/1337')
                .reply(200, { meta: {}, data: [] }, responseHeaders);

            await new FloraClient({
                url,
                auth: (request) => {
                    request.headers.set('authorization', 'Bearer __token__');
                    return Promise.resolve(request);
                },
            }).execute({ resource: 'user', id: 1337, data: { nickname: 'John Doe' }, auth: true });

            assert.ok(req.isDone());
        });

        it('should add access_token parameter', async () => {
            const req = nock(url)
                .post('/user/1337')
                .query({
                    action: 'update',
                    access_token: '__token__',
                })
                .reply(200, { meta: {}, data: [] }, responseHeaders);

            await new FloraClient({
                url,
                auth: async (request) => {
                    const url = new URL(request.url);
                    await new Promise((resolve) => process.nextTick(resolve));
                    url.searchParams.append('access_token', '__token__');
                    return Promise.resolve(new Request(url, request));
                },
            }).execute({
                resource: 'user',
                id: 1337,
                action: 'update',
                data: { nickname: 'John Doe' },
                auth: true,
            });

            assert.ok(req.isDone());
        });

        it('should reject request if no auth handler is set', async () => {
            await assert.rejects(() => new FloraClient({ url }).execute({ resource: 'user', auth: true }), {
                name: 'Error',
                message: 'Auth requests require an auth handler',
            });
        });

        it('should not add authenticate option as request parameter', async () => {
            const req = nock(url, { reqheaders: { authorization: 'Bearer __token__' } })
                .get('/user/')
                .query((params) => !Object.hasOwn(params, 'auth'))
                .reply(200, { meta: {}, data: [] }, responseHeaders);

            await new FloraClient({
                url,
                auth: async (request) => {
                    await new Promise((resolve) => process.nextTick(resolve));
                    request.headers.set('Authorization', 'Bearer __token__');
                    return request;
                },
            }).execute({ resource: 'user', auth: true });

            assert.ok(req.isDone());
        });
    });

    describe('headers', () => {
        it('should set referer', async () => {
            const req = nock(url)
                .matchHeader('Referer', /^file:\/\/\/.*/)
                .get('/user/')
                .reply(200, {}, responseHeaders);

            await api.execute({ resource: 'user' });

            assert.ok(req.isDone());
        });
    });

    it('should use timeout setting', async (ctx) => {
        ctx.after(() => nock.abortPendingRequests());

        const req = nock(url).get('/user/').delay(500).reply(200, {}, responseHeaders);

        await assert.rejects(
            () => new FloraClient({ url, timeout: 250 }).execute({ resource: 'user' }),
            (err) => err.name === 'TimeoutError',
        );
        assert.ok(req.isDone());
    });

    it('should return API error on connection issues', async () => {
        const req = nock(url)
            .get('/user/')
            .replyWithError(Object.assign(new Error('Not found'), { code: 'ENOTFOUND' }));

        await assert.rejects(
            () => api.execute({ resource: 'user' }),
            (err) => err instanceof Error && Object.hasOwn(err, 'code') && err.code === 'ENOTFOUND',
        );

        assert.ok(req.isDone());
    });
});
