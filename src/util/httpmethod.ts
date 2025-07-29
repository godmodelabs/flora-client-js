import querystringify from './querystringify';

type HttpMethodOptions = {
    params?: {
        action?: string,
    },
};

export default function (opts: HttpMethodOptions) {
    const { params } = opts;

    if (params) {
        const { action } = params;
        if (action && action !== 'retrieve') return 'POST';
        if (querystringify(params).length > 2000) return 'POST';
    }
    if (Object.prototype.hasOwnProperty.call(opts, 'jsonData')) return 'POST';

    return 'GET';
}
