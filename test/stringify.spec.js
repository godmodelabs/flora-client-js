'use strict';

const assert = require('node:assert/strict');
const stringify = require('../src/util/stringify');

describe('stringify select', () => {
    context('tests copied from github.com/godmodelabs/flora-client-js', () => {
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
            assert.equal(stringify(['id', 'name', ['attr1', 'attr2']]), 'id,name,attr1,attr2');
        });

        it('should handle nested objects', () => {
            assert.equal(
                stringify({
                    group1: { group2: 'value' },
                }),
                'group1.group2.value',
            );
        });

        it('should handle nested items', () => {
            assert.equal(stringify(['id', 'name', { subGroup: ['attr1', 'attr2'] }, 'attr']), 'id,name,subGroup[attr1,attr2],attr');
        });

        it('should handle deeply nested items', () => {
            assert.equal(
                stringify([
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
                    'attr',
                ]),
                'id,name,subGroupA[id,name,subSubGroupA[attr1,attr2],subSubGroupB[subSubSubGroupA[attr1,attr2],subSubSubItem,subSubSubGroupB[attr1,attr2]]],attr',
            );
        });

        it('should not use brackets for single item groups', () => {
            assert.equal(stringify({ subGroup: ['attr'] }), 'subGroup.attr');
        });
    });

    context('found bugs', () => {
        it('deep object are not correctly parsed', () => {
            assert.equal(stringify([{ a: [{ b: ['bb'], c: ['cc'] }] }]), 'a[b.bb,c.cc]');
        });
    });
});
