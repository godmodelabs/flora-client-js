'use strict';

const has = require('has');
const { expect } = require('chai');
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
            expect(() => new FloraClient({})).to.throw(Error, 'Flora API url must be set');
        });

        it('should define execute function', () => {
            expect(new FloraClient({ url: 'http://example.com/' }).execute).to.be.a('function');
        });
    });

    describe('request', () => {
        const response = { meta: {}, data: {} };

        it('should add resource to path', (done) => {
            req = nock(url)
                .get('/user/')
                .reply(200, response, { 'Content-Type': 'application/json; charset=utf-8' });

            api.execute({ resource: 'user' })
                .then(() => done())
                .catch(done);
        });

        it('should add id to path', (done) => {
            req = nock(url)
                .get('/user/1337')
                .reply(200, response, { 'Content-Type': 'application/json; charset=utf-8' });

            api.execute({ resource: 'user', id: 1337 })
                .then(() => done())
                .catch(done);
        });

        it('should treat action=retrieve as standard (and not transmit it)', (done) => {
            req = nock(url)
                .get('/user/')
                .query((queryObj) => !has(queryObj, 'action'))
                .reply(200, response, { 'Content-Type': 'application/json; charset=utf-8' });

            api.execute({ resource: 'user', action: 'retrieve' })
                .then(() => done())
                .catch(done);
        });

        it('should add action parameter', (done) => {
            req = nock(url)
                .post('/user/1337')
                .query({ action: 'update' })
                .reply(200, response, { 'Content-Type': 'application/json; charset=utf-8' });

            api.execute({ resource: 'user', id: 1337, action: 'update' })
                .then(() => done())
                .catch(done);
        });

        Object.entries({
            string: 'id,lastname,address.city,comments(order=ts:desc)[id,body]',
            'array/object': [
                'id',
                'lastname',
                'address.city',
                { 'comments(order=ts:desc)': ['id', 'body'] }
            ]
        }).forEach(([type, select]) => {
            it(`should add select as ${type} parameter to query`, (done) => {
                req = nock(url)
                    .get('/user/?select=id%2Clastname%2Caddress.city%2Ccomments(order%3Dts%3Adesc)%5Bid%2Cbody%5D')
                    .reply(200, response, { 'Content-Type': 'application/json; charset=utf-8' });

                api.execute({ resource: 'user', select })
                    .then(() => done())
                    .catch(done);
            });
        });

        it('should add filter parameter to query', (done) => {
            req = nock(url)
                .get('/user/?filter=address%5Bcountry.iso2%3DDE%20AND%20city%3DMunich%5D%20OR%20profession%3DTrader')
                .reply(200, response, { 'Content-Type': 'application/json; charset=utf-8' });

            api.execute({ resource: 'user', filter: 'address[country.iso2=DE AND city=Munich] OR profession=Trader' })
                .then(() => done())
                .catch(done);
        });

        it('should add order parameter to query', (done) => {
            req = nock(url)
                .get('/user/?order=lastname%3Aasc%2Cfirstname%3Adesc')
                .reply(200, response, { 'Content-Type': 'application/json; charset=utf-8' });

            api.execute({ resource: 'user', order: 'lastname:asc,firstname:desc' })
                .then(() => done())
                .catch(done);
        });

        Object.entries({
            'should add non-falsy limit parameter to query': 15,
            'should add falsy limit parameter to query': 0,
        }).forEach(([description, limit]) => {
            it(description, (done) => {
                req = nock(url)
                    .get(`/user/?limit=${limit}`)
                    .reply(200, response, { 'Content-Type': 'application/json; charset=utf-8' });

                api.execute({ resource: 'user', limit })
                    .then(() => done())
                    .catch(done);
            });
        });

        it('should add page parameter to query', (done) => {
            req = nock(url)
                .get('/user/?page=2')
                .reply(200, response, { 'Content-Type': 'application/json; charset=utf-8' });

            api.execute({ resource: 'user', page: 2 })
                .then(() => done())
                .catch(done);
        });

        it('should add search parameter to query', (done) => {
            req = nock(url)
                .get('/user/?search=full%20text%20search')
                .reply(200, response, { 'Content-Type': 'application/json; charset=utf-8' });

            api.execute({ resource: 'user', search: 'full text search' })
                .then(() => done())
                .catch(done);
        });

        it('should add cache breaker parameter to query', (done) => {
            req = nock(url)
                .filteringPath(/_=\d+/, '_=xxx')
                .get('/user/?_=xxx')
                .reply(200, response, { 'Content-Type': 'application/json; charset=utf-8' });

            api.execute({ resource: 'user', cache: false })
                .then(() => done())
                .catch(done);
        });

        it('should post content in data key as JSON', (done) => {
            const floraReq = {
                resource: 'article',
                action: 'create',
                data: {
                    title: 'Lorem Ipsum',
                    author: { id: 1337 }
                }
            };

            req = nock(url, {
                reqheaders: {
                    'content-type': 'application/json',
                    'content-length': 44
                }
            })
                .post('/article/', '{"title":"Lorem Ipsum","author":{"id":1337}}')
                .query({ action: 'create' })
                .reply(200, response, { 'Content-Type': 'application/json; charset=utf-8' });

            api.execute(floraReq)
                .then(() => done())
                .catch(done);
        });

        it('should set a proper Content-Length when POSTing Unicode characters', (done) => {
            const floraReq = {
                resource: 'article',
                action: 'create',
                data: {
                    title: 'this is a non-breaking space: ',
                    author: { id: 1337 }
                }
            };

            req = nock(url, {
                reqheaders: {
                    'content-type': 'application/json',
                    'content-length': 64
                }
            })
                .post('/article/', '{"title":"this is a non-breaking space: ","author":{"id":1337}}')
                .query({ action: 'create' })
                .reply(200, response, { 'Content-Type': 'application/json; charset=utf-8' });

            api.execute(floraReq)
                .then(() => done())
                .catch(done);
        });

        describe('HTTP method', () => {
            it('should use GET for "retrieve" actions', (done) => {
                req = nock(url)
                    .get('/user/1337')
                    .reply(200, response, { 'Content-Type': 'application/json; charset=utf-8' });

                api.execute({ resource: 'user', id: 1337, action: 'retrieve' })
                    .then(() => done())
                    .catch(done);
            });

            it('should use GET if action is not set', (done) => {
                req = nock(url)
                    .get('/user/1337')
                    .reply(200, response);

                api.execute({ resource: 'user', id: 1337 })
                    .then(() => done())
                    .catch(done);
            });

            it('should use POST for other actions than "retrieve"', (done) => {
                req = nock(url, {
                    reqheaders: { 'content-type': (header) => header.includes('application/x-www-form-urlencoded') }
                })
                    .post('/user/1337')
                    .query({ action: 'lock' })
                    .reply(200, response, { 'Content-Type': 'application/json; charset=utf-8' });

                api.execute({ resource: 'user', id: 1337, action: 'lock' })
                    .then(() => done())
                    .catch(done);
            });

            it('should explicitly overwrite method by parameter', (done) => {
                req = nock(url)
                    .head('/user/1337')
                    .reply(200, response, { 'Content-Type': 'application/json; charset=utf-8' });

                api.execute({ resource: 'user', id: 1337, httpMethod: 'HEAD' })
                    .then(() => done())
                    .catch(done);
            });

            it('should switch to POST if querystring gets too large', (done) => {
                const floraReq = {
                    resource: 'user',
                    select: 'select'.repeat(150),
                    filter: 'filter'.repeat(150),
                    search: 'search term'.repeat(150),
                    limit: 100,
                    page: 10
                };

                req = nock(url)
                    .post('/user/', /select=(select){100,}/)
                    .reply(200, response);

                api.execute(floraReq)
                    .then(() => done())
                    .catch(done);
            });
        });
    });

    describe('parameters', () => {
        it('should support default parameters', (done) => {
            req = nock(url)
                .get('/user/1337?param=abc')
                .reply(200, {}, { 'Content-Type': 'application/json; charset=utf-8' });

            (new FloraClient({ url, defaultParams: { param: 'abc' } }))
                .execute({ resource: 'user', id: 1337 })
                .then(() => done())
                .catch(done);
        });

        it('should use request parameter if default exists with same name', (done) => {
            req = nock(url)
                .get('/user/1337?param=xyz')
                .reply(200, {}, { 'Content-Type': 'application/json; charset=utf-8' });

            (new FloraClient({ url, defaultParams: { param: 'abc' } }))
                .execute({ resource: 'user', id: 1337, param: 'xyz' })
                .then(() => done())
                .catch(done);
        });

        it('should send selected parameters as part of the querystring', (done) => {
            const floraReq = {
                resource: 'article',
                action: 'create',
                data: {
                    title: 'Lorem Ipsum',
                    author: { id: 1337 }
                }
            };

            req = nock(url)
                .post('/article/', '{"title":"Lorem Ipsum","author":{"id":1337}}')
                .query({
                    client_id: 1,
                    action: 'create'
                })
                .reply(200, {}, { 'Content-Type': 'application/json; charset=utf-8' });

            (new FloraClient({ url, defaultParams: { client_id: 1 }, forceGetParams: ['client_id'] }))
                .execute(floraReq)
                .then(() => done())
                .catch(done);
        });

        it('should not add httpHeaders option to request params', (done) => {
            req = nock(url)
                .get('/user/')
                .query((queryObj) => !has(queryObj, 'httpHeaders'))
                .reply(200, { meta: {}, data: [] }, { 'Content-Type': 'application/json; charset=utf-8' });

            api.execute({ resource: 'user', httpHeaders: { 'X-Awesome': 'test' } })
                .then(() => done())
                .catch(done);
        });

        describe('request id', () => {
            const reqIdApi = new FloraClient({ url: 'http://example.com/' });
            const invalidIds = {
                /* 'undefined': undefined,
                'null': null, */
                boolean: true,
                NaN,
                Infinity
            };

            Object.keys(invalidIds).forEach((type) => {
                it(`should reject ${type} as request id`, (done) => {
                    const invalidId = invalidIds[type];

                    reqIdApi.execute({ resource: 'user', id: invalidId })
                        .then(() => done(new Error('Expected promise to reject')))
                        .catch((err) => {
                            expect(err).to.be.instanceof(Error)
                                .and.to.have.property('message', 'Request id must be of type number or string');
                            done();
                        });
                });
            });
        });
    });

    describe('response', () => {
        it('should resolve API response', (done) => {
            const data = [{ id: 1337, firstname: 'John', lastname: 'Doe' }];

            req = nock(url)
                .get('/user/')
                .reply(200, { meta: {}, data }, { 'Content-Type': 'application/json; charset=utf-8' });

            api.execute({ resource: 'user' })
                .then((response) => {
                    expect(response.data).to.eql(data);
                    done();
                })
                .catch(done);
        });

        it('should reject with error', (done) => {
            req = nock(url)
                .get('/user/')
                .reply(500, {
                    meta: {},
                    data: null,
                    error: {
                        message: 'foobar'
                    }
                }, { 'Content-Type': 'application/json; charset=utf-8' });

            api.execute({ resource: 'user' })
                .then(() => done(new Error('Expected promise to reject')))
                .catch((err) => {
                    expect(err).to.be.instanceof(Error);
                    expect(err.message).to.equal('foobar');
                    done();
                });
        });

        it('should add response to error object', (done) => {
            const floraReq = {
                resource: 'user',
                action: 'lock',
                id: 1337
            };

            req = nock(url)
                .post('/user/1337')
                .query({ action: 'lock' })
                .reply(400, {
                    meta: {},
                    data: null,
                    error: {
                        message: 'Account already locked',
                        additional: {
                            info: true
                        }
                    }
                }, { 'Content-Type': 'application/json; charset=utf-8' });

            api.execute(floraReq)
                .then(() => done(new Error('Expected promise to reject')))
                .catch((err) => {
                    expect(err)
                        .to.have.property('response')
                        .and.to.eql({
                            meta: {},
                            data: null,
                            error: {
                                message: 'Account already locked',
                                additional: {
                                    info: true
                                }
                            }
                        });
                    done();
                });
        });

        it('should trigger an error if JSON cannot be parsed', (done) => {
            req = nock(url)
                .get('/user/')
                .reply(200, '["test": 123]', { 'Content-Type': 'application/json; charset=utf-8' });

            api.execute({ resource: 'user' })
                .then(() => done(new Error('Expected promise to reject')))
                .catch((err) => {
                    expect(err).to.be.instanceOf(SyntaxError)
                        .with.property('message', 'Unexpected token : in JSON at position 7');
                    done();
                });
        });

        it('should not try to parse JSON if content-type doesn\'t match', (done) => {
            req = nock(url)
                .get('/user/')
                .reply(500, 'Internal Server Error', { 'Content-Type': 'text/html' });

            api.execute({ resource: 'user' })
                .then(() => done(new Error('Expected promise to reject')))
                .catch((err) => {
                    expect(err).to.be.instanceOf(Error)
                        .with.property('message', 'Server Error: Invalid content type: "text/html"');
                    done();
                });
        });
    });

    describe('authentication', () => {
        it('should call handler function if authentication option is enabled', (done) => {
            const auth = (floraReq) => {
                floraReq.httpHeaders.Authorization = 'Bearer __token__';
                return Promise.resolve();
            };

            req = nock(url, { reqheaders: { Authorization: 'Bearer __token__' } })
                .get('/user/')
                .reply(200, { meta: {}, data: [] }, { 'Content-Type': 'application/json; charset=utf-8' });

            (new FloraClient({ url, auth }))
                .execute({ resource: 'user', auth: true })
                .then(() => done())
                .catch(done);
        });

        it('should add access_token parameter', (done) => {
            const auth = (floraReq) => {
                floraReq.access_token = '__token__';
                return Promise.resolve();
            };

            req = nock(url)
                .post('/user/1337')
                .query({
                    access_token: '__token__',
                    action: 'update'
                })
                .reply(200, { meta: {}, data: [] }, { 'Content-Type': 'application/json; charset=utf-8' });

            (new FloraClient({ url, auth }))
                .execute({
                    resource: 'user', id: 1337, action: 'update', auth: true
                })
                .then(() => done())
                .catch(done);
        });

        it('should reject request if no auth handler is set', (done) => {
            (new FloraClient({ url }))
                .execute({ resource: 'user', auth: true })
                .then(() => done(new Error('Expected promise to reject')))
                .catch((err) => {
                    expect(err).to.be.instanceOf(Error)
                        .and.to.have.property('message')
                        .and.to.contain('Auth requests require an auth handler');
                    done();
                });
        });

        it('should not add authenticate option as request parameter', (done) => {
            const auth = () => Promise.resolve();

            req = nock(url)
                .get('/user/')
                .query((queryObj) => !has(queryObj, 'auth'))
                .reply(200, { meta: {}, data: [] }, { 'Content-Type': 'application/json; charset=utf-8' });

            (new FloraClient({ url, auth }))
                .execute({ resource: 'user', auth: true })
                .then(() => done())
                .catch(done);
        });
    });

    describe('formats', () => {
        it('should trigger an error on non-JSON formats', (done) => {
            api.execute({ resource: 'user', format: 'pdf' })
                .then(() => done(new Error('Expected promise to reject')))
                .catch((err) => {
                    expect(err).to.be.instanceof(Error);
                    expect(err.message).to.equal('Only JSON format supported');
                    done();
                });
        });
    });

    describe('protocols', () => {
        it('should support HTTPS', (done) => {
            const httpsUrl = 'https://api.example.com';
            const secureApi = new FloraClient({ url: httpsUrl });

            req = nock(httpsUrl)
                .get('/user/')
                .reply(200, {}, { 'Content-Type': 'application/json; charset=utf-8' });

            secureApi.execute({ resource: 'user' })
                .then(() => done())
                .catch(done);
        });
    });

    describe('headers', () => {
        it('should set referer', (done) => {
            req = nock(url)
                .matchHeader('Referer', /^file:\/\/\/.*/)
                .get('/user/')
                .reply(200, {}, { 'Content-Type': 'application/json; charset=utf-8' });

            api.execute({ resource: 'user' })
                .then(() => done())
                .catch(done);
        });
    });

    describe('timeouts', () => {
        afterEach(() => nock.abortPendingRequests());

        it('should use default request timeout', (done) => {
            req = nock(url)
                .get('/user/')
                .delayConnection(20000)
                .reply(200, {}, { 'Content-Type': 'application/json; charset=utf-8' });

            api.execute({ resource: 'user' })
                .then(() => done(new Error('Expected promise to reject')))
                .catch((err) => {
                    expect(err)
                        .to.be.instanceOf(Error)
                        .and.to.have.property('code', 'ETIMEDOUT');
                    done();
                });
        });

        it('should use configurable request timeout', (done) => {
            req = nock(url)
                .get('/user/')
                .delayConnection(6000)
                .reply(200, {}, { 'Content-Type': 'application/json; charset=utf-8' });

            (new FloraClient({ url, timeout: 5000 }))
                .execute({ resource: 'user' })
                .then(() => done(new Error('Expected promise to reject')))
                .catch((err) => {
                    expect(err).to.be.instanceOf(Error)
                        .and.to.have.property('code', 'ETIMEDOUT');
                    done();
                });
        });
    });

    it('should return API error on connection issues', (done) => {
        // nock can't fake request errors at the moment, so we have to make
        // a real request to nonexistent host
        const nonExistentApi = new FloraClient({ url: 'http://non-existent.api.localhost' });

        nock.enableNetConnect();
        nonExistentApi.execute({ resource: 'user' })
            .then(() => done(new Error('Expected promise to reject')))
            .catch((err) => {
                expect(err).to.be.instanceof(Error);
                done();
            });
        nock.disableNetConnect();
    });
});
