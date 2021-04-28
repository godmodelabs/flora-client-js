'use strict';

const { expect } = require('chai');
const sinon = require('sinon');

const FloraClient = require('../build/browser');

describe('Flora client', () => {
    const url = 'http://api.example.com';
    let api;

    beforeEach(() => {
        api = new FloraClient({ url });
    });

    describe('interface', () => {
        it('should require url on initialization', () => {
            expect(() => new FloraClient({})).to.throw(Error, 'Flora API url must be set');
        });

        it('should define execute function', () => {
            expect(new FloraClient({ url: 'http://example.com/' }).execute).to.be.a('function');
        });
    });

    describe('request', () => {
        let requests;
        let xhr;

        beforeEach(() => {
            requests = [];
            xhr = sinon.useFakeXMLHttpRequest();
            xhr.onCreate = (req) => requests.push(req);
        });

        afterEach(() => xhr.restore());

        it('should add resource to path', () => {
            api.execute({ resource: 'user' });
            expect(requests[0].url).to.contain(`${url}/user/`);
            expect(requests[0].url).to.not.contain('resource='); // querystring shouldn't contain resource param
        });

        it('should add id to path', () => {
            api.execute({ resource: 'user', id: 1337 });
            expect(requests[0].url).to.contain(`${url}/user/1337`);
            expect(requests[0].url).to.not.contain('id='); // querystring shouldn't contain id param
        });

        it('should treat action=retrieve as standard (and not transmit it)', () => {
            api.execute({ resource: 'user', action: 'retrieve' });
            expect(requests[0].url).not.to.contain('action=retrieve');
        });

        it('should add action parameter', () => {
            api.execute({ resource: 'user', id: 1337, action: 'awesome' });
            expect(requests[0]).to.have.property('url')
                .and.to.contain('action=awesome');
        });

        Object.entries({
            string: 'id,address.city,comments(order=ts:desc)[id,body]',
            'array/object': [
                'id',
                'address.city',
                { 'comments(order=ts:desc)': ['id', 'body'] }
            ]
        }).forEach(([type, select]) => {
            it(`should add select as ${type} parameter to querystring`, () => {
                api.execute({ resource: 'user', select });
                expect(requests[0].url).to.contain('select=id%2Caddress.city%2Ccomments(order%3Dts%3Adesc)%5Bid%2Cbody%5D');
            });
        });

        it('should add filter parameter to querystring', () => {
            api.execute({ resource: 'user', filter: 'address[country.iso2=DE AND city=Munich]' });
            expect(requests[0].url).to.contain('filter=address%5Bcountry.iso2%3DDE%20AND%20city%3DMunich%5D');
        });

        Object.entries({
            'should add non-falsy limit parameter to querystring': 15,
            'should add falsy limit parameter to query': 0,
        }).forEach(([description, limit]) => {
            it(description, () => {
                api.execute({ resource: 'user', limit });
                expect(requests[0].url).to.contain(`limit=${limit}`);
            });
        });

        it('should add page parameter to querystring', () => {
            api.execute({ resource: 'user', page: 2 });
            expect(requests[0].url).to.contain('page=2');
        });

        it('should add search parameter to querystring', () => {
            api.execute({ resource: 'user', search: 'full text search' });
            expect(requests[0].url).to.contain('search=full%20text%20search');
        });

        it('should add cache breaker to querystring', () => {
            api.execute({ resource: 'user', cache: false });
            expect(requests[0].url).to.match(/_=\d+/);
            expect(requests[0].url).to.not.contain('cache=');
        });

        it('should post content in data key as JSON', () => {
            api.execute({
                resource: 'article',
                action: 'create',
                data: {
                    title: 'Lorem Ipsum',
                    author: { id: 1337 }
                }
            });

            const request = requests[0];
            expect(request.method).to.equal('POST');
            expect(request.url).to.contain('action=create');
            expect(request.requestHeaders).to.include.keys('Content-Type');
            expect(request.requestHeaders['Content-Type']).to.contain('application/json');
            expect(request.requestBody).to.equal('{"title":"Lorem Ipsum","author":{"id":1337}}');
        });

        it('should not add httpHeaders option to request params', () => {
            api.execute({ resource: 'user', httpHeaders: { 'X-Awesome': 'test' } });
            expect(requests[0]).to.have.property('url')
                .and.not.to.contain('httpHeaders=');
        });

        describe('parameters', () => {
            it('should support defaults', () => {
                (new FloraClient({ url, defaultParams: { param: 'abc' } }))
                    .execute({ resource: 'user', id: 1337 });

                expect(requests[0].url).to.contain('/user/1337?param=abc');
            });

            it('should use request parameter if default exists with same name', () => {
                (new FloraClient({ url, defaultParams: { param: 'abc' } }))
                    .execute({ resource: 'user', id: 1337, param: 'xyz' });

                expect(requests[0].url).to.contain('/user/1337?param=xyz');
            });

            it('should send selected parameters as part of the querystring', () => {
                (new FloraClient({ url, forceGetParams: ['foobar'] }))
                    .execute({
                        resource: 'article',
                        action: 'create',
                        data: {
                            title: 'Lorem Ipsum',
                            author: { id: 1337 }
                        },
                        foobar: 1
                    });

                const request = requests[0];
                expect(request.url).to.contain('foobar=1');
                expect(request.requestBody).to.equal('{"title":"Lorem Ipsum","author":{"id":1337}}');
            });
        });

        describe('HTTP method', () => {
            it('should use GET for "retrieve" actions', () => {
                api.execute({ resource: 'user', id: 1337, action: 'retrieve' });
                expect(requests[0].method).to.equal('GET');
            });

            it('should use GET if action is not set', () => {
                api.execute({ resource: 'user', id: 1337 });
                expect(requests[0].method).to.equal('GET');
            });

            it('should use POST for other actions than "retrieve"', () => {
                api.execute({ resource: 'user', id: 1337, action: 'lock' });

                expect(requests[0]).to.have.property('method', 'POST');
                expect(requests[0].requestBody).equal(undefined);
                expect(requests[0].requestHeaders).to.have.property('Content-Type')
                    .and.to.contain('application/x-www-form-urlencoded');
            });

            it('should explicitly overwrite method by parameter', () => {
                api.execute({ resource: 'user', id: 1337, httpMethod: 'HEAD' });
                expect(requests[0].method).to.equal('HEAD');
            });

            it('should switch to POST if querystring gets too large', () => {
                api.execute({
                    resource: 'user',
                    select: 'select'.repeat(150),
                    filter: 'filter'.repeat(150),
                    search: 'search term'.repeat(150),
                    limit: 100,
                    page: 10
                });

                expect(requests[0].method).to.equal('POST');
            });
        });

        describe('request id check', () => {
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

    describe('auth', () => {
        let server;

        beforeEach(() => {
            server = sinon.createFakeServer();
            server.autoRespond = true;
            server.respondWith([
                200,
                { 'Content-Type': 'application/json' },
                '{"meta":{},"data":{},"cursor":{}}'
            ]);
        });

        afterEach(() => server.restore());

        it('should call handler function if authentication option is enabled', (done) => {
            const auth = (floraReq) => {
                floraReq.httpHeaders.Authorization = 'Bearer __token__';
                return Promise.resolve();
            };

            (new FloraClient({ url, auth }))
                .execute({ resource: 'user', auth: true })
                .then(() => {
                    expect(server.requests).to.have.length(1);
                    expect(server.requests[0]).to.have.property('requestHeaders')
                        .and.to.have.property('Authorization', 'Bearer __token__');
                    done();
                })
                .catch(done);
        });

        it('should add access_token parameter', (done) => {
            const auth = (floraReq) => {
                floraReq.access_token = '__token__';
                return Promise.resolve();
            };

            (new FloraClient({ url, auth }))
                .execute({
                    resource: 'user', id: 1337, action: 'update', auth: true
                })
                .then(() => {
                    expect(server.requests).to.have.length(1);
                    expect(server.requests[0]).to.have.property('url')
                        .and.to.contain('access_token=__token__');
                    done();
                })
                .catch(done);
        });

        it('should reject request if auth handler is not set', (done) => {
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

        it('should not add auth option as request parameter', (done) => {
            (new FloraClient({ url, auth: sinon.stub().resolves() }))
                .execute({ resource: 'user', auth: true })
                .then(() => {
                    expect(server.requests[0]).to.have.property('url')
                        .and.to.not.contain('auth=');
                    done();
                })
                .catch(done);
        });
    });

    describe('return value', () => {
        let server;

        beforeEach(() => {
            server = sinon.fakeServer.create();
        });

        afterEach(() => {
            server.restore();
        });

        it('should be a promise', (done) => {
            server.respondWith([200, { 'Content-Type': 'application/json; charset=utf-8' }, '{}']);
            const response = api.execute({ resource: 'user' });
            expect(response).to.be.instanceof(Promise);
            server.respond();
            setTimeout(done, 50);
        });

        it('should resolve promise with response', (done) => {
            const data = [{ id: 1337, firstname: 'John', lastname: 'Doe' }];
            const serverResponse = JSON.stringify({ meta: {}, data });

            server.respondWith([200, { 'Content-Type': 'application/json; charset=utf-8' }, serverResponse]);

            api.execute({ resource: 'user' })
                .then((response) => {
                    expect(response.data).to.eql(data);
                    done();
                })
                .catch(done);

            server.respond();
        });

        it('should reject promise if JSON cannot be parsed', (done) => {
            server.respondWith([200, { 'Content-Type': 'application/json; charset=utf-8' }, '["test": 123]']);

            api.execute({ resource: 'user' })
                .then(() => done(new Error('Expected promise to reject')))
                .catch((err) => {
                    expect(err).to.be.instanceof(SyntaxError)
                        .with.property('message', 'Unexpected token : in JSON at position 7');
                    done();
                });

            server.respond();
        });

        it('should not try to parse JSON if content-type doesn\'t match', (done) => {
            server.respondWith([500, { 'Content-Type': 'text/html' }, 'Internal Server Error']);

            api.execute({ resource: 'user' })
                .then(() => done(new Error('Expected promise to reject')))
                .catch((err) => {
                    expect(err).to.be.instanceOf(Error)
                        .with.property('message', 'Server Error: Internal Server Error');
                    done();
                });

            server.respond();
        });

        it('should add response to error object', (done) => {
            const floraReq = {
                resource: 'user',
                action: 'lock',
                id: 1337
            };
            const serverResponse = JSON.stringify({
                meta: {},
                data: null,
                error: {
                    message: 'Account already locked',
                    additional: {
                        info: true
                    }
                }
            });

            server.respondWith([400, { 'Content-Type': 'application/json; charset=utf-8' }, serverResponse]);

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

            server.respond();
        });

        it('should handle request errors', (done) => {
            server.respondWith((xhr) => xhr.error());

            api.execute({ resource: 'article' })
                .then(() => done(new Error('Expected promise to reject')))
                .catch((err) => {
                    expect(err).to.be.instanceOf(Error).with.property('message', 'Request failed');
                    done();
                });

            server.respond();
        });
    });

    describe('timeouts', () => {
        const timeoutError = new Error('Expected promise to reject with timeout error');
        let xhr;
        let clock;

        beforeEach(() => {
            clock = sinon.useFakeTimers();
            xhr = sinon.useFakeXMLHttpRequest();
        });

        afterEach(() => {
            clock.restore();
            xhr.restore();
        });

        it('should use default timeout', (done) => {
            api.execute({ resource: 'user' })
                .then(() => done(timeoutError))
                .catch((err) => {
                    expect(err).to.be.instanceOf(Error)
                        .and.to.have.property('message', 'Request timed out after 15000 milliseconds');
                    done();
                });

            clock.tick(18000);
        });

        it('should use custom timeout', (done) => {
            const timeout = 3000;

            (new FloraClient({ url, timeout }))
                .execute({ resource: 'user' })
                .then(() => done(timeoutError))
                .catch((err) => {
                    expect(err).to.be.instanceOf(Error)
                        .and.to.have.property('message', `Request timed out after ${timeout} milliseconds`);
                    done();
                });

            clock.tick(5000);
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
});
