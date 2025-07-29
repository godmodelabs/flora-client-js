import Client, { type FloraClientOptions, type FloraClientHttpAdapter } from '../src/Client';
import NodeHttpAdapter from '../src/Adapter/Node';
import timeout from './timeout';

export type FloraClientOptionsNode = Omit<FloraClientOptions, 'adapter'> & {
    adapter?: FloraClientHttpAdapter,
    timeout?: string | number,
};

export default class FloraClient extends Client {
    constructor(opts: FloraClientOptionsNode) {
        opts.adapter = opts.adapter ?? new NodeHttpAdapter({ timeout: timeout(opts) });
        super(opts as FloraClientOptionsNode & { adapter: FloraClientHttpAdapter });
    }
}
