'use strict';

const has = require('has');
const assert = require('node:assert/strict');
const nock = require('nock');
const FloraClient = require('../build/node');

describe('Flora node client', () => {
    const url = 'http://api.example.com/';
    const api = new FloraClient({ url });
    let req;

    afterEach(() => {
        if (req) req.done();
        nock.cleanAll();
    });

    after(() => nock.restore());

    describe('interface', () => {
        it('should require url on initialization', () => {
            assert.throws(() => new FloraClient({}), { name: 'Error', message: 'Flora API url must be set' });
        });

        it('should define execute function', () => {
            assert.equal(typeof new FloraClient({ url: 'http://example.com/' }).execute, 'function');
        });
    });

    describe('request', () => {
        const response = { meta: {}, data: {} };

        it('should add resource to path', async () => {
            req = nock(url).get('/user/').reply(200, response, { 'Content-Type': 'application/json; charset=utf-8' });

            await api.execute({ resource: 'user' });

            assert.ok(req.isDone());
        });

        it('should add id to path', async () => {
            req = nock(url).get('/user/1337').reply(200, response, { 'Content-Type': 'application/json; charset=utf-8' });

            await api.execute({ resource: 'user', id: 1337 });

            assert.ok(req.isDone());
        });

        it('should treat action=retrieve as standard (and not transmit it)', async () => {
            req = nock(url)
                .get('/user/')
                .query((queryObj) => !has(queryObj, 'action'))
                .reply(200, response, { 'Content-Type': 'application/json; charset=utf-8' });

            await api.execute({ resource: 'user', action: 'retrieve' });

            assert.ok(req.isDone());
        });

        it('should add action parameter', async () => {
            req = nock(url)
                .post('/user/1337')
                .query({ action: 'update' })
                .reply(200, response, { 'Content-Type': 'application/json; charset=utf-8' });

            await api.execute({ resource: 'user', id: 1337, action: 'update' });

            assert.ok(req.isDone());
        });

        Object.entries({
            string: 'id,lastname,address.city,comments(order=ts:desc)[id,body]',
            'array/object': ['id', 'lastname', 'address.city', { 'comments(order=ts:desc)': ['id', 'body'] }],
        }).forEach(([type, select]) => {
            it(`should add select as ${type} parameter to query`, async () => {
                req = nock(url)
                    .get('/user/?select=id%2Clastname%2Caddress.city%2Ccomments(order%3Dts%3Adesc)%5Bid%2Cbody%5D')
                    .reply(200, response, { 'Content-Type': 'application/json; charset=utf-8' });

                await api.execute({ resource: 'user', select });

                assert.ok(req.isDone());
            });
        });

        it('should add filter parameter to query', async () => {
            req = nock(url)
                .get('/user/?filter=address%5Bcountry.iso2%3DDE%20AND%20city%3DMunich%5D%20OR%20profession%3DTrader')
                .reply(200, response, { 'Content-Type': 'application/json; charset=utf-8' });

            await api.execute({ resource: 'user', filter: 'address[country.iso2=DE AND city=Munich] OR profession=Trader' });

            assert.ok(req.isDone());
        });

        it('should add order parameter to query', async () => {
            req = nock(url)
                .get('/user/?order=lastname%3Aasc%2Cfirstname%3Adesc')
                .reply(200, response, { 'Content-Type': 'application/json; charset=utf-8' });

            await api.execute({ resource: 'user', order: 'lastname:asc,firstname:desc' });

            assert.ok(req.isDone());
        });

        Object.entries({
            'should add non-falsy limit parameter to query': 15,
            'should add falsy limit parameter to query': 0,
        }).forEach(([description, limit]) => {
            it(description, async () => {
                req = nock(url).get(`/user/?limit=${limit}`).reply(200, response, { 'Content-Type': 'application/json; charset=utf-8' });

                await api.execute({ resource: 'user', limit });

                assert.ok(req.isDone());
            });
        });

        it('should add page parameter to query', async () => {
            req = nock(url).get('/user/?page=2').reply(200, response, { 'Content-Type': 'application/json; charset=utf-8' });

            await api.execute({ resource: 'user', page: 2 });

            assert.ok(req.isDone());
        });

        it('should add search parameter to query', async () => {
            req = nock(url)
                .get('/user/?search=full%20text%20search')
                .reply(200, response, { 'Content-Type': 'application/json; charset=utf-8' });

            await api.execute({ resource: 'user', search: 'full text search' });

            assert.ok(req.isDone());
        });

        it('should add cache breaker parameter to query', async () => {
            req = nock(url)
                .filteringPath(/_=\d+/, '_=xxx')
                .get('/user/?_=xxx')
                .reply(200, response, { 'Content-Type': 'application/json; charset=utf-8' });

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

            req = nock(url, {
                reqheaders: {
                    'content-type': 'application/json; charset=utf-8',
                    'content-length': 44,
                },
            })
                .post('/article/', '{"title":"Lorem Ipsum","author":{"id":1337}}')
                .query({ action: 'create' })
                .reply(200, response, { 'Content-Type': 'application/json; charset=utf-8' });

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

            req = nock(url, {
                reqheaders: {
                    'content-type': 'application/json; charset=utf-8',
                    'content-length': 64,
                },
            })
                .post('/article/', '{"title":"this is a non-breaking space: ","author":{"id":1337}}')
                .query({ action: 'create' })
                .reply(200, response, { 'Content-Type': 'application/json; charset=utf-8' });

            await api.execute(floraReq);

            assert.ok(req.isDone());
        });

        describe('HTTP method', () => {
            it('should use GET for "retrieve" actions', async () => {
                req = nock(url).get('/user/1337').reply(200, response, { 'Content-Type': 'application/json; charset=utf-8' });

                await api.execute({ resource: 'user', id: 1337, action: 'retrieve' });

                assert.ok(req.isDone());
            });

            it('should use GET if action is not set', async () => {
                req = nock(url).get('/user/1337').reply(200, response);

                await api.execute({ resource: 'user', id: 1337 });

                assert.ok(req.isDone());
            });

            it('should use POST for other actions than "retrieve"', async () => {
                req = nock(url, {
                    reqheaders: { 'content-type': (header) => header.includes('application/x-www-form-urlencoded') },
                })
                    .post('/user/1337')
                    .query({ action: 'lock' })
                    .reply(200, response, { 'Content-Type': 'application/json; charset=utf-8' });

                await api.execute({ resource: 'user', id: 1337, action: 'lock' });

                assert.ok(req.isDone());
            });

            it('should explicitly overwrite HTTP method by parameter', async () => {
                req = nock(url)
                    .get('/user/')
                    .query({ action: 'search', customParameter: 1 })
                    .reply(200, response, { 'Content-Type': 'application/json; charset=utf-8' });

                await api.execute({
                    resource: 'user',
                    action: 'search',
                    customParameter: 1,
                    httpMethod: 'GET',
                });

                assert.ok(req.isDone());
            });

            it('should switch to POST if querystring gets too large', async () => {
                const floraReq = {
                    resource: 'user',
                    select: 'select'.repeat(150),
                    filter: 'filter'.repeat(150),
                    search: 'search term'.repeat(150),
                    limit: 100,
                    page: 10,
                };

                req = nock(url)
                    .post('/user/', /select=(select){100,}/)
                    .reply(200, response);

                await api.execute(floraReq);

                assert.ok(req.isDone());
            });
        });
    });

    describe('parameters', () => {
        it('should support default parameters', async () => {
            req = nock(url).get('/user/1337?param=abc').reply(200, {}, { 'Content-Type': 'application/json; charset=utf-8' });

            await new FloraClient({ url, defaultParams: { param: 'abc' } }).execute({ resource: 'user', id: 1337 });

            assert.ok(req.isDone());
        });

        it('should use request parameter if default exists with same name', async () => {
            req = nock(url).get('/user/1337?param=xyz').reply(200, {}, { 'Content-Type': 'application/json; charset=utf-8' });

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

            req = nock(url)
                .post('/article/', '{"title":"Lorem Ipsum","author":{"id":1337}}')
                .query({
                    client_id: 1,
                    action: 'create',
                })
                .reply(200, {}, { 'Content-Type': 'application/json; charset=utf-8' });

            await new FloraClient({ url, defaultParams: { client_id: 1 }, forceGetParams: ['client_id'] }).execute(floraReq);

            assert.ok(req.isDone());
        });

        it('should not add httpHeaders option to request params', async () => {
            req = nock(url)
                .get('/user/')
                .query((queryObj) => !has(queryObj, 'httpHeaders'))
                .reply(200, { meta: {}, data: [] }, { 'Content-Type': 'application/json; charset=utf-8' });

            await api.execute({ resource: 'user', httpHeaders: { 'X-Awesome': 'test' } });

            assert.ok(req.isDone());
        });

        describe('request id', () => {
            const reqIdApi = new FloraClient({ url: 'http://example.com/' });
            const invalidIds = {
                /* 'undefined': undefined,
                'null': null, */
                boolean: true,
                NaN,
                Infinity,
            };

            Object.entries(invalidIds).forEach(([type, id]) => {
                it(`should reject ${type} as request id`, async () => {
                    await assert.rejects(async () => await reqIdApi.execute({ resource: 'user', id }), {
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

            req = nock(url).get('/user/').reply(200, { meta: {}, data }, { 'Content-Type': 'application/json; charset=utf-8' });

            const response = await api.execute({ resource: 'user' });

            assert.deepEqual(response.data, data);
            assert.ok(req.isDone());
        });

        it('should reject with error', async () => {
            req = nock(url)
                .get('/user/')
                .reply(
                    500,
                    {
                        meta: {},
                        data: null,
                        error: {
                            message: 'foobar',
                        },
                    },
                    { 'Content-Type': 'application/json; charset=utf-8' },
                );

            await assert.rejects(async () => await api.execute({ resource: 'user' }), {
                name: 'Error',
                message: 'foobar',
            });
            assert.ok(req.isDone());
        });

        it('should add response to error object', async () => {
            const floraReq = {
                resource: 'user',
                action: 'lock',
                id: 1337,
            };

            req = nock(url)
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
                    { 'Content-Type': 'application/json; charset=utf-8' },
                );

            await assert.rejects(
                async () => await api.execute(floraReq),
                (err) => {
                    assert.ok(typeof err.response === 'object');
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
            req = nock(url).get('/user/').reply(200, '["test": 123]', { 'Content-Type': 'application/json; charset=utf-8' });

            await assert.rejects(async () => api.execute({ resource: 'user' }), { name: 'SyntaxError' });
            assert.ok(req.isDone());
        });

        it("should not try to parse JSON if content-type doesn't match", async () => {
            req = nock(url).get('/user/').reply(500, 'Internal Server Error', { 'Content-Type': 'text/html' });

            await assert.rejects(async () => api.execute({ resource: 'user' }), {
                name: 'Error',
                message: 'Server Error: Invalid content type: "text/html"',
            });
            assert.ok(req.isDone());
        });
    });

    describe('authentication', () => {
        it('should call handler function if authentication option is enabled', async () => {
            const auth = (floraReq) => {
                floraReq.httpHeaders.Authorization = 'Bearer __token__';
                return Promise.resolve();
            };

            req = nock(url, { reqheaders: { Authorization: 'Bearer __token__' } })
                .get('/user/')
                .reply(200, { meta: {}, data: [] }, { 'Content-Type': 'application/json; charset=utf-8' });

            await new FloraClient({ url, auth }).execute({ resource: 'user', auth: true });
            assert.ok(req.isDone());
        });

        it('should add access_token parameter', async () => {
            const auth = (floraReq) => {
                floraReq.access_token = '__token__';
                return Promise.resolve();
            };

            req = nock(url)
                .post('/user/1337')
                .query({
                    access_token: '__token__',
                    action: 'update',
                })
                .reply(200, { meta: {}, data: [] }, { 'Content-Type': 'application/json; charset=utf-8' });

            await new FloraClient({ url, auth }).execute({
                resource: 'user',
                id: 1337,
                action: 'update',
                auth: true,
            });
            assert.ok(req.isDone());
        });

        it('should reject request if no auth handler is set', async () => {
            await assert.rejects(async () => await new FloraClient({ url }).execute({ resource: 'user', auth: true }), {
                name: 'Error',
                message: 'Auth requests require an auth handler',
            });
        });

        it('should not add authenticate option as request parameter', async () => {
            const auth = () => Promise.resolve();

            req = nock(url)
                .get('/user/')
                .query((queryObj) => !has(queryObj, 'auth'))
                .reply(200, { meta: {}, data: [] }, { 'Content-Type': 'application/json; charset=utf-8' });

            await new FloraClient({ url, auth }).execute({ resource: 'user', auth: true });

            assert.ok(req.isDone());
        });
    });

    describe('formats', () => {
        it('should trigger an error on non-JSON formats', async () => {
            await assert.rejects(async () => api.execute({ resource: 'user', format: 'pdf' }), {
                name: 'Error',
                message: 'Only JSON format supported',
            });
        });
    });

    describe('protocols', () => {
        it('should support HTTPS', async () => {
            const httpsUrl = 'https://api.example.com';
            const secureApi = new FloraClient({ url: httpsUrl });

            req = nock(httpsUrl).get('/user/').reply(200, {}, { 'Content-Type': 'application/json; charset=utf-8' });

            await secureApi.execute({ resource: 'user' });

            assert.ok(req.isDone());
        });
    });

    describe('headers', () => {
        it('should set referer', async () => {
            req = nock(url)
                .matchHeader('Referer', /^file:\/\/\/.*/)
                .get('/user/')
                .reply(200, {}, { 'Content-Type': 'application/json; charset=utf-8' });

            await api.execute({ resource: 'user' });

            assert.ok(req.isDone());
        });
    });

    describe('timeouts', () => {
        afterEach(() => nock.abortPendingRequests());

        it('should use default request timeout', async () => {
            req = nock(url).get('/user/').delayConnection(20000).reply(200, {}, { 'Content-Type': 'application/json; charset=utf-8' });

            await assert.rejects(async () => api.execute({ resource: 'user' }), {
                name: 'Error',
                code: 'ETIMEDOUT',
            });

            assert.ok(req.isDone());
        });

        it('should use configurable request timeout', async () => {
            req = nock(url).get('/user/').delayConnection(6000).reply(200, {}, { 'Content-Type': 'application/json; charset=utf-8' });

            await assert.rejects(async () => new FloraClient({ url, timeout: 5000 }).execute({ resource: 'user' }), {
                name: 'Error',
                code: 'ETIMEDOUT',
            });

            assert.ok(req.isDone());
        });
    });

    it('should return API error on connection issues', async () => {
        // nock can't fake request errors at the moment, so we have to make
        // a real request to nonexistent host
        const nonExistentApi = new FloraClient({ url: 'http://non-existent.api.localhost' });

        nock.enableNetConnect();
        await assert.rejects(async () => nonExistentApi.execute({ resource: 'user' }), {
            name: 'Error',
        });
        nock.disableNetConnect();
    });
});
