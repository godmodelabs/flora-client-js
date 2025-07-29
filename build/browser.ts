import Client, { type FloraClientHttpAdapter, type FloraClientOptions } from '../src/Client';
import XhrAdapter from '../src/Adapter/Xhr';
import timeout from './timeout';

export type FloraClientOptionsBrowser = Omit<FloraClientOptions, 'adapter'> & {
    adapter?: FloraClientHttpAdapter,
    timeout?: string | number,
};

export default class FloraClient extends Client {
    constructor(opts: FloraClientOptionsBrowser) {
        opts.adapter = opts.adapter || new XhrAdapter({ timeout: timeout(opts) });
        super(opts as FloraClientOptionsBrowser & { adapter: FloraClientHttpAdapter });
    }
}
