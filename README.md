# Flora JS client

![](https://github.com/godmodelabs/flora-client-js/workflows/ci/badge.svg)
[![NPM version](https://img.shields.io/npm/v/flora-client-js.svg?style=flat)](https://www.npmjs.com/package/flora-client-js)
[![NPM downloads](https://img.shields.io/npm/dm/flora-client-js.svg?style=flat)](https://www.npmjs.com/package/flora-client-js)

A lightweight client for interacting with [Flora](https://github.com/florajs) APIs. It automatically merges default parameters, forces selected parameters into the query string, chooses GET/POST based on payload and action, enforces JSON responses, supports per-request authentication, and lets you cancel requests via AbortSignal.

# Authentication handler

Optional authentication handler to attach credentials or modify the prepared Request before it’s sent. Enable it per request with ```{ auth: true }```.

```js
import FloraClient from 'flora-client-js';

async function token() {
    // Fetch from storage/refresh endpoint
    return '<token>';
}

const client = new FloraClient({
    url: 'http://api.example.com/',
    auth: async (req) => {
        const token = await token();
        req.headers.set('Authorization', `Bearer ${token}`);
        return req;
    },
});

const response = await client.execute({
    resource: 'user',
    id: 'me',
    select: 'emails.email',
    auth: true,
});
```

# Specify select attribute as array/object

You can provide select attribute as a string, array, or nested object. Complex shapes are serialized automatically.

```js
import FloraClient from 'flora-client-js';

const client = new FloraClient({ url: 'http://api.example.com/' });
const response = await client.execute({
    resource: 'fancy-resource',
	select: [
        'id',
        'name',
        {
            subGroupA: [
            	'id',
                'name',
                {
                    subSubGroupA: ['attr1', 'attr2'],
                    subSubGroupB: [
                        { subSubSubGroupA: ['attr1', 'attr2'] },
                        'subSubSubItem',
                        { subSubSubGroupB: ['attr1', 'attr2'] },
                    ],
                },
            ],
        },
    ],
});
```

# Abort requests using signals

Use ```AbortController``` to cancel requests, or provide your own abort/timeout logic. The client also applies a default timeout (15s) when no signal is provided.

```js
import FloraClient from 'flora-client-js';

const client = new FloraClient({ url: 'http://api.example.com/' });
let controller = null;
let debounceTimeout = null;

async function search(term) {
    // abort previous request
    if (controller) controller.abort();
    controller = new AbortController();

    try {
        const response = await client.execute({
            resource: 'article',
            select: ['id', 'title', 'date'],
            search: term,
            signal: controller.signal,
        });
        // handle response...
    } catch (err) {
        // Ignore expected aborts
        if (err.name === 'AbortError' || controller.signal.aborted) return;
        // handle errors...
    }
}

document.querySelector('#search').addEventListener('input', (e) => {
    const term = e.target.value.trim();

    clearTimeout(debounceTimeout);
    if (!term) {
        return;
    }

    debounceTimeout = setTimeout(() => runSearch(term), 250);
});
```

## License

[MIT](LICENSE)
