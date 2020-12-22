# Flora JS client

![](https://github.com/godmodelabs/flora-client-js/workflows/ci/badge.svg)
[![NPM version](https://img.shields.io/npm/v/flora-client-js.svg?style=flat)](https://www.npmjs.com/package/flora-client-js)
[![NPM downloads](https://img.shields.io/npm/dm/flora-client-js.svg?style=flat)](https://www.npmjs.com/package/flora-client-js)

Easily access [Flora](https://github.com/godmodelabs/flora) based APIs.

String-Notation

```js
const FloraClient = require('flora-client-js');
const client = new FloraClient({ url: 'http://api.example.com/' });

client.execute({
    resource: 'article',
    select: 'id,name,subGroupA[id,name,subSubGroupA[attr1,attr2],subSubGroupB[subSubSubGroupA[attr1,attr2],subSubSubItem,subSubSubGroupB[attr1,attr2]]],attr';
    limit: 15,
}).then((response) => console.log(response));
```

Object-Notation ( >= v0.4.1)

```js
const FloraClient = require('flora-client-js');
const client = new FloraClient({ url: 'http://api.example.com/' });

client.execute({
    resource: 'article',
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
    ];
    limit: 15
}).then(response => console.log(response));
```

## License

[MIT](LICENSE)
