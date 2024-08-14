import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import stringify from '../src/util/stringify.js';

describe('stringify select', () => {
    it('should stringify simple arrays', () => {
        assert.equal(stringify(['id', 'name']), 'id,name');
    });

    it('should handle objects', () => {
        assert.equal(stringify({ groupA: ['attr1', 'attr2'] }), 'groupA[attr1,attr2]');
    });

    it('should handle simple key/value objects', () => {
        assert.equal(stringify({ key: 'value' }), 'key.value');
    });

    it('should handle nested arrays', () => {
        const spec = ['id', 'name', ['attr1', 'attr2']];
        assert.equal(stringify(spec), 'id,name,attr1,attr2');
    });

    it('should handle nested objects', () => {
        const spec = { group1: { group2: 'value' } };
        assert.equal(stringify(spec), 'group1.group2.value');
    });

    it('should handle nested items', () => {
        const spec = ['id', 'name', { subGroup: ['attr1', 'attr2'] }, 'attr'];
        assert.equal(stringify(spec), 'id,name,subGroup[attr1,attr2],attr');
    });

    it('should handle deeply nested items', () => {
        const spec = [
            'id',
            'name',
            {
                subGroupA: [
                    'id',
                    'name',
                    {
                        subSubGroupA: ['attr1', 'attr2'],
                        subSubGroupB: [{ subSubSubGroupA: ['attr1', 'attr2'] }, 'subSubSubItem', { subSubSubGroupB: ['attr1', 'attr2'] }],
                    },
                ],
            },
            'attr',
        ];

        assert.equal(
            stringify(spec),
            'id,name,subGroupA[id,name,subSubGroupA[attr1,attr2],subSubGroupB[subSubSubGroupA[attr1,attr2],subSubSubItem,subSubSubGroupB[attr1,attr2]]],attr',
        );
    });

    it('should not use brackets for single item groups', () => {
        assert.equal(stringify({ subGroup: ['attr'] }), 'subGroup.attr');
    });

    describe('found bugs', () => {
        it('deep object are not correctly parsed', () => {
            const spec = [{ a: [{ b: ['bb'], c: ['cc'] }] }];
            assert.equal(stringify(spec), 'a[b.bb,c.cc]');
        });
    });
});
