import Client from '../src/Client';
import Adapter from '../src/Adapter/Node.js';
import timeout from './timeout';

class FloraClient extends Client {
    constructor(opts) {
        opts.adapter = opts.adapter || new Adapter({ timeout: timeout(opts) });
        super(opts);
    }
}

export default FloraClient;
